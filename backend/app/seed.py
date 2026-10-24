import asyncio
import logging
import sys

from sqlalchemy import func, select

from app.constants import STATUS_DRAFT
from app.database import AsyncSessionLocal
from app.models import (
    Application,
    IndividualEntrepreneur,
    LLCCompany,
    Okved,
    Product,
    StatusHistory,
    User,
)
from app.security import hash_password
from app.services.application_queries import load_application
from app.services.orchestrator import run_orchestrator

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)
logger = logging.getLogger("seed")


PRODUCTS = [
    {
        "code": "UNSECURED",
        "name": "Без залога",
        "description": (
            "Кредит на текущие задачи бизнеса без обеспечения: закупку товара "
            "и материалов, выплаты, ремонт и другие расходы. До 5 млн ₽ "
            "на срок до 3 лет."
        ),
        "min_amount": 100_000,
        "max_amount": 5_000_000,
        "min_term_months": 6,
        "max_term_months": 36,
        "base_rate": 19.9,
        "collateral_required": False,
        "repayment_type": "annuity",
        "is_revolving": False,
    },
    {
        "code": "SECURED",
        "name": "С залогом",
        "description": (
            "Инвестиционный кредит под залог оборудования, техники или "
            "недвижимости. До 10 млн ₽ на срок до 5 лет и ставка ниже, "
            "чем без обеспечения."
        ),
        "min_amount": 300_000,
        "max_amount": 10_000_000,
        "min_term_months": 12,
        "max_term_months": 60,
        "base_rate": 17.5,
        "collateral_required": True,
        "repayment_type": "annuity",
        "is_revolving": False,
    },
    {
        "code": "CREDIT_LINE",
        "name": "Кредитная линия",
        "description": (
            "Возобновляемый лимит для регулярных закупок и кассовых разрывов. "
            "Средства можно выбирать частями в пределах лимита и возвращать "
            "по графику."
        ),
        "min_amount": 300_000,
        "max_amount": 5_000_000,
        "min_term_months": 12,
        "max_term_months": 36,
        "base_rate": 18.9,
        "collateral_required": False,
        "repayment_type": "differentiated",
        "is_revolving": True,
    },
]


OKVEDS = [
    {
        "code": "62.01",
        "name": "Разработка компьютерного программного обеспечения",
    },
    {
        "code": "47.11",
        "name": (
            "Торговля розничная преимущественно пищевыми продуктами, "
            "включая напитки, и табачными изделиями "
            "в неспециализированных магазинах"
        ),
    },
    {
        "code": "46.90",
        "name": "Торговля оптовая неспециализированная",
    },
    {
        "code": "43.21",
        "name": "Производство электромонтажных работ",
    },
    {
        "code": "49.41",
        "name": "Деятельность автомобильного грузового транспорта",
    },
    {
        "code": "71.11",
        "name": "Деятельность в области архитектуры",
    },
]


USERS = [
    {
        "email": "client1@example.com",
        "password": "password123",
        "full_name": "Смирнов Алексей Петрович",
        "role": "client",
        "company": {
            "legal_form": "OOO",
            "name": "ООО «Ромашка»",
            "inn": "7701234567",
            "ogrn": "1237700123456",
            "okved": "62.01",
            "revenue": 15_000_000,
            "declared_profit": 1_800_000,
            "employees": 42,
            "business_age_months": 36,
            "has_overdue": False,
        },
    },
    {
        "email": "client2@example.com",
        "password": "password123",
        "full_name": "Иванов Иван Иванович",
        "role": "client",
        "company": {
            "legal_form": "IP",
            "full_name": "ИП Иванов Иван Иванович",
            "inn": "770123456789",
            "ogrnip": "325770000123456",
            "okved": "47.11",
            "revenue": 5_400_000,
            "declared_profit": 500_000,
            "employees": 12,
            "business_age_months": 18,
            "has_overdue": False,
        },
    },
    {
        "email": "client3@example.com",
        "password": "password123",
        "full_name": "Петров Дмитрий Сергеевич",
        "role": "client",
        "company": {
            "legal_form": "OOO",
            "name": "ООО «Риск»",
            "inn": "770123456700",
            "ogrn": "1257700987654",
            "okved": "46.90",
            "revenue": 800_000,
            "declared_profit": -150_000,
            "employees": 4,
            "business_age_months": 10,
            "has_overdue": True,
        },
    },
    {
        "email": "bank@example.com",
        "password": "password123",
        "full_name": "Анна Смирнова, кредитный менеджер",
        "role": "bank",
        "company": None,
    },
]


