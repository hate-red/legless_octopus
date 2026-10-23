from app.models import BKICheck, Company, FinancialVerification
from app.services.ai_service import AICheckResult


BASE_SCORE = 50
MIN_SCORE = 0
MAX_SCORE = 100


def calculate_dti(
    *,
    amount: float,
    term_months: int,
    official_revenue: float,
    monthly_payments: float,
) -> tuple[float, float]:
    """Return (DTI percent, new monthly payment)."""
    if term_months <= 0:
        return 999.0, 0.0
    new_payment = (amount / term_months) * 1.2
    monthly_revenue = official_revenue / 12
    if monthly_revenue <= 0:
        return 999.0, round(new_payment, 2)
    dti = (monthly_payments + new_payment) / monthly_revenue * 100
    return round(dti, 1), round(new_payment, 2)


def _money(value: float) -> str:
    return f"{value:,.0f}".replace(",", " ") + " ₽"


def calculate_score(
    *,
    company: Company,
    verification: FinancialVerification,
    bki: BKICheck,
    ai: AICheckResult,
    amount: float,
    term_months: int,
) -> tuple[int, list[dict], float]:
    """Apply the hackathon scoring formula. Returns score, factors, DTI."""
    factors: list[dict] = [
        {
            "factor": "base",
            "label": "Базовая оценка",
            "value": "—",
            "points": BASE_SCORE,
            "description": "Стартовое значение скоринговой модели",
        }
    ]
    raw_score = BASE_SCORE

    revenue = verification.official_revenue
    if revenue > 10_000_000:
        points = 20
        description = "Выручка по ГИР БО выше 10 млн ₽"
    elif revenue >= 1_000_000:
        points = 10
        description = "Выручка по ГИР БО от 1 до 10 млн ₽"
    else:
        points = -10
        description = "Выручка по ГИР БО менее 1 млн ₽"
    raw_score += points
    factors.append(
        {
            "factor": "revenue",
            "label": "Выручка",
            "value": _money(revenue),
            "points": points,
            "description": description,
        }
    )

    profit = verification.official_profit
    if profit > 0:
        points = 10
        description = "Компания прибыльна по данным ГИР БО"
    elif profit < 0:
        points = -20
        description = "Отрицательная прибыль по данным ГИР БО"
    else:
        points = 0
        description = "Нулевая прибыль по данным ГИР БО"
    raw_score += points
    factors.append(
        {
            "factor": "profit",
            "label": "Прибыль",
            "value": _money(profit),
            "points": points,
            "description": description,
        }
    )

    age = company.business_age_months
    if age > 24:
        points = 10
        description = "Бизнес работает более 24 месяцев"
    elif age < 12:
        points = -15
        description = "Бизнес работает менее 12 месяцев"
    else:
        points = 0
        description = "Бизнес работает от 12 до 24 месяцев"
    raw_score += points
    factors.append(
        {
            "factor": "age",
            "label": "Возраст бизнеса",
            "value": f"{age} мес.",
            "points": points,
            "description": description,
        }
    )

    bki_score = bki.bki_score
    if bki_score > 700:
        points = 15
        description = "Высокий кредитный рейтинг"
    elif bki_score < 500:
        points = -20
        description = "Низкий кредитный рейтинг"
    else:
        points = 0
        description = "Средний кредитный рейтинг"
    raw_score += points
    factors.append(
        {
            "factor": "bki",
            "label": "Скор БКИ",
            "value": str(bki_score),
            "points": points,
            "description": description,
        }
    )

    if bki.overdue_count > 0:
        points = -30
        description = f"Найдено просрочек: {bki.overdue_count}"
    else:
        points = 0
        description = "Просрочек не найдено"
    raw_score += points
    factors.append(
        {
            "factor": "overdue",
            "label": "Просрочки",
            "value": str(bki.overdue_count),
            "points": points,
            "description": description,
        }
    )

    dti, new_payment = calculate_dti(
        amount=amount,
        term_months=term_months,
        official_revenue=revenue,
        monthly_payments=bki.monthly_payments,
    )
    if dti < 30:
        points = 15
        description = "Низкая долговая нагрузка"
    elif dti > 50:
        points = -25
        description = "Высокая долговая нагрузка"
    else:
        points = 0
        description = "Умеренная долговая нагрузка"
    raw_score += points
    factors.append(
        {
            "factor": "dti",
            "label": "DTI",
            "value": f"{dti:.1f}%",
            "points": points,
            "description": f"{description}. Новый платёж: {_money(new_payment)}",
        }
    )

    if ai.is_valid:
        points = 10
        description = "Цель кредита соответствует ОКВЭД"
    else:
        points = -20
        description = "Цель кредита не соответствует ОКВЭД"
    raw_score += points
    factors.append(
        {
            "factor": "ai",
            "label": "ИИ-проверка цели",
            "value": f"{ai.similarity_score * 100:.0f}%",
            "points": points,
            "description": description,
        }
    )

    score = max(MIN_SCORE, min(MAX_SCORE, raw_score))
    if score != raw_score:
        factors.append(
            {
                "factor": "cap",
                "label": f"Ограничение {MIN_SCORE}–{MAX_SCORE}",
                "value": f"{raw_score} → {score}",
                "points": score - raw_score,
                "description": (
                    f"Итоговый скор ограничен диапазоном {MIN_SCORE}–{MAX_SCORE}"
                ),
            }
        )

    return score, factors, dti
