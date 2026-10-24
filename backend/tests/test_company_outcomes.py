import unittest

from app.models import (
    Application,
    IndividualEntrepreneur,
    LLCCompany,
    Okved,
)
from app.schemas import CompanyOut
from app.services.application_outcomes import set_approval, set_decision
from app.services.okveds import get_or_create_okved


def make_application() -> Application:
    return Application(
        client_id=1,
        product_id=1,
        amount=1_000_000,
        term_months=24,
        purpose="Пополнение оборотных средств",
        status="DRAFT",
    )


class CompanyOutTests(unittest.TestCase):
    def test_llc_is_exposed_with_legal_form_and_registration_number(self) -> None:
        okved = Okved(id=1, code="62.01", name="Разработка ПО")
        company = LLCCompany(
            id=1,
            user_id=1,
            name="ООО «Ромашка»",
            inn="7701234567",
            ogrn="1237700123456",
            okved=okved,
            revenue=15_000_000,
            declared_profit=1_800_000,
            employees=42,
            business_age_months=36,
            has_overdue=False,
        )

        payload = CompanyOut.model_validate(company)

        self.assertEqual(payload.legal_form, "OOO")
        self.assertEqual(payload.name, "ООО «Ромашка»")
        self.assertEqual(payload.ogrn, "1237700123456")
        self.assertEqual(payload.okved.code, "62.01")
        self.assertEqual(payload.okved.name, "Разработка ПО")

    def test_individual_entrepreneur_maps_normalized_fields(self) -> None:
        okved = Okved(id=2, code="47.11", name="Розничная торговля")
        company = IndividualEntrepreneur(
            id=2,
            user_id=2,
            full_name="ИП Иванов Иван Иванович",
            inn="770123456789",
            ogrnip="325770000123456",
            okved=okved,
            revenue=5_400_000,
            declared_profit=500_000,
            employees=12,
            business_age_months=18,
            has_overdue=False,
        )

        payload = CompanyOut.model_validate(company)

        self.assertEqual(payload.legal_form, "IP")
        self.assertEqual(payload.name, "ИП Иванов Иван Иванович")
        self.assertEqual(payload.ogrn, "325770000123456")
        self.assertEqual(payload.okved.code, "47.11")
        self.assertEqual(payload.okved.name, "Розничная торговля")


class FakeSession:
    def __init__(self, existing: Okved | None = None) -> None:
        self.existing = existing
        self.added: list[Okved] = []

    async def scalar(self, _statement: object) -> Okved | None:
        return self.existing

    def add(self, obj: Okved) -> None:
        self.added.append(obj)


class OkvedServiceTests(unittest.IsolatedAsyncioTestCase):
    async def test_creates_reference_row_and_normalizes_values(self) -> None:
        db = FakeSession()

        okved = await get_or_create_okved(db, " 62.01 ", " Разработка ПО ")

        self.assertEqual(okved.code, "62.01")
        self.assertEqual(okved.name, "Разработка ПО")
        self.assertEqual(db.added, [okved])

    async def test_reuses_existing_row_and_updates_name(self) -> None:
        existing = Okved(id=1, code="62.01", name="Старое название")
        db = FakeSession(existing)

        okved = await get_or_create_okved(db, "62.01", "Новое название")

        self.assertIs(okved, existing)
        self.assertEqual(existing.name, "Новое название")
        self.assertEqual(db.added, [])


class ApplicationOutcomeTests(unittest.TestCase):
    def test_set_decision_creates_and_updates_single_record(self) -> None:
        application = make_application()

        set_decision(application, "MANUAL_REVIEW", "Нужна проверка")
        self.assertIsNotNone(application.decision_record)
        self.assertEqual(application.decision_record.decision, "MANUAL_REVIEW")
        self.assertEqual(application.decision_record.decision_reason, "Нужна проверка")

        set_decision(application, "APPROVED", "Проверено")
        self.assertEqual(application.decision_record.decision, "APPROVED")
        self.assertEqual(application.decision_record.decision_reason, "Проверено")

    def test_set_approval_creates_record_and_fills_missing_values(self) -> None:
        application = make_application()

        set_approval(
            application,
            approved_amount=900_000,
            approved_term_months=24,
            approved_rate=19.5,
        )
        self.assertIsNotNone(application.approval)
        self.assertEqual(application.approval.approved_amount, 900_000)

        set_approval(application, approved_rate=18.0)
        self.assertEqual(application.approval.approved_amount, 900_000)
        self.assertEqual(application.approval.approved_rate, 18.0)

    def test_set_approval_replace_clears_omitted_values(self) -> None:
        application = make_application()
        set_approval(
            application,
            approved_amount=900_000,
            approved_term_months=24,
            approved_rate=19.5,
        )

        set_approval(application, approved_amount=1_000_000, replace=True)

        self.assertEqual(application.approval.approved_amount, 1_000_000)
        self.assertIsNone(application.approval.approved_term_months)
        self.assertIsNone(application.approval.approved_rate)

    def test_set_approval_without_values_does_not_create_record(self) -> None:
        application = make_application()

        set_approval(application)

        self.assertIsNone(application.approval)


if __name__ == "__main__":
    unittest.main()
