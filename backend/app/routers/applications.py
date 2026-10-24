from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.constants import (
    STATUS_APPROVED,
    STATUS_CONTRACT_SIGNING,
    STATUS_COUNTER_OFFER,
    STATUS_DISBURSED,
    STATUS_DRAFT,
    STATUS_REJECTED,
)
from app.database import get_db
from app.models import Application, Product, StatusHistory, User
from app.schemas import (
    ApplicationCreate,
    ApplicationDetail,
    ApplicationListItem,
    ApplicationUpdate,
    CounterOfferDeclineRequest,
)
from app.security import require_client
from app.services.application_outcomes import set_approval, set_decision
from app.services.application_queries import (
    LIST_OPTIONS,
    load_application,
    reload_application,
)
from app.services.orchestrator import run_orchestrator
from app.services.state_machine import transition

router = APIRouter(prefix="/applications", tags=["client-applications"])


def _money(value: float) -> str:
    return f"{value:,.0f}".replace(",", " ") + " ₽"


async def _get_owned_application(
    db: AsyncSession, application_id: int, user: User
) -> Application:
    application = await load_application(db, application_id)
    if application is None or application.client_id != user.id:
        raise HTTPException(status_code=404, detail="Заявка не найдена")
    return application


async def _get_product(db: AsyncSession, product_id: int) -> Product:
    product = await db.get(Product, product_id)
    if product is None or not product.is_active:
        raise HTTPException(status_code=404, detail="Кредитный продукт не найден")
    return product


@router.get("", response_model=list[ApplicationListItem])
async def list_my_applications(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_client),
):
    result = await db.execute(
        select(Application)
        .options(*LIST_OPTIONS)
        .where(Application.client_id == user.id)
        .order_by(Application.created_at.desc(), Application.id.desc())
    )
    return [
        ApplicationListItem.model_validate(application)
        for application in result.scalars().unique().all()
    ]


@router.post("", response_model=ApplicationDetail, status_code=status.HTTP_201_CREATED)
async def create_application(
    payload: ApplicationCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_client),
):
    await _get_product(db, payload.product_id)
    application = Application(
        client_id=user.id,
        product_id=payload.product_id,
        amount=payload.amount,
        term_months=payload.term_months,
        purpose=payload.purpose.strip(),
        status=STATUS_DRAFT,
    )
    db.add(application)
    await db.flush()
    db.add(
        StatusHistory(
            application_id=application.id,
            status=STATUS_DRAFT,
            comment="Заявка создана в кредитном кабинете.",
            actor_role="client",
        )
    )
    await db.commit()

    loaded = await reload_application(db, application.id)
    assert loaded is not None
    return ApplicationDetail.model_validate(loaded)


@router.get("/{application_id}", response_model=ApplicationDetail)
async def get_application(
    application_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_client),
):
    application = await _get_owned_application(db, application_id, user)
    return ApplicationDetail.model_validate(application)


@router.put("/{application_id}", response_model=ApplicationDetail)
async def update_application(
    application_id: int,
    payload: ApplicationUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_client),
):
    application = await _get_owned_application(db, application_id, user)
    if application.status != STATUS_DRAFT:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Редактировать можно только черновик заявки",
        )

    if payload.product_id is not None:
        await _get_product(db, payload.product_id)
        application.product_id = payload.product_id
    if payload.amount is not None:
        application.amount = payload.amount
    if payload.term_months is not None:
        application.term_months = payload.term_months
    if payload.purpose is not None:
        application.purpose = payload.purpose.strip()

    await db.commit()
    loaded = await reload_application(db, application.id)
    assert loaded is not None
    return ApplicationDetail.model_validate(loaded)


@router.post("/{application_id}/submit", response_model=ApplicationDetail)
async def submit_application(
    application_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_client),
):
    application = await _get_owned_application(db, application_id, user)
    if application.status != STATUS_DRAFT:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Отправить можно только черновик заявки",
        )

    await run_orchestrator(db, application)
    loaded = await reload_application(db, application.id)
    assert loaded is not None
    return ApplicationDetail.model_validate(loaded)


