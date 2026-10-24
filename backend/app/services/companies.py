"""Company-profile lookup helpers for the two legal forms."""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import IndividualEntrepreneur, LLCCompany


async def get_company_for_user(
    db: AsyncSession, user_id: int
) -> LLCCompany | IndividualEntrepreneur | None:
    company = await db.scalar(
        select(LLCCompany).where(LLCCompany.user_id == user_id)
    )
    if company is not None:
        return company
    return await db.scalar(
        select(IndividualEntrepreneur).where(
            IndividualEntrepreneur.user_id == user_id
        )
    )
