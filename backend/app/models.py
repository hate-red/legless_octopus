from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(16), nullable=False, default="client")
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    company: Mapped["Company | None"] = relationship(
        back_populates="user",
        uselist=False,
        cascade="all, delete-orphan",
        lazy="selectin",
    )
    applications: Mapped[list["Application"]] = relationship(
        back_populates="client",
        cascade="all, delete-orphan",
        foreign_keys="Application.client_id",
    )


class Company(Base):
    __tablename__ = "companies"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    inn: Mapped[str] = mapped_column(String(12), unique=True, index=True, nullable=False)
    ogrn: Mapped[str] = mapped_column(String(15), nullable=False)
    okved: Mapped[str] = mapped_column(String(16), nullable=False)
    okved_name: Mapped[str] = mapped_column(String(255), nullable=False)
    revenue: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    declared_profit: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    employees: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    business_age_months: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    has_overdue: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    user: Mapped["User"] = relationship(back_populates="company")


class Product(Base):
    __tablename__ = "products"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    code: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    min_amount: Mapped[float] = mapped_column(Float, nullable=False)
    max_amount: Mapped[float] = mapped_column(Float, nullable=False)
    min_term_months: Mapped[int] = mapped_column(Integer, nullable=False)
    max_term_months: Mapped[int] = mapped_column(Integer, nullable=False)
    base_rate: Mapped[float] = mapped_column(Float, nullable=False)
    collateral_required: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False
    )
    repayment_type: Mapped[str] = mapped_column(
        String(32), nullable=False, default="annuity"
    )
    is_revolving: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False
    )
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    applications: Mapped[list["Application"]] = relationship(back_populates="product")


class Application(Base):
    __tablename__ = "applications"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    client_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    product_id: Mapped[int] = mapped_column(
        ForeignKey("products.id", ondelete="RESTRICT"), index=True, nullable=False
    )
    amount: Mapped[float] = mapped_column(Float, nullable=False)
    term_months: Mapped[int] = mapped_column(Integer, nullable=False)
    purpose: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(
        String(32), nullable=False, default="DRAFT", index=True
    )
    score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    decision: Mapped[str | None] = mapped_column(String(32), nullable=True)
    decision_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    approved_amount: Mapped[float | None] = mapped_column(Float, nullable=True)
    approved_term_months: Mapped[int | None] = mapped_column(Integer, nullable=True)
    approved_rate: Mapped[float | None] = mapped_column(Float, nullable=True)
    counter_offer_amount: Mapped[float | None] = mapped_column(Float, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=utcnow,
        nullable=False,
    )
    submitted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    client: Mapped["User"] = relationship(
        back_populates="applications", foreign_keys=[client_id], lazy="selectin"
    )
    product: Mapped["Product"] = relationship(
        back_populates="applications", lazy="selectin"
    )
    financial_verification: Mapped["FinancialVerification | None"] = relationship(
        back_populates="application",
        uselist=False,
        cascade="all, delete-orphan",
        lazy="selectin",
    )
    bki_check: Mapped["BKICheck | None"] = relationship(
        back_populates="application",
        uselist=False,
        cascade="all, delete-orphan",
        lazy="selectin",
    )
    ai_check: Mapped["AICheck | None"] = relationship(
        back_populates="application",
        uselist=False,
        cascade="all, delete-orphan",
        lazy="selectin",
    )
    scoring_result: Mapped["ScoringResult | None"] = relationship(
        back_populates="application",
        uselist=False,
        cascade="all, delete-orphan",
        lazy="selectin",
    )
    status_history: Mapped[list["StatusHistory"]] = relationship(
        back_populates="application",
        cascade="all, delete-orphan",
        order_by="StatusHistory.created_at, StatusHistory.id",
        lazy="selectin",
    )

    __table_args__ = (
        Index("ix_applications_status_created", "status", "created_at"),
    )


class FinancialVerification(Base):
    __tablename__ = "financial_verifications"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    application_id: Mapped[int] = mapped_column(
        ForeignKey("applications.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    official_revenue: Mapped[float] = mapped_column(Float, nullable=False)
    official_profit: Mapped[float] = mapped_column(Float, nullable=False)
    revenue_diff_pct: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    profit_diff_pct: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    flags: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)

    application: Mapped["Application"] = relationship(
        back_populates="financial_verification"
    )


class BKICheck(Base):
    __tablename__ = "bki_checks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    application_id: Mapped[int] = mapped_column(
        ForeignKey("applications.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    bki_score: Mapped[int] = mapped_column(Integer, nullable=False)
    active_loans: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    monthly_payments: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    overdue_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    payment_discipline_pct: Mapped[float] = mapped_column(
        Float, nullable=False, default=100.0
    )

    application: Mapped["Application"] = relationship(back_populates="bki_check")


class AICheck(Base):
    __tablename__ = "ai_checks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    application_id: Mapped[int] = mapped_column(
        ForeignKey("applications.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    is_purpose_valid: Mapped[bool] = mapped_column(Boolean, nullable=False)
    ai_comment: Mapped[str] = mapped_column(Text, nullable=False)
    similarity_score: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)

    application: Mapped["Application"] = relationship(back_populates="ai_check")


class ScoringResult(Base):
    __tablename__ = "scoring_results"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    application_id: Mapped[int] = mapped_column(
        ForeignKey("applications.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    score: Mapped[int] = mapped_column(Integer, nullable=False)
    factors: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    dti_percent: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)

    application: Mapped["Application"] = relationship(back_populates="scoring_result")


class StatusHistory(Base):
    __tablename__ = "status_history"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    application_id: Mapped[int] = mapped_column(
        ForeignKey("applications.id", ondelete="CASCADE"), index=True, nullable=False
    )
    status: Mapped[str] = mapped_column(String(32), nullable=False)
    comment: Mapped[str] = mapped_column(Text, nullable=False, default="")
    actor_role: Mapped[str] = mapped_column(String(16), nullable=False, default="system")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    application: Mapped["Application"] = relationship(back_populates="status_history")
