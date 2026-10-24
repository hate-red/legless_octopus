"""Split companies into IP/OOO and extract application outcomes.

Revision ID: 0003_company_forms_outcomes
Revises: 0002_product_categories
Create Date: 2026-10-23

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0003_company_forms_outcomes"
down_revision: Union[str, None] = "0002_product_categories"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _company_common_columns() -> tuple[sa.Column, ...]:
    return (
        sa.Column("okved", sa.String(length=16), nullable=False),
        sa.Column("okved_name", sa.String(length=255), nullable=False),
        sa.Column("revenue", sa.Float(), nullable=False),
        sa.Column("declared_profit", sa.Float(), nullable=False),
        sa.Column("employees", sa.Integer(), nullable=False),
        sa.Column("business_age_months", sa.Integer(), nullable=False),
        sa.Column("has_overdue", sa.Boolean(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )


def _set_company_sequences() -> None:
    op.execute(
        "SELECT setval("
        "pg_get_serial_sequence('llc_companies', 'id'), "
        "COALESCE((SELECT MAX(id) FROM llc_companies), 1), "
        "(SELECT COUNT(*) > 0 FROM llc_companies)"
        ")"
    )
    op.execute(
        "SELECT setval("
        "pg_get_serial_sequence('individual_entrepreneurs', 'id'), "
        "COALESCE((SELECT MAX(id) FROM individual_entrepreneurs), 1), "
        "(SELECT COUNT(*) > 0 FROM individual_entrepreneurs)"
        ")"
    )


def upgrade() -> None:
    op.create_table(
        "individual_entrepreneurs",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("full_name", sa.String(length=255), nullable=False),
        sa.Column("inn", sa.String(length=12), nullable=False),
        sa.Column("ogrnip", sa.String(length=15), nullable=False),
        *_company_common_columns(),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id"),
    )
    op.create_index(
        "ix_individual_entrepreneurs_inn",
        "individual_entrepreneurs",
        ["inn"],
        unique=True,
    )

    op.create_table(
        "llc_companies",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("inn", sa.String(length=12), nullable=False),
        sa.Column("ogrn", sa.String(length=13), nullable=False),
        *_company_common_columns(),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id"),
    )
    op.create_index(
        "ix_llc_companies_inn",
        "llc_companies",
        ["inn"],
        unique=True,
    )

    bind = op.get_bind()
    total = bind.execute(sa.text("SELECT COUNT(*) FROM companies")).scalar_one()
    ooo_count = bind.execute(
        sa.text("SELECT COUNT(*) FROM companies WHERE char_length(ogrn) = 13")
    ).scalar_one()
    ip_count = bind.execute(
        sa.text("SELECT COUNT(*) FROM companies WHERE char_length(ogrn) = 15")
    ).scalar_one()
    if total != ooo_count + ip_count:
        raise RuntimeError(
            "Не удалось определить правовую форму всех компаний: "
            f"всего {total}, ООО {ooo_count}, ИП {ip_count}"
        )

    op.execute(
        """
        INSERT INTO llc_companies
            (id, user_id, name, inn, ogrn, okved, okved_name, revenue,
             declared_profit, employees, business_age_months, has_overdue,
             created_at)
        SELECT
            id, user_id, name, inn, ogrn, okved, okved_name, revenue,
            declared_profit, employees, business_age_months, has_overdue,
            created_at
        FROM companies
        WHERE char_length(ogrn) = 13
        """
    )
    op.execute(
        """
        INSERT INTO individual_entrepreneurs
            (id, user_id, full_name, inn, ogrnip, okved, okved_name, revenue,
             declared_profit, employees, business_age_months, has_overdue,
             created_at)
        SELECT
            id, user_id, name, inn, ogrn, okved, okved_name, revenue,
            declared_profit, employees, business_age_months, has_overdue,
            created_at
        FROM companies
        WHERE char_length(ogrn) = 15
        """
    )
    _set_company_sequences()

    op.drop_index("ix_companies_inn", table_name="companies")
    op.drop_table("companies")

    op.create_table(
        "application_decisions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("application_id", sa.Integer(), nullable=False),
        sa.Column("decision", sa.String(length=32), nullable=False),
        sa.Column("decision_reason", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["application_id"], ["applications.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("application_id"),
    )

    op.create_table(
        "application_approvals",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("application_id", sa.Integer(), nullable=False),
        sa.Column("approved_amount", sa.Float(), nullable=True),
        sa.Column("approved_term_months", sa.Integer(), nullable=True),
        sa.Column("approved_rate", sa.Float(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["application_id"], ["applications.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("application_id"),
    )

    reason_without_decision = bind.execute(
        sa.text(
            "SELECT COUNT(*) FROM applications "
            "WHERE decision IS NULL AND decision_reason IS NOT NULL"
        )
    ).scalar_one()
    if reason_without_decision:
        raise RuntimeError(
            "Найдены заявки с decision_reason без decision — "
            "миграция остановлена"
        )

    op.execute(
        """
        INSERT INTO application_decisions
            (application_id, decision, decision_reason)
        SELECT id, decision, decision_reason
        FROM applications
        WHERE decision IS NOT NULL
        """
    )
    op.execute(
        """
        INSERT INTO application_approvals
            (application_id, approved_amount, approved_term_months,
             approved_rate)
        SELECT id, approved_amount, approved_term_months, approved_rate
        FROM applications
        WHERE approved_amount IS NOT NULL
           OR approved_term_months IS NOT NULL
           OR approved_rate IS NOT NULL
        """
    )

    op.drop_column("applications", "decision")
    op.drop_column("applications", "decision_reason")
    op.drop_column("applications", "approved_amount")
    op.drop_column("applications", "approved_term_months")
    op.drop_column("applications", "approved_rate")


def downgrade() -> None:
    op.add_column(
        "applications", sa.Column("decision", sa.String(length=32), nullable=True)
    )
    op.add_column(
        "applications", sa.Column("decision_reason", sa.Text(), nullable=True)
    )
    op.add_column(
        "applications", sa.Column("approved_amount", sa.Float(), nullable=True)
    )
    op.add_column(
        "applications",
        sa.Column("approved_term_months", sa.Integer(), nullable=True),
    )
    op.add_column(
        "applications", sa.Column("approved_rate", sa.Float(), nullable=True)
    )

    op.execute(
        """
        UPDATE applications AS a
        SET decision = d.decision,
            decision_reason = d.decision_reason
        FROM application_decisions AS d
        WHERE d.application_id = a.id
        """
    )
    op.execute(
        """
        UPDATE applications AS a
        SET approved_amount = ap.approved_amount,
            approved_term_months = ap.approved_term_months,
            approved_rate = ap.approved_rate
        FROM application_approvals AS ap
        WHERE ap.application_id = a.id
        """
    )

    op.drop_table("application_approvals")
    op.drop_table("application_decisions")

    op.create_table(
        "companies",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("inn", sa.String(length=12), nullable=False),
        sa.Column("ogrn", sa.String(length=15), nullable=False),
        *_company_common_columns(),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id"),
    )
    op.create_index("ix_companies_inn", "companies", ["inn"], unique=True)

    bind = op.get_bind()
    duplicate_profiles = bind.execute(
        sa.text(
            "SELECT COUNT(*) FROM ("
            "  SELECT user_id FROM llc_companies"
            "  UNION ALL"
            "  SELECT user_id FROM individual_entrepreneurs"
            ") AS profiles GROUP BY user_id HAVING COUNT(*) > 1"
        )
    ).scalar()
    if duplicate_profiles:
        raise RuntimeError(
            "Нельзя выполнить downgrade: у пользователя есть профили ИП и ООО"
        )

    op.execute(
        """
        INSERT INTO companies
            (user_id, name, inn, ogrn, okved, okved_name, revenue,
             declared_profit, employees, business_age_months, has_overdue,
             created_at)
        SELECT
            user_id, name, inn, ogrn, okved, okved_name, revenue,
            declared_profit, employees, business_age_months, has_overdue,
            created_at
        FROM llc_companies
        """
    )
    op.execute(
        """
        INSERT INTO companies
            (user_id, name, inn, ogrn, okved, okved_name, revenue,
             declared_profit, employees, business_age_months, has_overdue,
             created_at)
        SELECT
            user_id, full_name, inn, ogrnip, okved, okved_name, revenue,
            declared_profit, employees, business_age_months, has_overdue,
            created_at
        FROM individual_entrepreneurs
        """
    )

    op.drop_index(
        "ix_llc_companies_inn", table_name="llc_companies"
    )
    op.drop_table("llc_companies")
    op.drop_index(
        "ix_individual_entrepreneurs_inn",
        table_name="individual_entrepreneurs",
    )
    op.drop_table("individual_entrepreneurs")
