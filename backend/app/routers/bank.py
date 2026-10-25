from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import String, cast, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.constants import ALL_STATUSES, STATUS_DRAFT, STATUS_MANUAL_REVIEW
from app.database import get_db
from app.models import (
    Application,
    IndividualEntrepreneur,
    LLCCompany,
    Product,
    User,
)
from app.schemas import (
    ApplicationDetail,
    ApplicationListItem,
    BankDecisionRequest,
)
from app.security import require_bank
from app.services.application_outcomes import set_approval, set_decision
from app.services.application_queries import (
    LIST_OPTIONS,
    load_application,
    reload_application,
)
from app.services.formatting import format_money
from app.services.state_machine import transition

router = APIRouter(prefix="/bank", tags=["bank"])


@router.get("/applications", response_model=list[ApplicationListItem])
async def list_applications(
    status_filter: str | None = Query(default=None, alias="status"),
    search: str | None = Query(default=None),
    product_code: str | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_bank),
):
    if status_filter and status_filter not in ALL_STATUSES:
        raise HTTPException(status_code=400, detail="Неизвестный статус заявки")

    statement = (
        select(Application)
        .join(User, Application.client_id == User.id)
        .outerjoin(LLCCompany, LLCCompany.user_id == User.id)
        .outerjoin(
            IndividualEntrepreneur,
            IndividualEntrepreneur.user_id == User.id,
        )
        .options(*LIST_OPTIONS)
        .where(Application.deleted_at.is_(None))
    )
    if status_filter:
        statement = statement.where(Application.status == status_filter)
    else:
        statement = statement.where(Application.status != STATUS_DRAFT)
    if product_code:
        statement = statement.join(
            Product, Application.product_id == Product.id
        ).where(Product.code == product_code)
    if search and search.strip():
        pattern = f"%{search.strip()}%"
        statement = statement.where(
            or_(
                LLCCompany.name.ilike(pattern),
                LLCCompany.inn.ilike(pattern),
                IndividualEntrepreneur.full_name.ilike(pattern),
                IndividualEntrepreneur.inn.ilike(pattern),
                User.full_name.ilike(pattern),
                User.email.ilike(pattern),
                cast(Application.id, String).ilike(pattern),
            )
        )
    statement = statement.order_by(
        Application.created_at.desc(), Application.id.desc()
    ).limit(limit)

    result = await db.execute(statement)
    applications = result.scalars().unique().all()
    return [
        ApplicationListItem.model_validate(application)
        for application in applications
    ]


@router.get("/applications/{application_id}", response_model=ApplicationDetail)
async def get_application(
    application_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_bank),
):
    application = await load_application(db, application_id)
    if application is None or application.deleted_at:
        raise HTTPException(status_code=404, detail="Заявка не найдена")
    return ApplicationDetail.model_validate(application)


@router.post(
    "/applications/{application_id}/decision",
    response_model=ApplicationDetail,
)
async def make_bank_decision(
    application_id: int,
    payload: BankDecisionRequest,
    db: AsyncSession = Depends(get_db),
    bank_user: User = Depends(require_bank),
):
    application = await load_application(db, application_id)
    if application is None or application.deleted_at:
        raise HTTPException(status_code=404, detail="Заявка не найдена")

    if application.status != STATUS_MANUAL_REVIEW:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Решение доступно только по заявкам на ручной проверке",
        )

    comment = payload.comment.strip()

    if payload.decision == "APPROVED":
        approved_amount = payload.approved_amount or application.amount
        approved_term = payload.approved_term_months or application.term_months
        approval = application.approval
        approved_rate = (
            payload.approved_rate
            or (approval.approved_rate if approval is not None else None)
            or application.product.base_rate
        )
        if approved_amount < application.product.min_amount:
            raise HTTPException(
                status_code=400,
                detail=(
                    "Одобренная сумма ниже минимальной суммы продукта "
                    f"({format_money(application.product.min_amount)})"
                ),
            )
        if approved_amount > application.product.max_amount:
            raise HTTPException(
                status_code=400,
                detail=(
                    "Одобренная сумма выше максимальной суммы продукта "
                    f"({format_money(application.product.max_amount)})"
                ),
            )
        if not (
            application.product.min_term_months
            <= approved_term
            <= application.product.max_term_months
        ):
            raise HTTPException(
                status_code=400,
                detail="Срок не соответствует лимитам продукта",
            )

        reason = comment or (
            "Банк одобрил заявку по итогам ручной проверки. "
            f"Сумма {format_money(approved_amount)}, срок {approved_term} мес., "
            f"ставка {approved_rate}%."
        )
        set_decision(application, "APPROVED", reason)
        set_approval(
            application,
            approved_amount=approved_amount,
            approved_term_months=approved_term,
            approved_rate=approved_rate,
            replace=True,
        )
        transition(
            db,
            application,
            "APPROVED",
            comment=reason,
            actor_role="bank",
        )

    elif payload.decision == "REJECTED":
        reason = comment or (
            "Банк отклонил заявку по итогам ручной проверки."
        )
        set_decision(application, "REJECTED", reason)
        transition(
            db,
            application,
            "REJECTED",
            comment=reason,
            actor_role="bank",
        )

    else:
        reason = comment or (
            "Банк запросил дополнительные сведения по заявке. "
            "Ожидается ответ клиента."
        )
        set_decision(application, "MANUAL_REVIEW", reason)
        transition(
            db,
            application,
            STATUS_MANUAL_REVIEW,
            comment=reason,
            actor_role="bank",
        )

    await db.commit()
    loaded = await reload_application(db, application.id)
    assert loaded is not None
    return ApplicationDetail.model_validate(loaded)
