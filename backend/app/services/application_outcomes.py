"""Helpers for writing application decisions and approvals.

Keeping these operations in one place avoids scattering knowledge about the
one-to-one outcome tables across the orchestrator and HTTP routers.
"""

from app.models import Application, ApplicationApproval, ApplicationDecision


def set_decision(
    application: Application,
    decision: str,
    reason: str | None = None,
) -> None:
    if application.decision_record is None:
        application.decision_record = ApplicationDecision(
            decision=decision,
            decision_reason=reason,
        )
        return

    application.decision_record.decision = decision
    application.decision_record.decision_reason = reason


def set_approval(
    application: Application,
    *,
    approved_amount: float | None = None,
    approved_term_months: int | None = None,
    approved_rate: float | None = None,
    replace: bool = False,
) -> None:
    values = {
        "approved_amount": approved_amount,
        "approved_term_months": approved_term_months,
        "approved_rate": approved_rate,
    }
    if all(value is None for value in values.values()):
        return

    if application.approval is None:
        application.approval = ApplicationApproval(**values)
        return

    for field, value in values.items():
        if replace or value is not None:
            setattr(application.approval, field, value)