async def seed() -> None:
    from app.services.cabinet_seed import seed_cabinet_documents
    async with AsyncSessionLocal() as db:
        user_count = await db.scalar(select(func.count(User.id)))
        if user_count:
            await seed_cabinet_documents(db)
            logger.info("Данные уже существуют — seed пропущен.")
            return

        products: dict[str, Product] = {}
        for item in PRODUCTS:
            product = Product(**item)
            db.add(product)
            products[item["code"]] = product

        existing_okveds = (await db.scalars(select(Okved))).all()
        okveds: dict[str, Okved] = {
            okved.code: okved for okved in existing_okveds
        }
        for item in OKVEDS:
            if item["code"] in okveds:
                continue
            okved = Okved(**item)
            db.add(okved)
            okveds[item["code"]] = okved
        await db.flush()

        users: dict[str, User] = {}
        for item in USERS:
            user = User(
                email=item["email"],
                password_hash=hash_password(item["password"]),
                role=item["role"],
                full_name=item["full_name"],
            )
            db.add(user)
            await db.flush()
            users[item["email"]] = user
            company_data = item.get("company")
            if company_data:
                data = dict(company_data)
                legal_form = data.pop("legal_form")
                okved_code = data.pop("okved")
                data["okved"] = okveds[okved_code]
                company_class = (
                    LLCCompany
                    if legal_form == "OOO"
                    else IndividualEntrepreneur
                )
                db.add(company_class(user_id=user.id, **data))

        await db.commit()
        logger.info(
            "Созданы пользователи: %s", ", ".join(item["email"] for item in USERS)
        )

        scenarios = [
            {
                "email": "client1@example.com",
                "product": "SECURED",
                "amount": 1_000_000,
                "term": 24,
                "purpose": "Покупка серверов",
            },
            {
                "email": "client2@example.com",
                "product": "UNSECURED",
                "amount": 3_000_000,
                "term": 24,
                "purpose": "Закупка товара",
            },
            {
                "email": "client3@example.com",
                "product": "UNSECURED",
                "amount": 500_000,
                "term": 12,
                "purpose": "Закупка товара",
            },
            {
                # Additional demo case: the purpose does not match the retail
                # OKVED, so the AI hard override sends the application to a
                # credit manager. This gives the bank UI a manual-review case.
                "email": "client2@example.com",
                "product": "SECURED",
                "amount": 1_000_000,
                "term": 24,
                "purpose": "Покупка серверов",
            },
        ]

        for scenario in scenarios:
            user = users[scenario["email"]]
            product = products[scenario["product"]]
            application = Application(
                client_id=user.id,
                product_id=product.id,
                amount=scenario["amount"],
                term_months=scenario["term"],
                purpose=scenario["purpose"],
                status=STATUS_DRAFT,
            )
            db.add(application)
            await db.flush()
            db.add(
                StatusHistory(
                    application_id=application.id,
                    status=STATUS_DRAFT,
                    comment="Демонстрационная заявка создана автоматически.",
                    actor_role="client",
                )
            )
            await db.commit()

            loaded = await load_application(db, application.id)
            assert loaded is not None
            await run_orchestrator(db, loaded)
            logger.info(
                "Seed: заявка #%s (%s) -> %s, скор %s",
                loaded.id,
                scenario["email"],
                loaded.status,
                loaded.score,
            )

        await seed_cabinet_documents(db)
        logger.info("Seed завершён успешно.")


if __name__ == "__main__":
    try:
        asyncio.run(seed())
    except Exception:
        logger.exception("Ошибка seed-данных")
        sys.exit(1)
