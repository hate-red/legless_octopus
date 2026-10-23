"""Local semantic analysis of the loan purpose.

Uses sentence-transformers (`paraphrase-multilingual-MiniLM-L12-v2`) entirely
on-premise — no external AI API calls. If the model cannot be loaded (for
example during lightweight local development), a deterministic keyword-based
fallback keeps the demo functional.
"""

from __future__ import annotations

import asyncio
import logging
import re
from dataclasses import dataclass

from app.config import settings

logger = logging.getLogger(__name__)

STOP_TOPICS: tuple[tuple[str, str], ...] = (
    # Russian stems.
    ("казино", "азартные игры"),
    ("криптовалют", "криптовалюта"),
    ("майнинг", "майнинг криптовалют"),
    ("оружи", "оружие"),
    ("наркотик", "наркотики"),
    ("букмекер", "букмекерская деятельность"),
    ("азартн", "азартные игры"),
    ("обналич", "обналичивание средств"),
    # English terms are accepted too: the purpose field is free-form.
    ("casino", "азартные игры"),
    ("gambling", "азартные игры"),
    ("betting", "букмекерская деятельность"),
    ("crypto", "криптовалюта"),
    ("weapon", "оружие"),
    ("firearm", "оружие"),
)

# A short industry profile gives the embedding model useful business context
# beyond the formal OKVED label (e.g. "Покупка серверов" vs "Разработка ПО").
OKVED_CONTEXT: dict[str, str] = {
    "it": (
        "Разработка компьютерного программного обеспечения. Покупка серверов, "
        "компьютерной техники и оборудования, IT-услуги, хостинг и лицензии."
    ),
    "retail": (
        "Розничная и оптовая торговля. Закупка товаров, пополнение ассортимента, "
        "аренда и оборудование магазина, складская логистика."
    ),
    "construction": (
        "Строительство и ремонт. Закупка строительных материалов, инструментов "
        "и оборудования, монтажные работы."
    ),
    "transport": (
        "Грузовые перевозки и логистика. Покупка и ремонт транспорта, топливо, "
        "складское оборудование."
    ),
    "production": (
        "Производство товаров. Закупка сырья, станков, производственных линий "
        "и оборудования."
    ),
    "agro": (
        "Сельское хозяйство. Семена, удобрения, сельхозтехника, оборудование "
        "для фермы."
    ),
    "food": (
        "Кафе и рестораны. Закупка продуктов, кухонного оборудования, "
        "аренда помещения."
    ),
}

CATEGORY_KEYWORDS: dict[str, tuple[str, ...]] = {
    "it": (
        "сервер",
        "программ",
        "компьютер",
        "оборудован",
        "разработ",
        "сайт",
        "техник",
        "ит-",
        "лиценз",
        "хостинг",
    ),
    "retail": (
        "товар",
        "закуп",
        "торгов",
        "продукт",
        "ассортимент",
        "поставщик",
        "магазин",
        "склад",
    ),
    "construction": (
        "строй",
        "ремонт",
        "материал",
        "объект",
        "монтаж",
        "подряд",
        "недвижим",
    ),
    "transport": (
        "транспорт",
        "автомобил",
        "груз",
        "логист",
        "доставк",
        "перевоз",
        "топлив",
    ),
    "production": (
        "производств",
        "сырь",
        "станок",
        "оборудован",
        "лини",
        "цех",
        "материал",
    ),
    "agro": ("сельхоз", "урожай", "семен", "удобрен", "техник", "животн", "поле"),
    "food": ("кафе", "ресторан", "кухн", "продукт", "оборудован", "помещен"),
}

OKVED_CATEGORY: dict[str, str] = {
    "01": "agro",
    "02": "agro",
    "03": "agro",
    "10": "production",
    "11": "production",
    "13": "production",
    "14": "production",
    "15": "production",
    "16": "production",
    "17": "production",
    "18": "production",
    "20": "production",
    "22": "production",
    "23": "production",
    "24": "production",
    "25": "production",
    "27": "production",
    "28": "production",
    "31": "production",
    "32": "production",
    "33": "production",
    "41": "construction",
    "42": "construction",
    "43": "construction",
    "45": "retail",
    "46": "retail",
    "47": "retail",
    "49": "transport",
    "52": "transport",
    "53": "transport",
    "55": "food",
    "56": "food",
    "62": "it",
    "63": "it",
}


@dataclass(slots=True)
class AICheckResult:
    is_valid: bool
    similarity_score: float
    comment: str
    backend: str = "sentence-transformers"


_model = None
_model_load_failed = False
_model_lock: asyncio.Lock | None = None


def _get_lock() -> asyncio.Lock:
    global _model_lock
    if _model_lock is None:
        _model_lock = asyncio.Lock()
    return _model_lock


