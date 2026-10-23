from sqlalchemy.ext.asyncio import AsyncSession

from app.constants import ALLOWED_TRANSITIONS
from app.models import Application, StatusHistory


class InvalidTransitionError(ValueError):
    """Raised when the state machine does not allow a transition."""


def transition(
    db: AsyncSession,
    application: Application,
    new_status: str,
    *,
    comment: str = "",
    actor_role: str = "system",
    force: bool = False,
) -> StatusHistory:
    """Move an application to a new status and record it in the audit trail."""
    current_status = application.status

    if new_status == current_status:
        history = StatusHistory(
            application_id=application.id,
            status=new_status,
            comment=comment,
            actor_role=actor_role,
        )
        db.add(history)
        return history

    allowed = ALLOWED_TRANSITIONS.get(current_status, set())
    if new_status not in allowed and not force:
        raise InvalidTransitionError(
            f"Переход {current_status} -> {new_status} недопустим"
        )

    application.status = new_status
    history = StatusHistory(
        application_id=application.id,
        status=new_status,
        comment=comment,
        actor_role=actor_role,
    )
    db.add(history)
    return history
