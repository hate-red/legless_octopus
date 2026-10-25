"""Company data and real, versioned PDF documents used by the cabinet."""
from datetime import datetime, timezone
from pathlib import PurePath
from typing import Literal
from urllib.parse import quote
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from sqlalchemy import delete, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.constants import STATUS_DRAFT, STATUS_LABELS
from app.database import get_db
from app.models import (
    Application,
    ApplicationDocument,
    CompanyDocument,
    IndividualEntrepreneur,
    NotificationReceipt,
    Okved,
    StatusHistory,
    User,
)
from app.schemas import (
    CompanyUpdate,
    DocumentConfirmation,
    NotificationsRead,
    UserOut,
)
from app.security import get_current_user, require_client
from app.services.application_queries import load_application

router = APIRouter(tags=["cabinet"])
KINDS = {"company": "Карточка компании", "statement": "Выписка по счёту", "finance": "Финансовая отчётность"}
MAX_DOCUMENT_SIZE = 10 * 1024 * 1024


@router.get("/company/okveds")
async def okveds(db: AsyncSession = Depends(get_db), _: User = Depends(require_client)):
    rows = (await db.scalars(select(Okved).order_by(Okved.code))).all()
    return [{"id": row.id, "code": row.code, "name": row.name} for row in rows]


@router.put("/company", response_model=UserOut)
async def update_company(payload: CompanyUpdate, db: AsyncSession = Depends(get_db), user: User = Depends(require_client)):
    company = user.company
    if company is None:
        raise HTTPException(404, "Компания не найдена")
    registration_length = 15 if isinstance(company, IndividualEntrepreneur) else 13
    if len(payload.ogrn) != registration_length:
        raise HTTPException(422, f"Регистрационный номер должен содержать {registration_length} цифр")
    if await db.get(Okved, payload.okved_id) is None:
        raise HTTPException(400, "Выберите деятельность из справочника")
    allowed = {"full_name", "kpp", "registered_on", "legal_address", "actual_address", "director", "bank", "account", "bik", "correspondent", "phone"}
    if any(key not in allowed or len(value) > 500 for key, value in payload.details.items()):
        raise HTTPException(422, "Некорректные дополнительные сведения")
    for field in ("inn", "revenue", "declared_profit", "employees", "business_age_months", "okved_id", "details"):
        setattr(company, field, getattr(payload, field))
    if isinstance(company, IndividualEntrepreneur):
        company.full_name, company.ogrnip = payload.name.strip(), payload.ogrn
    else:
        company.name, company.ogrn = payload.name.strip(), payload.ogrn
    user.full_name = payload.contact_name.strip()
    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(409, "Компания с таким ИНН уже существует") from exc
    await db.refresh(company, ["okved"])
    return UserOut.model_validate(user)


def document_out(document: CompanyDocument):
    return {"id": document.id, "kind": document.kind, "title": KINDS[document.kind], "filename": document.filename, "period": document.period, "size": document.size, "uploaded_at": document.uploaded_at}


@router.get("/company/documents")
async def list_documents(db: AsyncSession = Depends(get_db), user: User = Depends(require_client)):
    rows = (await db.scalars(select(CompanyDocument).where(CompanyDocument.owner_id == user.id, CompanyDocument.is_current.is_(True)).order_by(CompanyDocument.kind))).all()
    return [document_out(row) for row in rows]


@router.put("/company/documents/{kind}", status_code=201)
async def upload_document(kind: Literal["company", "statement", "finance"], request: Request, filename: str = Query(min_length=1, max_length=255), period: str = Query(default="", max_length=255), db: AsyncSession = Depends(get_db), user: User = Depends(require_client)):
    clean_name = PurePath(filename.replace("\\", "/")).name
    if not clean_name.lower().endswith(".pdf") or any(ord(char) < 32 for char in clean_name):
        raise HTTPException(422, "Добавьте файл PDF с корректным именем")
    data = bytearray()
    async for chunk in request.stream():
        data.extend(chunk)
        if len(data) > MAX_DOCUMENT_SIZE:
            raise HTTPException(413, "Максимальный размер файла — 10 МБ")
    if not data.startswith(b"%PDF-"):
        raise HTTPException(422, "Файл не является PDF")
    # Serialize replacements per company so the current version is unambiguous.
    await db.execute(select(User.id).where(User.id == user.id).with_for_update())
    await db.execute(update(CompanyDocument).where(CompanyDocument.owner_id == user.id, CompanyDocument.kind == kind, CompanyDocument.is_current.is_(True)).values(is_current=False))
    document = CompanyDocument(id=str(uuid4()), owner_id=user.id, kind=kind, filename=clean_name, period=period.strip(), content=bytes(data), size=len(data), is_current=True)
    db.add(document)
    await db.commit()
    await db.refresh(document)
    return document_out(document)


