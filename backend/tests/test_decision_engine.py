import unittest
from types import SimpleNamespace

from app.services.scoring.ai_service import AICheckResult
from app.services.decision_engine import make_decision


def decide(*, score: int, overdue_count: int):
    return make_decision(
        score=score,
        dti_percent=4.1,
        application_amount=1_000_000,
        term_months=24,
        product=SimpleNamespace(min_amount=100_000, base_rate=19.9),
        bki=SimpleNamespace(monthly_payments=0.0, overdue_count=overdue_count),
        verification=SimpleNamespace(
            official_revenue=15_000_000,
            official_profit=1_800_000,
        ),
        ai=AICheckResult(
            is_valid=True,
            comment="Цель соответствует профилю компании.",
        ),
        company=SimpleNamespace(),
    )


class DecisionEngineHardOverrideTest(unittest.TestCase):
    def test_overdue_rejects_even_with_perfect_score(self) -> None:
        outcome = decide(score=100, overdue_count=1)

        self.assertEqual(outcome.status, "REJECTED")
        self.assertIn("просрочки", outcome.reason.lower())

    def test_clean_bki_with_perfect_score_is_approved(self) -> None:
        outcome = decide(score=100, overdue_count=0)

        self.assertEqual(outcome.status, "APPROVED")
        self.assertEqual(outcome.approved_amount, 1_000_000)


if __name__ == "__main__":
    unittest.main()
