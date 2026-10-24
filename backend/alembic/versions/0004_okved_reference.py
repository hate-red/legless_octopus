"""Extract OKVED codes into a shared reference table.

Revision ID: 0004_okved_reference
Revises: 0003_company_forms_outcomes
Create Date: 2026-10-24

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0004_okved_reference"
down_revision: Union[str, None] = "0003_company_forms_outcomes"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


_COMPANY_TABLES = ("llc_companies", "individual_entrepreneurs")

_KNOWN_OKVEDS = (
    ("62.01", "Разработка компьютерного программного обеспечения"),
    (
        "47.11",
        "Торговля розничная преимущественно пищевыми продуктами, "
        "включая напитки, и табачными изделиями "
        "в неспециализированных магазинах",
    ),
    ("46.90", "Торговля оптовая неспециализированная"),
    ("43.21", "Производство электромонтажных работ"),
    ("49.41", "Деятельность автомобильного грузового транспорта"),
    ("71.11", "Деятельность в области архитектуры"),
)


def _source_rows_sql() -> str:
    return (
        "SELECT btrim(okved) AS code, btrim(okved_name) AS name "
        "FROM llc_companies "
        "UNION ALL "
        "SELECT btrim(okved) AS code, btrim(okved_name) AS name "
        "FROM individual_entrepreneurs"
    )


def upgrade() -> None:
    op.create_table(
        "okveds",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("code", sa.String(length=16), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_okveds_code", "okveds", ["code"], unique=True)

    for table in _COMPANY_TABLES:
        op.add_column(
            table, sa.Column("okved_id", sa.Integer(), nullable=True)
        )

    bind = op.get_bind()
    invalid = bind.execute(
        sa.text(
            f"SELECT COUNT(*) FROM ({_source_rows_sql()}) AS source "
            "WHERE code IS NULL OR code = '' "
            "OR name IS NULL OR name = ''"
        )
    ).scalar_one()
    if invalid:
        raise RuntimeError(
            "Нельзя выполнить миграцию: у компании пустой код или "
            f"название ОКВЭД ({invalid} записей)"
        )

    conflicts = bind.execute(
        sa.text(
            f"SELECT code FROM ({_source_rows_sql()}) AS source "
            "GROUP BY code HAVING COUNT(DISTINCT name) > 1"
        )
    ).scalars().all()
    if conflicts:
        raise RuntimeError(
            "Нельзя выполнить миграцию: один код ОКВЭД используется "
            f"с разными названиями: {', '.join(conflicts)}"
        )

    op.execute(
        f"""
        INSERT INTO okveds (code, name)
        SELECT DISTINCT ON (code) code, name
        FROM ({_source_rows_sql()}) AS source
        ORDER BY code, name
        """
    )

    values = ", ".join(
        "('{}', '{}')".format(
            code.replace("'", "''"), name.replace("'", "''")
        )
        for code, name in _KNOWN_OKVEDS
    )
    op.execute(
        f"INSERT INTO okveds (code, name) VALUES {values} "
        "ON CONFLICT (code) DO NOTHING"
    )

    for table in _COMPANY_TABLES:
        op.execute(
            f"""
            UPDATE {table} AS company
            SET okved_id = okved.id
            FROM okveds AS okved
            WHERE okved.code = btrim(company.okved)
            """
        )

    remaining = bind.execute(
        sa.text(
            "SELECT COUNT(*) FROM ("
            "  SELECT id FROM llc_companies WHERE okved_id IS NULL"
            "  UNION ALL"
            "  SELECT id FROM individual_entrepreneurs WHERE okved_id IS NULL"
            ") AS missing"
        )
    ).scalar_one()
    if remaining:
        raise RuntimeError(
            "Нельзя выполнить миграцию: не всем компаниям сопоставлен ОКВЭД "
            f"({remaining} записей)"
        )

    for table in _COMPANY_TABLES:
        op.alter_column(
            table,
            "okved_id",
            existing_type=sa.Integer(),
            nullable=False,
        )
        op.create_foreign_key(
            f"fk_{table}_okved_id",
            table,
            "okveds",
            ["okved_id"],
            ["id"],
            ondelete="RESTRICT",
        )
        op.create_index(
            f"ix_{table}_okved_id",
            table,
            ["okved_id"],
        )

    for table in _COMPANY_TABLES:
        op.drop_column(table, "okved_name")
        op.drop_column(table, "okved")


def downgrade() -> None:
    for table in _COMPANY_TABLES:
        op.add_column(
            table, sa.Column("okved", sa.String(length=16), nullable=True)
        )
        op.add_column(
            table, sa.Column("okved_name", sa.String(length=255), nullable=True)
        )
        op.execute(
            f"""
            UPDATE {table} AS company
            SET okved = okved.code,
                okved_name = okved.name
            FROM okveds AS okved
            WHERE okved.id = company.okved_id
            """
        )

    bind = op.get_bind()
    missing = bind.execute(
        sa.text(
            "SELECT COUNT(*) FROM ("
            "  SELECT id FROM llc_companies"
            "  WHERE okved IS NULL OR okved_name IS NULL"
            "  UNION ALL"
            "  SELECT id FROM individual_entrepreneurs"
            "  WHERE okved IS NULL OR okved_name IS NULL"
            ") AS missing"
        )
    ).scalar_one()
    if missing:
        raise RuntimeError(
            "Нельзя выполнить downgrade: не всем компаниям восстановлен ОКВЭД "
            f"({missing} записей)"
        )

    for table in _COMPANY_TABLES:
        op.alter_column(
            table,
            "okved",
            existing_type=sa.String(length=16),
            nullable=False,
        )
        op.alter_column(
            table,
            "okved_name",
            existing_type=sa.String(length=255),
            nullable=False,
        )
        op.drop_index(f"ix_{table}_okved_id", table_name=table)
        op.drop_constraint(
            f"fk_{table}_okved_id", table, type_="foreignkey"
        )
        op.drop_column(table, "okved_id")

    op.drop_index("ix_okveds_code", table_name="okveds")
    op.drop_table("okveds")