@router.get("/company/documents/{document_id}/content")
async def download_document(document_id: str, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    document = await db.get(CompanyDocument, document_id)
    if document is None or (user.role != "bank" and document.owner_id != user.id):
        raise HTTPException(404, "Документ не найден")
    return Response(document.content, media_type="application/pdf", headers={"Content-Disposition": f"inline; filename=document.pdf; filename*=UTF-8''{quote(document.filename, safe='')}", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff"})


@router.post("/applications/{application_id}/documents/confirm")
async def confirm_documents(application_id: int, payload: DocumentConfirmation, db: AsyncSession = Depends(get_db), user: User = Depends(require_client)):
    application = await load_application(db, application_id)
    if application is None or application.client_id != user.id or application.deleted_at:
        raise HTTPException(404, "Заявка не найдена")
    if application.status != STATUS_DRAFT:
        raise HTTPException(409, "Документы можно подтвердить только в черновике")
    rows = await attach_documents(db, application, payload, user)
    await db.commit()
    return {"confirmed_at": application.documents_confirmed_at, "documents": [document_out(row) for row in rows]}


async def attach_documents(db: AsyncSession, application: Application, payload: DocumentConfirmation, user: User):
    rows = (await db.scalars(select(CompanyDocument).where(CompanyDocument.id.in_(payload.document_ids), CompanyDocument.owner_id == user.id, CompanyDocument.is_current.is_(True)))).all()
    required = {"company", "statement", "finance"}
    if {row.kind for row in rows} != required or len(rows) != len(set(payload.document_ids)):
        raise HTTPException(422, "Добавьте карточку компании, выписку и финансовую отчётность")
    await db.execute(delete(ApplicationDocument).where(ApplicationDocument.application_id == application.id))
    db.add_all([ApplicationDocument(application_id=application.id, document_id=row.id) for row in rows])
    application.documents_confirmed_at = datetime.now(timezone.utc)
    return rows


@router.post("/applications/{application_id}/documents/respond")
async def respond_documents(application_id: int, payload: DocumentConfirmation, db: AsyncSession = Depends(get_db), user: User = Depends(require_client)):
    application = await load_application(db, application_id)
    if application is None or application.client_id != user.id or application.deleted_at:
        raise HTTPException(404, "Заявка не найдена")
    latest = await db.scalar(select(StatusHistory).where(StatusHistory.application_id == application_id).order_by(StatusHistory.id.desc()).limit(1))
    if application.status != "MANUAL_REVIEW" or latest is None or latest.actor_role != "bank" or latest.status != "MANUAL_REVIEW":
        raise HTTPException(409, "По этой заявке нет открытого запроса документов")
    await attach_documents(db, application, payload, user)
    db.add(StatusHistory(application_id=application_id, status="MANUAL_REVIEW", actor_role="client", comment="Компания предоставила актуальные документы в ответ на запрос банка."))
    await db.commit()
    return {"message": "Документы переданы сотруднику банка"}


@router.get("/applications/{application_id}/documents")
async def application_documents(application_id: int, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    application = await db.get(Application, application_id)
    if application is None or application.deleted_at or (user.role != "bank" and application.client_id != user.id):
        raise HTTPException(404, "Заявка не найдена")
    rows = (await db.scalars(select(CompanyDocument).join(ApplicationDocument, ApplicationDocument.document_id == CompanyDocument.id).where(ApplicationDocument.application_id == application_id))).all()
    return [document_out(row) for row in rows]


def visible_history(user: User):
    statement = select(StatusHistory).join(Application).where(Application.deleted_at.is_(None), StatusHistory.status != STATUS_DRAFT)
    return statement.where(Application.client_id == user.id) if user.role == "client" else statement.where(StatusHistory.status == "MANUAL_REVIEW")


@router.get("/notifications")
async def notifications(db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    rows = (await db.scalars(visible_history(user).order_by(StatusHistory.created_at.desc(), StatusHistory.id.desc()).limit(50))).all()
    read_ids = set((await db.scalars(select(NotificationReceipt.history_id).where(NotificationReceipt.user_id == user.id))).all())
    return [{"id": row.id, "title": f"Заявка №{row.application_id}: {STATUS_LABELS.get(row.status, row.status)}", "message": row.comment, "application_id": row.application_id, "created_at": row.created_at, "read": row.id in read_ids} for row in rows]


@router.post("/notifications/read")
async def read_notifications(payload: NotificationsRead, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    from sqlalchemy.dialects.postgresql import insert
    rows = (await db.scalars(visible_history(user).where(StatusHistory.id.in_(payload.ids)))).all()
    if rows:
        await db.execute(insert(NotificationReceipt).values([{"user_id": user.id, "history_id": row.id} for row in rows]).on_conflict_do_nothing())
    await db.commit()
    return {"message": "Уведомления прочитаны"}
