"""OKVED reference-data helpers."""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Okved


async def get_or_create_okved(
    db: AsyncSession, code: str, name: str
) -> Okved:
    """Return the reference row for an OKVED code, creating it if needed."""
    normalized_code = code.strip()
    normalized_name = name.strip()
    okved = await db.scalar(select(Okved).where(Okved.code == normalized_code))
    if okved is None:
        okved = Okved(code=normalized_code, name=normalized_name)
        db.add(okved)
    elif normalized_name and okved.name != normalized_name:
        okved.name = normalized_name
    return okved
