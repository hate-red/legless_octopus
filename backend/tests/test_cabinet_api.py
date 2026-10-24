"""Opt-in end-to-end API checks. Use only an isolated, seeded test database.

CABINET_TEST_URL=http://127.0.0.1:8100/api python -m unittest tests.test_cabinet_api -v
"""
import json
import os
import unittest
from urllib.error import HTTPError
from urllib.parse import quote
from urllib.request import Request, urlopen

BASE_URL = os.environ.get("CABINET_TEST_URL", "").rstrip("/")
PDF = b"%PDF-1.4\n% Integration test document\n%%EOF"


@unittest.skipUnless(BASE_URL, "Set CABINET_TEST_URL to an isolated test API")
class CabinetApiTests(unittest.TestCase):
    @classmethod
    def request(cls, path, token=None, method="GET", payload=None, raw=None):
        headers = {}
        if token:
            headers["Authorization"] = f"Bearer {token}"
        body = raw
        if payload is not None:
            body = json.dumps(payload).encode()
            headers["Content-Type"] = "application/json"
        elif raw is not None:
            headers["Content-Type"] = "application/pdf"
        try:
            with urlopen(Request(BASE_URL + path, data=body, headers=headers, method=method), timeout=60) as response:
                data = response.read()
                return response.status, json.loads(data) if response.headers.get_content_type() == "application/json" and data else data
        except HTTPError as error:
            return error.code, json.loads(error.read())

    @classmethod
    def setUpClass(cls):
        cls.tokens = {}
        cls.users = {}
        for name in ("client1", "client2", "client3", "bank"):
            status, data = cls.request("/auth/login", method="POST", payload={"email": f"{name}@example.com", "password": "password123"})
            assert status == 200, data
            cls.tokens[name], cls.users[name] = data["access_token"], data["user"]
        _, cls.products = cls.request("/products", cls.tokens["client1"])

    def create_draft(self, client="client1", values=None):
        product = self.products[0]
        values = values or {"product_id": product["id"], "amount": max(product["min_amount"], min(500000, product["max_amount"])), "term_months": max(product["min_term_months"], min(12, product["max_term_months"])), "purpose": "Закупка оборудования для разработки программного обеспечения"}
        status, app = self.request("/applications", self.tokens[client], "POST", values)
        self.assertEqual(status, 201, app)
        return app

    def test_inn_login_and_access_isolation(self):
        inn = self.users["client1"]["company"]["inn"]
        status, session = self.request("/auth/login", method="POST", payload={"inn": inn, "password": "password123"})
        self.assertEqual(status, 200, session)
        self.assertEqual(session["user"]["id"], self.users["client1"]["id"])
        self.assertEqual(self.request("/bank/applications", self.tokens["client1"])[0], 403)
        app = self.create_draft()
        self.assertEqual(self.request(f'/applications/{app["id"]}', self.tokens["client2"])[0], 404)
        self.assertEqual(self.request(f'/applications/{app["id"]}', self.tokens["client2"], "DELETE")[0], 404)
        self.request(f'/applications/{app["id"]}', self.tokens["client1"], "DELETE")

    def test_soft_delete_and_restore(self):
        token = self.tokens["client1"]
        app = self.create_draft()
        path = f'/applications/{app["id"]}'
        self.assertEqual(self.request(path, token, "DELETE")[0], 204)
        self.assertEqual(self.request(path, token)[0], 404)
        self.assertEqual(self.request(path + "/restore", self.tokens["client2"], "POST")[0], 404)
        self.assertEqual(self.request(path + "/restore", token, "POST")[0], 200)
        self.assertEqual(self.request(path, token)[1]["purpose"], app["purpose"])
        self.request(path, token, "DELETE")

    def test_document_versions_confirmation_and_submission(self):
        token = self.tokens["client1"]
        app = self.create_draft()
        path = f'/applications/{app["id"]}'
        self.assertEqual(self.request(path + "/submit", token, "POST")[0], 422)
        _, docs = self.request("/company/documents", token)
        self.assertEqual(len(docs), 3)
        self.assertEqual(self.request(path + "/documents/confirm", token, "POST", {"document_ids": [d["id"] for d in docs]})[0], 200)
        _, old_pdf = self.request(f'/company/documents/{docs[0]["id"]}/content', token)
        self.assertTrue(old_pdf.startswith(b"%PDF-"))
        status, replacement = self.request(f'/company/documents/{docs[0]["kind"]}?filename={quote("Updated.pdf")}&period=2026', token, "PUT", raw=PDF)
        self.assertEqual(status, 201, replacement)
        self.assertEqual(self.request(path + "/submit", token, "POST")[0], 409)
        self.assertEqual(self.request(f'/company/documents/{replacement["id"]}/content', self.tokens["client2"])[0], 404)
        self.assertEqual(self.request(f'/company/documents/{replacement["id"]}/content', self.tokens["bank"])[1], PDF)
        self.assertEqual(self.request("/company/documents/company?filename=bad.pdf", token, "PUT", raw=b"not a pdf")[0], 422)
        _, current = self.request("/company/documents", token)
        self.assertEqual(self.request(path + "/documents/confirm", token, "POST", {"document_ids": [d["id"] for d in current]})[0], 200)
        status, result = self.request(path + "/submit", token, "POST")
        self.assertEqual(status, 200, result)
        self.assertIsInstance(result["score"], int)
        self.assertNotEqual(result["status"], "DRAFT")
        self.assertEqual(self.request(path, token, "DELETE")[0], 409)
        self.request(f'/company/documents/{replacement["kind"]}?filename=Newest.pdf', token, "PUT", raw=PDF + b"\n% New version")
        _, snapshot = self.request(path + "/documents", token)
        self.assertIn(replacement["id"], [d["id"] for d in snapshot])
        _, notes = self.request("/notifications", token)
        related = [n for n in notes if n["application_id"] == app["id"]]
        self.assertTrue(related)
        self.assertEqual(self.request("/notifications/read", token, "POST", {"ids": [n["id"] for n in related]})[0], 200)
        _, notes = self.request("/notifications", token)
        self.assertTrue(all(n["read"] for n in notes if n["application_id"] == app["id"]))

    def test_company_edit_persists(self):
        token = self.tokens["client3"]
        _, user = self.request("/auth/me", token)
        company = user["company"]
        payload = {key: company[key] for key in ("name", "inn", "ogrn", "revenue", "declared_profit", "employees", "business_age_months", "details")}
        payload.update(okved_id=company["okved"]["id"], contact_name=user["full_name"])
        updated = {**payload, "details": {**company["details"], "legal_address": "Тестовый адрес интеграции"}}
        try:
            status, result = self.request("/company", token, "PUT", updated)
            self.assertEqual(status, 200, result)
            self.assertEqual(self.request("/auth/me", token)[1]["company"]["details"]["legal_address"], "Тестовый адрес интеграции")
        finally:
            self.request("/company", token, "PUT", payload)

    def test_bank_decision_reaches_client(self):
        client = self.tokens["client2"]
        _, existing = self.request("/applications", client)
        template = next(app for app in existing if app["status"] == "MANUAL_REVIEW")
        values = {key: template[key] for key in ("amount", "term_months", "purpose")}
        values["product_id"] = template["product"]["id"]
        app = self.create_draft("client2", values)
        path = f'/applications/{app["id"]}'
        _, docs = self.request("/company/documents", client)
        self.request(path + "/documents/confirm", client, "POST", {"document_ids": [d["id"] for d in docs]})
        status, assessed = self.request(path + "/submit", client, "POST")
        self.assertEqual(status, 200, assessed)
        self.assertEqual(assessed["status"], "MANUAL_REVIEW")
        request_path = "/bank" + path + "/decision"
        self.assertEqual(self.request(request_path, self.tokens["bank"], "POST", {"decision": "MANUAL_REVIEW", "comment": "Обновите финансовую отчётность"})[0], 200)
        self.assertEqual(self.request(path + "/documents/respond", self.tokens["client1"], "POST", {"document_ids": [d["id"] for d in docs]})[0], 404)
        self.assertEqual(self.request(path + "/documents/respond", client, "POST", {"document_ids": [d["id"] for d in docs]})[0], 200)
        self.assertEqual(self.request(path + "/documents/respond", client, "POST", {"document_ids": [d["id"] for d in docs]})[0], 409)
        status, approved = self.request("/bank" + path + "/decision", self.tokens["bank"], "POST", {"decision": "APPROVED", "comment": "Данные компании подтверждены", "approved_amount": app["amount"], "approved_term_months": app["term_months"], "approved_rate": 18.5})
        self.assertEqual(status, 200, approved)
        self.assertEqual(self.request(path, client)[1]["status"], "APPROVED")
        self.assertEqual(self.request(path + "/confirm-conditions", client, "POST")[1]["status"], "CONTRACT_SIGNING")
        self.assertEqual(self.request(path + "/sign-contract", client, "POST")[1]["status"], "DISBURSED")
