"""Merge the cabinet-documents and schema-cleanup migration branches.

Both branches are based on 0004_okved_reference. This revision does not
change the database schema; it only makes ``alembic upgrade head`` unambiguous.
"""

from typing import Sequence, Union

revision: str = "0006_merge_heads"
down_revision: Union[str, Sequence[str], None] = (
    "0005_cabinet_documents",
    "fd2723e3a9b9",
)
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
