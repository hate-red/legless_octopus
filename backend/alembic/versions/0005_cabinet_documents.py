"""Persist company details, versioned documents and notification receipts."""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0005_cabinet_documents"
down_revision = "0004_okved_reference"
branch_labels = None
depends_on = None


def upgrade():
    for table in ("llc_companies", "individual_entrepreneurs"):
        op.add_column(table, sa.Column("details", postgresql.JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")))
    op.add_column("applications", sa.Column("deleted_at", sa.DateTime(timezone=True)))
    op.add_column("applications", sa.Column("documents_confirmed_at", sa.DateTime(timezone=True)))
    op.create_table("company_documents",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("owner_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("kind", sa.String(32), nullable=False),
        sa.Column("filename", sa.String(255), nullable=False),
        sa.Column("period", sa.String(255), nullable=False),
        sa.Column("content", sa.LargeBinary(), nullable=False),
        sa.Column("size", sa.Integer(), nullable=False),
        sa.Column("is_current", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("uploaded_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_company_documents_owner_id", "company_documents", ["owner_id"])
    op.create_index("uq_company_documents_current_kind", "company_documents", ["owner_id", "kind"], unique=True, postgresql_where=sa.text("is_current = true"))
    op.create_table("application_documents",
        sa.Column("application_id", sa.Integer(), sa.ForeignKey("applications.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("document_id", sa.String(36), sa.ForeignKey("company_documents.id", ondelete="RESTRICT"), primary_key=True),
    )
    op.create_table("notification_receipts",
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("history_id", sa.Integer(), sa.ForeignKey("status_history.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("read_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )


def downgrade():
    op.drop_table("notification_receipts")
    op.drop_table("application_documents")
    op.drop_table("company_documents")
    op.drop_column("applications", "documents_confirmed_at")
    op.drop_column("applications", "deleted_at")
    for table in ("llc_companies", "individual_entrepreneurs"):
        op.drop_column(table, "details")
