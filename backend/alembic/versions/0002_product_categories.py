"""Product categories and repayment terms.

Revision ID: 0002_product_categories
Revises: 0001_initial
Create Date: 2026-10-22
"""

from alembic import op
import sqlalchemy as sa

revision = "0002_product_categories"
down_revision = "0001_initial"
branch_labels = None
depends_on = None


CATALOG = [
    {
        "old": {
            "code": "WORKING_CAPITAL",
            "name": "Пополнение оборотных средств",
            "description": (
                "Кредит на закупку товара, сырья и материалов, выплату зарплат "
                "и другие текущие расходы бизнеса. Без залога до 5 млн ₽."
            ),
            "min_amount": 100_000,
            "max_amount": 5_000_000,
            "min_term_months": 6,
            "max_term_months": 36,
            "base_rate": 19.9,
            "collateral_required": False,
            "repayment_type": "annuity",
            "is_revolving": False,
        },
        "new": {
            "code": "UNSECURED",
            "name": "Без залога",
            "description": (
                "Кредит на текущие задачи бизнеса без обеспечения: закупку "
                "товара и материалов, выплаты, ремонт и другие расходы. "
                "До 5 млн ₽ на срок до 3 лет."
            ),
            "min_amount": 100_000,
            "max_amount": 5_000_000,
            "min_term_months": 6,
            "max_term_months": 36,
            "base_rate": 19.9,
            "collateral_required": False,
            "repayment_type": "annuity",
            "is_revolving": False,
        },
    },
    {
        "old": {
            "code": "EQUIPMENT",
            "name": "Кредит на оборудование",
            "description": (
                "Инвестиционный кредит на покупку техники, серверов, "
                "производственных линий и оборудования. До 10 млн ₽ "
                "на срок до 5 лет."
            ),
            "min_amount": 300_000,
            "max_amount": 10_000_000,
            "min_term_months": 12,
            "max_term_months": 60,
            "base_rate": 17.5,
            "collateral_required": False,
            "repayment_type": "annuity",
            "is_revolving": False,
        },
        "new": {
            "code": "SECURED",
            "name": "С залогом",
            "description": (
                "Инвестиционный кредит под залог оборудования, техники или "
                "недвижимости. До 10 млн ₽ на срок до 5 лет и ставка ниже, "
                "чем без обеспечения."
            ),
            "min_amount": 300_000,
            "max_amount": 10_000_000,
            "min_term_months": 12,
            "max_term_months": 60,
            "base_rate": 17.5,
            "collateral_required": True,
            "repayment_type": "annuity",
            "is_revolving": False,
        },
    },
    {
        "old": {
            "code": "EXPRESS",
            "name": "Экспресс-кредит",
            "description": (
                "Быстрое решение и деньги на счёт за один день. Для небольших "
                "задач и кассовых разрывов. До 1 млн ₽ на срок до 12 месяцев."
            ),
            "min_amount": 50_000,
            "max_amount": 1_000_000,
            "min_term_months": 3,
            "max_term_months": 12,
            "base_rate": 22.9,
            "collateral_required": False,
            "repayment_type": "annuity",
            "is_revolving": False,
        },
        "new": {
            "code": "CREDIT_LINE",
            "name": "Кредитная линия",
            "description": (
                "Возобновляемый лимит для регулярных закупок и кассовых "
                "разрывов. Средства можно выбирать частями в пределах лимита "
                "и возвращать по графику."
            ),
            "min_amount": 300_000,
            "max_amount": 5_000_000,
            "min_term_months": 12,
            "max_term_months": 36,
            "base_rate": 18.9,
            "collateral_required": False,
            "repayment_type": "differentiated",
            "is_revolving": True,
        },
    },
]


def _update_products(*, upgrade: bool) -> None:
    bind = op.get_bind()
    statement = sa.text(
        """
        UPDATE products
        SET code = :code,
            name = :name,
            description = :description,
            min_amount = :min_amount,
            max_amount = :max_amount,
            min_term_months = :min_term_months,
            max_term_months = :max_term_months,
            base_rate = :base_rate,
            collateral_required = :collateral_required,
            repayment_type = :repayment_type,
            is_revolving = :is_revolving
        WHERE code = :source_code
        """
    )
    for item in CATALOG:
        source = item["old"] if upgrade else item["new"]
        target = item["new"] if upgrade else item["old"]
        bind.execute(
            statement,
            {
                **target,
                "source_code": source["code"],
            },
        )


def upgrade() -> None:
    op.add_column(
        "products",
        sa.Column(
            "collateral_required",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )
    op.add_column(
        "products",
        sa.Column(
            "repayment_type",
            sa.String(length=32),
            nullable=False,
            server_default="annuity",
        ),
    )
    op.add_column(
        "products",
        sa.Column(
            "is_revolving",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )
    _update_products(upgrade=True)


def downgrade() -> None:
    _update_products(upgrade=False)
    op.drop_column("products", "is_revolving")
    op.drop_column("products", "repayment_type")
    op.drop_column("products", "collateral_required")
