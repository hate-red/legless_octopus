from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import Application, User


DETAIL_OPTIONS = (
    selectinload(Application.product),
    selectinload(Application.client).selectinload(User.company),
    selectinload(Application.financial_verification),
    selectinload(Application.bki_check),
    selectinload(Application.ai_check),
    selectinload(Application.scoring_result),
    selectinload(Application.status_history),
)

LIST_OPTIONS = (
    selectinload(Application.product),
    selectinload(Application.client).selectinload(User.company),
)


async def load_application(
    db: AsyncSession,
    application_id: int,
    *,
    populate_existing: bool = False,
) -> Application | None:
    statement = (
        select(Application)
        .options(*DETAIL_OPTIONS)
        .where(Application.id == application_id)
    )
    if populate_existing:
        statement = statement.execution_options(populate_existing=True)
    result = await db.execute(statement)
    return result.scalar_one_or_none()


async def reload_application(
    db: AsyncSession, application_id: int
) -> Application | None:
    """Force-refresh an application and all nested checks after a commit.

    The session uses ``expire_on_commit=False``; without an explicit refresh a
    relationship loaded before the pipeline (for example an empty history)
    would remain cached in the response.
    """
    db.expire_all()
    return await load_application(
        db, application_id, populate_existing=True
    )
