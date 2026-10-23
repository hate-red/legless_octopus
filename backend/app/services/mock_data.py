"""Deterministic mock data for external integrations.

The public mock endpoints and the orchestrator use the same source of truth,
so demo scenarios are fully reproducible without external services.
"""

from __future__ import annotations

import hashlib
from typing import Any


EGRUL_DATA: dict[str, dict[str, Any]] = {
    "7701234567": {
        "inn": "7701234567",
        "name": "ООО «Ромашка»",
        "okved": "62.01",
        "okved_name": "Разработка компьютерного программного обеспечения",
        "status": "ACTIVE",
        "reg_date": "2023-10-12",
        "address": "г. Москва, ул. Ленинская Слобода, д. 19",
        "director": "Смирнов Алексей Петрович",
    },
    "770123456789": {
        "inn": "770123456789",
        "name": "ИП Иванов Иван Иванович",
        "okved": "47.11",
        "okved_name": (
            "Торговля розничная преимущественно пищевыми продуктами, "
            "включая напитки, и табачными изделиями в неспециализированных магазинах"
        ),
        "status": "ACTIVE",
        "reg_date": "2025-04-03",
        "address": "г. Москва, ул. Тверская, д. 8, к. 2",
        "director": "Иванов Иван Иванович",
    },
    "770123456700": {
        "inn": "770123456700",
        "name": "ООО «Риск»",
        "okved": "46.90",
        "okved_name": "Торговля оптовая неспециализированная",
        "status": "ACTIVE",
        "reg_date": "2025-12-18",
        "address": "г. Москва, ул. Складская, д. 4",
        "director": "Петров Дмитрий Сергеевич",
    },
}

GIRBO_DATA: dict[str, dict[str, Any]] = {
    "7701234567": {
        "inn": "7701234567",
        "official_revenue": 14_800_000.0,
        "official_profit": 1_750_000.0,
        "tax_regime": "УСН",
        "period": "2025",
    },
    "770123456789": {
        "inn": "770123456789",
        "official_revenue": 5_400_000.0,
        "official_profit": 480_000.0,
        "tax_regime": "УСН",
        "period": "2025",
    },
    "770123456700": {
        "inn": "770123456700",
        "official_revenue": 750_000.0,
        "official_profit": -150_000.0,
        "tax_regime": "ОСН",
        "period": "2025",
    },
}

BKI_DATA: dict[str, dict[str, Any]] = {
    "7701234567": {
        "inn": "7701234567",
        "bki_score": 752,
        "active_loans": 0,
        "monthly_payments": 0.0,
        "overdue_count": 0,
        "payment_discipline_pct": 100.0,
    },
    "770123456789": {
        "inn": "770123456789",
        "bki_score": 648,
        "active_loans": 1,
        "monthly_payments": 150_000.0,
        "overdue_count": 0,
        "payment_discipline_pct": 96.0,
    },
    "770123456700": {
        "inn": "770123456700",
        "bki_score": 480,
        "active_loans": 2,
        "monthly_payments": 80_000.0,
        "overdue_count": 2,
        "payment_discipline_pct": 62.0,
    },
}

_OKVED_FALLBACKS = [
    ("62.01", "Разработка компьютерного программного обеспечения"),
    ("47.11", "Торговля розничная преимущественно пищевыми продуктами"),
    ("46.90", "Торговля оптовая неспециализированная"),
    ("43.21", "Производство электромонтажных работ"),
    ("49.41", "Деятельность автомобильного грузового транспорта"),
    ("71.11", "Деятельность в области архитектуры"),
]


def _seed(inn: str) -> int:
    digest = hashlib.sha256(inn.encode("utf-8")).hexdigest()
    return int(digest[:8], 16)


def get_egrul(inn: str) -> dict[str, Any]:
    if inn in EGRUL_DATA:
        return {**EGRUL_DATA[inn], "source": "registry"}

    # Unknown INNs get deterministic demo data. The source flag tells the
    # orchestrator not to overwrite the stored company profile.
    seed = _seed(inn)
    okved, okved_name = _OKVED_FALLBACKS[seed % len(_OKVED_FALLBACKS)]
    year = 2018 + seed % 7
    month = 1 + (seed >> 3) % 12
    day = 1 + (seed >> 7) % 27
    return {
        "inn": inn,
        "name": f"ООО «Компания {inn[-4:]}»",
        "okved": okved,
        "okved_name": okved_name,
        "status": "ACTIVE",
        "reg_date": f"{year:04d}-{month:02d}-{day:02d}",
        "address": "г. Москва",
        "director": "Не раскрывается",
        "source": "generated",
    }


def get_girbo(inn: str) -> dict[str, Any]:
    if inn in GIRBO_DATA:
        return dict(GIRBO_DATA[inn])
    seed = _seed(inn)
    revenue = float(1_200_000 + seed % 11_000_000)
    margin = 0.02 + ((seed >> 5) % 14) / 100
    if seed % 9 == 0:
        margin = -0.04
    return {
        "inn": inn,
        "official_revenue": round(revenue, 2),
        "official_profit": round(revenue * margin, 2),
        "tax_regime": "УСН" if seed % 3 else "ОСН",
        "period": "2025",
    }


def get_bki(inn: str) -> dict[str, Any]:
    if inn in BKI_DATA:
        return dict(BKI_DATA[inn])
    seed = _seed(inn)
    score = 540 + seed % 210
    overdue = 0 if score >= 620 else (seed % 3)
    payments = float(20_000 + (seed >> 4) % 180_000)
    return {
        "inn": inn,
        "bki_score": score,
        "active_loans": 1 + (seed >> 9) % 3,
        "monthly_payments": round(payments, 2),
        "overdue_count": overdue,
        "payment_discipline_pct": round(max(45.0, 100.0 - overdue * 18.0), 1),
    }
