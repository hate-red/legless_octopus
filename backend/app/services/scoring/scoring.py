from app.services.scoring.utils import ScoringGrade
from app.schemas import (
    CompanyOut, 
    FinancialVerificationOut,
    BKICheckOut,
    ApplicationListItem
)


def is_purpose_relative(
    company: CompanyOut, 
    financial_verification: FinancialVerificationOut,
    bki_check: BKICheckOut,
    application: ApplicationListItem,
) -> bool:
    


def calc_raw_scoring() -> float:
    ...


def map_scoring(raw_scoring: float) -> ScoringGrade:
    ...


def get_scoring() -> tuple[float, ScoringGrade]:
    raw_scoring = calc_raw_scoring()
    final_scoring = map_scoring(raw_scoring)
    
    return raw_scoring, final_scoring