@router.post("/{application_id}/confirm-conditions", response_model=ApplicationDetail)
async def confirm_conditions(
    application_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_client),
):
    application = await _get_owned_application(db, application_id, user)
    if application.status != STATUS_APPROVED:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Подтвердить условия можно только по одобренной заявке",
        )

    approval = application.approval
    approved_amount = (
        approval.approved_amount if approval is not None else None
    ) or application.amount
    approved_term = (
        approval.approved_term_months if approval is not None else None
    ) or application.term_months
    approved_rate = (
        approval.approved_rate if approval is not None else None
    ) or application.product.base_rate
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
        STATUS_CONTRACT_SIGNING,
        comment=(
            "Клиент подтвердил условия кредита: "
            f"{_money(approved_amount)}, "
            f"{approved_term} мес., "
            f"ставка {approved_rate}%."
        ),
        actor_role="client",
    )
    await db.commit()
    loaded = await reload_application(db, application.id)
    assert loaded is not None
    return ApplicationDetail.model_validate(loaded)


@router.post("/{application_id}/accept-counter-offer", response_model=ApplicationDetail)
async def accept_counter_offer(
    application_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_client),
):
    application = await _get_owned_application(db, application_id, user)
    if application.status != STATUS_COUNTER_OFFER:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="По заявке нет активного встречного предложения",
        )
    if application.counter_offer_amount is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Встречное предложение не сформировано",
        )

    approval = application.approval
    approved_rate = (
        approval.approved_rate if approval is not None else None
    ) or round(application.product.base_rate + 1.0, 1)
    application.amount = application.counter_offer_amount
    set_approval(
        application,
        approved_amount=application.counter_offer_amount,
        approved_term_months=application.term_months,
        approved_rate=approved_rate,
        replace=True,
    )

    transition(
        db,
        application,
        STATUS_CONTRACT_SIGNING,
        comment=(
            "Клиент принял встречное предложение на сумму "
            f"{_money(application.counter_offer_amount)}."
        ),
        actor_role="client",
    )
    await db.commit()
    loaded = await reload_application(db, application.id)
    assert loaded is not None
    return ApplicationDetail.model_validate(loaded)


@router.post("/{application_id}/decline-counter-offer", response_model=ApplicationDetail)
async def decline_counter_offer(
    application_id: int,
    payload: CounterOfferDeclineRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_client),
):
    application = await _get_owned_application(db, application_id, user)
    if application.status != STATUS_COUNTER_OFFER:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="По заявке нет активного встречного предложения",
        )

    reason = "Клиент отказался от встречного предложения банка."
    if payload.comment.strip():
        reason += f" Комментарий: {payload.comment.strip()}"
    set_decision(application, STATUS_REJECTED, reason)
    transition(
        db,
        application,
        STATUS_REJECTED,
        comment=reason,
        actor_role="client",
    )
    await db.commit()
    loaded = await reload_application(db, application.id)
    assert loaded is not None
    return ApplicationDetail.model_validate(loaded)


@router.post("/{application_id}/sign-contract", response_model=ApplicationDetail)
async def sign_contract(
    application_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_client),
):
    application = await _get_owned_application(db, application_id, user)
    if application.status != STATUS_CONTRACT_SIGNING:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Договор можно подписать только после согласования условий",
        )

    approval = application.approval
    approved_amount = (
        approval.approved_amount if approval is not None else None
    ) or application.amount
    transition(
        db,
        application,
        STATUS_DISBURSED,
        comment=(
            "Договор подписан. Средства перечислены на расчётный счёт клиента. "
            f"Сумма: {_money(approved_amount)}."
        ),
        actor_role="client",
    )
    await db.commit()
    loaded = await reload_application(db, application.id)
    assert loaded is not None
    return ApplicationDetail.model_validate(loaded)
