from app.models import (
    BKICheck,
    FinancialVerification,
    IndividualEntrepreneur,
    LLCCompany
)
from app.services.scoring.ai_service import AICheckResult

from app.services.scoring.processing_utils import (
    Factor, 
    ScoreBoundaries, 
    FactorType, 
    LabelType, 
)
import app.services.scoring.processing_utils as utils

def calculate_score(
    *,
    company: IndividualEntrepreneur | LLCCompany,
    verification: FinancialVerification,
    bki: BKICheck,
    ai_result: AICheckResult,
    amount: float,
    term_months: int,
) -> tuple[int, list[Factor], float]:
    """Apply the scoring formula. Returns score, factors, DTI."""
    factors: list[Factor] = []
    raw_score = ScoreBoundaries.BASE_SCORE
    
    dti, _ = utils.calculate_dti(
        amount=amount,
        term_months=term_months,
        official_revenue=verification.official_revenue,
        monthly_payments=bki.monthly_payments,
    )

    value_func_mapping = [
        (verification.official_revenue, utils.process_revenue),
        (verification.official_profit, utils.process_profit),
        (company.business_age_months, utils.process_age),
        (bki.bki_score, utils.process_bki_score),
        (bki.overdue_count, utils.process_overdue_count),
        (dti, utils.process_dti),
        (ai_result, utils.process_ai_result),
    ]

    for value, func in value_func_mapping:
        points, factor = func(value)
        
        raw_score += points
        factors.append(factor)
    
    score = max(ScoreBoundaries.MIN_SCORE, min(ScoreBoundaries.MAX_SCORE, raw_score))
    if score != raw_score:
        factors.append(Factor(
            factor_type=FactorType.CAP,
            label=LabelType.CAP,
            value=f"{raw_score} -> {score}",
            points=score - raw_score,
            description = f"Итоговый скор ограничен диапазоном "
                          f"{ScoreBoundaries.MIN_SCORE}–{ScoreBoundaries.MAX_SCORE}"
        ))

    return score, factors, dti
