import unittest
from types import SimpleNamespace

from app.services.scoring.ai_service import AICheckResult
from app.services.scoring.processing_utils import calculate_dti
from app.services.scoring.scoring import calculate_score


def score_for(*, ai_valid: bool = True, overdue_count: int = 0):
    return calculate_score(
        company=SimpleNamespace(business_age_months=36),
        verification=SimpleNamespace(
            official_revenue=15_000_000,
            official_profit=1_800_000,
        ),
        bki=SimpleNamespace(
            bki_score=748,
            overdue_count=overdue_count,
            monthly_payments=0,
        ),
        ai_result=AICheckResult(
            is_valid=ai_valid,
            comment="Цель соответствует профилю компании.",
        ),
        amount=1_000_000,
        term_months=24,
    )


class DtiTests(unittest.TestCase):
    def test_uses_twenty_percent_buffer_and_monthly_revenue(self) -> None:
        dti, payment = calculate_dti(
            amount=1_000_000,
            term_months=24,
            official_revenue=15_000_000,
            monthly_payments=0,
        )

        self.assertEqual(payment, 50_000)
        self.assertEqual(dti, 4.0)

    def test_zero_term_returns_sentinel(self) -> None:
        dti, payment = calculate_dti(
            amount=1_000_000,
            term_months=0,
            official_revenue=15_000_000,
            monthly_payments=0,
        )

        self.assertEqual(dti, 999.0)
        self.assertEqual(payment, 0.0)


class ScoringTests(unittest.TestCase):
    def test_base_and_cap_factors_are_present(self) -> None:
        score, factors, dti = score_for()

        self.assertEqual(score, 100)
        self.assertEqual(dti, 4.0)
        self.assertEqual(factors[0].factor_type.value, "base")
        self.assertEqual(factors[0].points, 50)
        self.assertEqual(factors[-1].factor_type.value, "cap")
        self.assertEqual(factors[-1].points, -30)
        self.assertEqual(sum(factor.points for factor in factors), 100)

    def test_factor_dict_contains_plain_strings(self) -> None:
        _, factors, _ = score_for()

        payload = factors[1].to_dict()

        self.assertIsInstance(payload["factor"], str)
        self.assertIsInstance(payload["label"], str)
        self.assertEqual(payload["label"], "Выручка")

    def test_invalid_ai_purpose_costs_twenty_points(self) -> None:
        score, factors, _ = score_for(ai_valid=False)

        ai_factor = next(factor for factor in factors if factor.factor_type.value == "ai")
        self.assertEqual(ai_factor.points, -20)
        self.assertEqual(score, 100)

    def test_overdue_count_adds_penalty(self) -> None:
        score, factors, _ = score_for(overdue_count=2)

        overdue = next(
            factor for factor in factors if factor.factor_type.value == "overdue"
        )
        self.assertEqual(overdue.points, -30)
        self.assertEqual(score, 100)


if __name__ == "__main__":
    unittest.main()