def _load_model():
    from sentence_transformers import SentenceTransformer

    logger.info("Загрузка локальной модели %s", settings.ai_model_name)
    return SentenceTransformer(settings.ai_model_name)


async def _get_model():
    global _model, _model_load_failed
    if _model is not None:
        return _model
    if _model_load_failed or not settings.ai_enabled:
        return None
    async with _get_lock():
        if _model is not None:
            return _model
        if _model_load_failed:
            return None
        try:
            _model = await asyncio.to_thread(_load_model)
            logger.info("Модель семантического анализа загружена")
        except Exception as exc:  # pragma: no cover - depends on environment
            _model_load_failed = True
            logger.warning(
                "Не удалось загрузить sentence-transformers (%s). "
                "Используется эвристический fallback.",
                exc,
            )
            return None
    return _model


async def warmup_ai() -> bool:
    """Load the model ahead of the first request without blocking startup."""
    if not settings.ai_enabled:
        return False
    model = await _get_model()
    return model is not None


def _industry_context(okved: str) -> str:
    category = OKVED_CATEGORY.get(okved[:2], "")
    return OKVED_CONTEXT.get(category, "")


async def _semantic_similarity(
    purpose: str, okved_name: str, okved: str
) -> float | None:
    model = await _get_model()
    if model is None:
        return None
    context = _industry_context(okved)
    targets = [okved_name]
    if context:
        targets.append(context)
        targets.append(f"{okved_name}. {context}")
    try:
        embeddings = await asyncio.to_thread(
            model.encode,
            [purpose, *targets],
            normalize_embeddings=True,
        )
        purpose_embedding = embeddings[0]
        similarities = [float(purpose_embedding @ item) for item in embeddings[1:]]
        similarity = max(similarities)
        return max(0.0, min(1.0, similarity))
    except Exception as exc:  # pragma: no cover
        logger.warning("Ошибка семантического анализа: %s", exc)
        return None


def _normalize_tokens(text: str) -> set[str]:
    return set(re.findall(r"[а-яёa-z0-9]+", text.lower()))


def _has_keyword(tokens: set[str], keywords: tuple[str, ...]) -> bool:
    for token in tokens:
        for keyword in keywords:
            if token.startswith(keyword) or keyword in token:
                return True
    return False


def _heuristic_similarity(purpose: str, okved_name: str, okved: str = "") -> float:
    category = OKVED_CATEGORY.get(okved[:2], "")
    keywords = CATEGORY_KEYWORDS.get(category, ())
    tokens = _normalize_tokens(purpose)
    if keywords and _has_keyword(tokens, keywords):
        return 0.62
    # Generic business-purpose vocabulary still counts as a weak match.
    if _has_keyword(tokens, ("развит", "пополн", "оборот", "закуп", "оборудован")):
        return 0.55
    return 0.28


def _find_stop_topic(purpose: str) -> str | None:
    normalized = purpose.lower().replace("ё", "е")
    for stem, label in STOP_TOPICS:
        if stem.replace("ё", "е") in normalized:
            return label
    return None


async def check_purpose(
    purpose: str,
    okved_name: str,
    *,
    okved: str = "",
) -> AICheckResult:
    """Check whether the declared purpose is plausible for the company's OKVED."""
    purpose = purpose.strip()
    if not purpose:
        return AICheckResult(
            is_valid=False,
            similarity_score=0.0,
            comment="Цель кредита не заполнена.",
            backend="validation",
        )

    stop_topic = _find_stop_topic(purpose)
    if stop_topic:
        return AICheckResult(
            is_valid=False,
            similarity_score=0.0,
            comment=(
                "Цель содержит запрещённую тематику: "
                f"«{stop_topic}». Кредитование невозможно."
            ),
            backend="stop-words",
        )

    similarity = await _semantic_similarity(purpose, okved_name, okved)
    backend = "sentence-transformers"
    if similarity is None:
        similarity = _heuristic_similarity(purpose, okved_name, okved)
        backend = "heuristic"

    is_valid = similarity >= settings.ai_similarity_threshold
    percent = round(similarity * 100)
    if is_valid:
        comment = (
            "Цель кредита соответствует профилю деятельности компании "
            f"(семантическое сходство {percent}%)."
        )
    else:
        comment = (
            "Цель кредита не соответствует заявленному ОКВЭД "
            f"(семантическое сходство {percent}%, порог "
            f"{round(settings.ai_similarity_threshold * 100)}%). "
            "Требуется ручная проверка."
        )
    if backend == "heuristic":
        comment += " Проверка выполнена в эвристическом режиме."

    return AICheckResult(
        is_valid=is_valid,
        similarity_score=round(similarity, 4),
        comment=comment,
        backend=backend,
    )
