from dataclasses import dataclass
from enum import Enum
from typing import NamedTuple

from app.services.formatting import format_money
from app.services.scoring.ai_service import AICheckResult


class ScoreBoundaries(int, Enum):
    BASE_SCORE = 50
    MIN_SCORE = 0
    MAX_SCORE = 100


class FactorType(str, Enum):
    BASE = "base"
    REVENUE = "revenue"
    PROFIT = "profit"
    AGE = "age"
    BKI = "bki"
    OVERDUE = "overdue"
    DTI = "dti"
    AI = "ai"
    CAP = "cap"


class LabelType(str, Enum):
    BASE = "Базовая оценка"
    REVENUE = "Выручка"
    PROFIT = "Прибыль"
    AGE = "Возраст бизнеса"
    BKI = "Скор БКИ"
    OVERDUE = "Просрочки"
    DTI = "DTI"
    AI = "ИИ-проверка цели"
    CAP = "Ограничение 0–100"


@dataclass(slots=True)
class Factor:
    factor_type: FactorType
    label: LabelType
    value: str
    points: int
    description: str

    def to_dict(self) -> dict[str, object]:
        return {
            "factor": self.factor_type.value,
            "label": self.label.value,
            "value": self.value,
            "points": self.points,
            "description": self.description,
        }


class ProcessedValue(NamedTuple):
    points: int
    factor: Factor


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


def process_revenue(revenue: float) -> ProcessedValue:
    if revenue > 10_000_000:
        points = 20
        description = "Выручка по ГИР БО выше 10 млн ₽"
    elif revenue >= 1_000_000:
        points = 10
        description = "Выручка по ГИР БО от 1 до 10 млн ₽"
    else:
        points = -10
        description = "Выручка по ГИР БО менее 1 млн ₽"

    return ProcessedValue(
        points=points,
        factor=Factor(
            factor_type=FactorType.REVENUE,
            label=LabelType.REVENUE,
            value=format_money(revenue),
            points=points,
            description=description,
        ),
    )


def process_profit(profit: float) -> ProcessedValue:
    if profit > 0:
        points = 10
        description = "Компания прибыльна по данным ГИР БО"
    elif profit < 0:
        points = -20
        description = "Отрицательная прибыль по данным ГИР БО"
    else:
        points = 0
        description = "Нулевая прибыль по данным ГИР БО"

    return ProcessedValue(
        points=points,
        factor=Factor(
            factor_type=FactorType.PROFIT,
            label=LabelType.PROFIT,
            value=format_money(profit),
            points=points,
            description=description,
        ),
    )


def process_age(age: int) -> ProcessedValue:
    if age > 24:
        points = 10
        description = "Бизнес работает более 24 месяцев"
    elif age < 12:
        points = -15
        description = "Бизнес работает менее 12 месяцев"
    else:
        points = 0
        description = "Бизнес работает от 12 до 24 месяцев"

    return ProcessedValue(
        points=points,
        factor=Factor(
            factor_type=FactorType.AGE,
            label=LabelType.AGE,
            value=f"{age} мес.",
            points=points,
            description=description,
        ),
    )


def process_bki_score(bki_score: int) -> ProcessedValue:
    if bki_score > 700:
        points = 15
        description = "Высокий кредитный рейтинг"
    elif bki_score < 500:
        points = -20
        description = "Низкий кредитный рейтинг"
    else:
        points = 0
        description = "Средний кредитный рейтинг"

    return ProcessedValue(
        points=points,
        factor=Factor(
            factor_type=FactorType.BKI,
            label=LabelType.BKI,
            value=str(bki_score),
            points=points,
            description=description,
        ),
    )


def process_overdue_count(overdue_count: int) -> ProcessedValue:
    if overdue_count > 0:
        points = -30
        description = f"Найдено просрочек: {overdue_count}"
    else:
        points = 0
        description = "Просрочек не найдено"

    return ProcessedValue(
        points=points,
        factor=Factor(
            factor_type=FactorType.OVERDUE,
            label=LabelType.OVERDUE,
            value=str(overdue_count),
            points=points,
            description=description,
        ),
    )


def process_dti(dti: float) -> ProcessedValue:
    if dti < 30:
        points = 15
        description = "Низкая долговая нагрузка"
    elif dti > 50:
        points = -25
        description = "Высокая долговая нагрузка"
    else:
        points = 0
        description = "Умеренная долговая нагрузка"

    return ProcessedValue(
        points=points,
        factor=Factor(
            factor_type=FactorType.DTI,
            label=LabelType.DTI,
            value=f"{dti:.1f}%",
            points=points,
            description=description,
        ),
    )


def process_ai_result(ai_result: AICheckResult) -> ProcessedValue:
    if ai_result.is_valid:
        points = 10
        description = "Цель кредита соответствует ОКВЭД"
    else:
        points = -20
        description = "Цель кредита не соответствует ОКВЭД"

    return ProcessedValue(
        points=points,
        factor=Factor(
            factor_type=FactorType.AI,
            label=LabelType.AI,
            value=ai_result.comment,
            points=points,
            description=description,
        ),
    )
