"""Application orchestrator: validation → enrichment → AI → scoring → decision."""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from app.constants import (
    STATUS_AI_PURPOSE_CHECK,
    STATUS_ENRICHMENT,
    STATUS_REJECTED,
    STATUS_SCORING,
    STATUS_VALIDATION,
)
from app.models import (
    AICheck,
    Application,
    BKICheck,
    FinancialVerification,
    ScoringResult,
)
from app.services import integrations
from app.services.scoring.ai_service import LLMPuproseChecker
from app.services.application_outcomes import set_approval, set_decision
from app.services.companies import get_company_for_user
from app.services.decision_engine import make_decision
from app.services.okveds import get_or_create_okved
from app.services.scoring.scoring import calculate_score
from app.services.state_machine import transition


logger = logging.getLogger(__name__)

llm_checker = LLMPuproseChecker()

def _diff_pct(value: float, reference: float) -> float:
    if reference == 0:
        return 0.0 if value == 0 else 100.0
    return round((value - reference) / abs(reference) * 100, 1)


def _money(value: float) -> str:
    return f"{value:,.0f}".replace(",", " ") + " ₽"


def _validate_limits(application: Application) -> list[str]:
    product = application.product
    errors: list[str] = []
    if application.amount < product.min_amount:
        errors.append(
            f"Сумма {_money(application.amount)} ниже минимальной "
            f"{_money(product.min_amount)}"
        )
    if application.amount > product.max_amount:
        errors.append(
            f"Сумма {_money(application.amount)} выше максимальной "
            f"{_money(product.max_amount)}"
        )
    if application.term_months < product.min_term_months:
        errors.append(
            f"Срок {application.term_months} мес. короче минимального "
            f"{product.min_term_months} мес."
        )
    if application.term_months > product.max_term_months:
        errors.append(
            f"Срок {application.term_months} мес. длиннее максимального "
            f"{product.max_term_months} мес."
        )
    return errors


async def run_orchestrator(
    db: AsyncSession, application: Application
) -> Application:
    """Run the full credit pipeline. The caller must load product and client."""
    application.submitted_at = datetime.now(timezone.utc)

    transition(
        db,
        application,
        STATUS_VALIDATION,
        comment="Заявка отправлена на рассмотрение. Проверка лимитов продукта.",
        actor_role="client",
    )

    errors = _validate_limits(application)
    if errors:
        reason = "Заявка не прошла валидацию: " + "; ".join(errors)
        set_decision(application, STATUS_REJECTED, reason)
        transition(
            db,
            application,
            STATUS_REJECTED,
            comment=reason,
        )
        await db.commit()
        return application

    company = await get_company_for_user(db, application.client_id)
    if company is None:
        reason = "Не найден профиль компании. Заполните данные организации."
        set_decision(application, STATUS_REJECTED, reason)
        transition(
            db,
            application,
            STATUS_REJECTED,
            comment=reason,
        )
        await db.commit()
        return application

    # --- ENRICHMENT ---------------------------------------------------------
    transition(
        db,
        application,
        STATUS_ENRICHMENT,
        comment="Запрос данных: ЕГРЮЛ, ГИР БО, БКИ.",
    )
    egrul, girbo, bki_data = await asyncio.gather(
        integrations.fetch_egrul(company.inn),
        integrations.fetch_girbo(company.inn),
        integrations.fetch_bki(company.inn),
    )

    # For known companies EGRUL is authoritative. For arbitrary INNs the mock
    # returns generated demo data; keep the company profile from the database
    # instead of silently replacing it.
    if egrul.get("source") == "registry":
        okved_code = str(egrul.get("okved") or "").strip()
        if okved_code:
            okved_name = str(
                egrul.get("okved_name") or company.okved.name
            ).strip()
            company.okved = await get_or_create_okved(
                db, okved_code, okved_name
            )
    company.has_overdue = int(bki_data.get("overdue_count", 0)) > 0

    official_revenue = float(girbo.get("official_revenue", 0))
    official_profit = float(girbo.get("official_profit", 0))
    revenue_diff = _diff_pct(official_revenue, company.revenue)
    profit_diff = _diff_pct(official_profit, company.declared_profit)

    flags: list[str] = []
    if abs(revenue_diff) > 15:
        flags.append(
            "Расхождение выручки: заявлено "
            f"{_money(company.revenue)}, по ГИР БО {_money(official_revenue)} "
            f"({revenue_diff:+.1f}%)."
        )
    if abs(profit_diff) > 20:
        flags.append(
            "Расхождение прибыли: заявлено "
            f"{_money(company.declared_profit)}, по ГИР БО "
            f"{_money(official_profit)} ({profit_diff:+.1f}%)."
        )
    if official_profit < 0:
        flags.append("Отрицательная прибыль по данным ГИР БО.")
    if int(bki_data.get("overdue_count", 0)) > 0:
        flags.append(
            f"В БКИ зафиксировано просрочек: {bki_data['overdue_count']}."
        )

    verification = FinancialVerification(
        application_id=application.id,
        official_revenue=official_revenue,
        official_profit=official_profit,
        revenue_diff_pct=revenue_diff,
        profit_diff_pct=profit_diff,
        flags=flags,
    )
    bki = BKICheck(
        application_id=application.id,
        bki_score=int(bki_data.get("bki_score", 0)),
        active_loans=int(bki_data.get("active_loans", 0)),
        monthly_payments=float(bki_data.get("monthly_payments", 0)),
        overdue_count=int(bki_data.get("overdue_count", 0)),
        payment_discipline_pct=float(bki_data.get("payment_discipline_pct", 0)),
    )
    db.add_all([verification, bki])
    await db.flush()

    # --- AI PURPOSE CHECK ---------------------------------------------------
    transition(
        db,
        application,
        STATUS_AI_PURPOSE_CHECK,
        comment="Проверка цели кредита локальной семантической моделью.",
    )

    ai_result = await llm_checker.check_purpose(
        purpose=application.purpose,
        okved=company.okved.name,
    )
    ai_check = AICheck(
        application_id=application.id,
        is_purpose_valid=ai_result.is_valid,
        ai_comment=ai_result.comment,
    )
    db.add(ai_check)
    await db.flush()

    # --- SCORING ------------------------------------------------------------
    transition(
        db,
        application,
        STATUS_SCORING,
        comment="Расчёт скоринга и долговой нагрузки (DTI).",
    )
    score, factors, dti = calculate_score(
        company=company,
        verification=verification,
        bki=bki,
        ai_result=ai_result,
        amount=application.amount,
        term_months=application.term_months,
    )
    scoring = ScoringResult(
        application_id=application.id,
        score=score,
        factors=[factor.to_dict() for factor in factors],
        dti_percent=dti,
    )
    db.add(scoring)
    application.score = score
    await db.flush()

    # --- DECISION -----------------------------------------------------------
    outcome = make_decision(
        score=score,
        dti_percent=dti,
        application_amount=application.amount,
        term_months=application.term_months,
        product=application.product,
        bki=bki,
        verification=verification,
        ai=ai_result,
        company=company,
    )
    set_decision(application, outcome.status, outcome.reason)
    set_approval(
        application,
        approved_amount=outcome.approved_amount,
        approved_term_months=outcome.approved_term_months,
        approved_rate=outcome.approved_rate,
        replace=True,
    )
    application.counter_offer_amount = outcome.counter_offer_amount
    transition(
        db,
        application,
        outcome.status,
        comment=outcome.reason,
    )

    await db.commit()
    logger.info(
        "Заявка #%s обработана: %s, скор %s, DTI %.1f%%",
        application.id,
        outcome.status,
        score,
        dti,
    )
    return application
