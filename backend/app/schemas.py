from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator, model_validator


class OkvedOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    code: str
    name: str


class CompanyOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    legal_form: Literal["IP", "OOO"]
    name: str
    inn: str
    ogrn: str
    okved: OkvedOut
    revenue: float
    declared_profit: float
    employees: int
    business_age_months: int
    has_overdue: bool
    details: dict[str, str] = Field(default_factory=dict)

    @field_validator("details", mode="before")
    @classmethod
    def empty_details(cls, value):
        # SQLAlchemy column defaults are applied on insert, not construction.
        return {} if value is None else value


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: EmailStr
    role: str
    full_name: str
    company: CompanyOut | None = None


class LoginRequest(BaseModel):
    email: EmailStr | None = None
    inn: str | None = Field(default=None, pattern=r"^(\d{10}|\d{12})$")
    password: str = Field(min_length=1, max_length=128)

    @model_validator(mode="after")
    def validate_identifier(self):
        if bool(self.email) == bool(self.inn):
            raise ValueError("Укажите email или ИНН")
        return self


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class ProductOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    code: str
    name: str
    description: str
    min_amount: float
    max_amount: float
    min_term_months: int
    max_term_months: int
    base_rate: float
    collateral_required: bool
    repayment_type: Literal["annuity", "differentiated"]
    is_revolving: bool


class ApplicationCreate(BaseModel):
    product_id: int
    amount: float = Field(gt=0)
    term_months: int = Field(gt=0, le=120)
    purpose: str = Field(min_length=5, max_length=1000)


class ApplicationUpdate(BaseModel):
    product_id: int | None = None
    amount: float | None = Field(default=None, gt=0)
    term_months: int | None = Field(default=None, gt=0, le=120)
    purpose: str | None = Field(default=None, min_length=5, max_length=1000)


class ClientProfileOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: EmailStr
    full_name: str
    company: CompanyOut | None = None


class FinancialVerificationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    official_revenue: float
    official_profit: float
    revenue_diff_pct: float
    profit_diff_pct: float
    flags: list[str]


class BKICheckOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    bki_score: int
    active_loans: int
    monthly_payments: float
    overdue_count: int
    payment_discipline_pct: float


class AICheckOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    is_purpose_valid: bool
    ai_comment: str
    similarity_score: float


class ScoringFactorOut(BaseModel):
    factor: str
    label: str
    value: str
    points: int
    description: str


class ScoringResultOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    score: int = Field(ge=0, le=100)
    dti_percent: float
    factors: list[ScoringFactorOut]


class StatusHistoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    status: str
    comment: str
    actor_role: str
    created_at: datetime


class DecisionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    decision: str
    decision_reason: str | None


class ApprovalOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    approved_amount: float | None
    approved_term_months: int | None
    approved_rate: float | None


class ApplicationListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    product: ProductOut
    client: ClientProfileOut
    amount: float
    term_months: int
    purpose: str
    status: str
    score: int | None = Field(default=None, ge=0, le=100)
    decision: DecisionOut | None = None
    approval: ApprovalOut | None = None
    counter_offer_amount: float | None
    created_at: datetime
    updated_at: datetime
    submitted_at: datetime | None
    documents_confirmed_at: datetime | None = None


class ApplicationDetail(ApplicationListItem):
    financial_verification: FinancialVerificationOut | None = None
    bki_check: BKICheckOut | None = None
    ai_check: AICheckOut | None = None
    scoring_result: ScoringResultOut | None = None
    status_history: list[StatusHistoryOut] = Field(default_factory=list)


class BankDecisionRequest(BaseModel):
    decision: Literal["APPROVED", "REJECTED", "MANUAL_REVIEW"]
    comment: str = Field(default="", max_length=2000)
    approved_amount: float | None = Field(default=None, gt=0)
    approved_term_months: int | None = Field(default=None, gt=0, le=120)
    approved_rate: float | None = Field(default=None, gt=0, le=100)


class CounterOfferDeclineRequest(BaseModel):
    comment: str = Field(default="", max_length=2000)


class MessageResponse(BaseModel):
    message: str
