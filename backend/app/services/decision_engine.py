"""Decision Engine: hard overrides, score thresholds and counter-offer sizing."""

from __future__ import annotations

from dataclasses import dataclass
from math import floor

from app.constants import (
    STATUS_APPROVED,
    STATUS_COUNTER_OFFER,
    STATUS_MANUAL_REVIEW,
    STATUS_REJECTED,
)
from app.models import (
    BKICheck,
    FinancialVerification,
    IndividualEntrepreneur,
    LLCCompany,
    Product,
)
from app.services.formatting import format_money
from app.services.scoring.ai_service import AICheckResult


@dataclass(slots=True)
class DecisionOutcome:
    status: str
    reason: str
    approved_amount: float | None = None
    approved_term_months: int | None = None
    approved_rate: float | None = None
    counter_offer_amount: float | None = None


def calculate_comfortable_amount(
    *,
    official_revenue: float,
    monthly_payments: float,
    term_months: int,
) -> float:
    monthly_revenue = official_revenue / 12
    max_monthly_payment = monthly_revenue * 0.5 - monthly_payments
    if max_monthly_payment <= 0:
        return 0.0
    raw = (max_monthly_payment * term_months) / 1.2
    # Round down to a "round" amount so DTI stays within the comfort zone.
    return float(floor(raw / 10_000) * 10_000)


def make_decision(
    *,
    score: int,
    dti_percent: float,
    application_amount: float,
    term_months: int,
    product: Product,
    bki: BKICheck,
    verification: FinancialVerification,
    ai: AICheckResult,
    company: LLCCompany | IndividualEntrepreneur,
) -> DecisionOutcome:
    # 1. Hard overrides -------------------------------------------------------
    if bki.overdue_count > 0:
        return DecisionOutcome(
            status=STATUS_REJECTED,
            reason=(
                "Жёсткая блокировка: обнаружены просрочки по действующим "
                f"обязательствам ({bki.overdue_count}). Кредитование невозможно."
            ),
        )

    if verification.official_profit < 0:
        return DecisionOutcome(
            status=STATUS_MANUAL_REVIEW,
            reason=(
                "Жёсткая блокировка: отрицательная официальная прибыль по ГИР БО "
                f"({format_money(verification.official_profit)}). Требуется ручная проверка."
            ),
        )

    if not ai.is_valid:
        return DecisionOutcome(
            status=STATUS_MANUAL_REVIEW,
            reason=(
                "Жёсткая блокировка: ИИ-проверка не подтвердила соответствие цели "
                "кредита профилю ОКВЭД. Требуется ручная проверка."
            ),
        )

    # 2. Score bands ----------------------------------------------------------
    if score >= 75:
        return DecisionOutcome(
            status=STATUS_APPROVED,
            reason=(
                f"Заявка одобрена автоматически: скор {score}, DTI {dti_percent:.1f}%. "
                "Все обязательные проверки пройдены."
            ),
            approved_amount=application_amount,
            approved_term_months=term_months,
            approved_rate=product.base_rate,
        )

    if score >= 50:
        comfortable = calculate_comfortable_amount(
            official_revenue=verification.official_revenue,
            monthly_payments=bki.monthly_payments,
            term_months=term_months,
        )
        comfortable = min(comfortable, application_amount)
        if comfortable < product.min_amount:
            return DecisionOutcome(
                status=STATUS_REJECTED,
                reason=(
                    "Недостаточная кредитоспособность: комфортная сумма "
                    f"{format_money(comfortable)} ниже минимальной суммы продукта "
                    f"{format_money(product.min_amount)}."
                ),
            )
        return DecisionOutcome(
            status=STATUS_COUNTER_OFFER,
            reason=(
                f"Скор {score}, DTI по запрошенной сумме {dti_percent:.1f}%. "
                "Банк готов одобрить кредит на комфортную сумму "
                f"{format_money(comfortable)}."
            ),
            approved_term_months=term_months,
            approved_rate=round(product.base_rate + 1.0, 1),
            counter_offer_amount=comfortable,
        )

    if score >= 30:
        return DecisionOutcome(
            status=STATUS_MANUAL_REVIEW,
            reason=(
                f"Спорный кейс: скор {score}, DTI {dti_percent:.1f}%. "
                "Заявка направлена менеджеру для дополнительной проверки."
            ),
        )

    return DecisionOutcome(
        status=STATUS_REJECTED,
        reason=(
            f"Недостаточный уровень скоринга: {score} из 100 при пороге 30. "
            f"DTI {dti_percent:.1f}%."
        ),
    )
