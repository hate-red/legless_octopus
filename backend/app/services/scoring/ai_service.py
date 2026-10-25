"""Local LLM check: does the loan purpose match the company's OKVED?"""

from __future__ import annotations

import asyncio
import json
import logging
from dataclasses import dataclass
from pathlib import Path

import huggingface_hub
from llama_cpp import Llama

from app.config import settings

logger = logging.getLogger(__name__)


@dataclass(slots=True)
class AICheckResult:
    is_valid: bool
    comment: str


_checker: LLMPurposeChecker | None = None
_checker_lock = asyncio.Lock()
_inference_lock = asyncio.Lock()


def _model_path() -> Path:
    return settings.ai_models_dir / settings.ai_model_filename


def _ensure_model_file() -> Path:
    model_path = _model_path()
    if not model_path.exists():
        settings.ai_models_dir.mkdir(parents=True, exist_ok=True)
        logger.info("Скачивание локальной модели %s", settings.ai_model_repo_id)
        huggingface_hub.hf_hub_download(
            repo_id=settings.ai_model_repo_id,
            filename=settings.ai_model_filename,
            local_dir=settings.ai_models_dir,
        )
    return model_path


def _parse_ai_response(content: str) -> AICheckResult:
    if not isinstance(content, str):
        raise ValueError("LLM returned an empty response")

    start, end = content.find("{"), content.rfind("}")
    if start == -1 or end < start:
        raise ValueError(f"LLM response is not JSON: {content!r}")

    payload = json.loads(content[start : end + 1])
    if not isinstance(payload, dict):
        raise ValueError(f"Unexpected LLM response payload: {payload!r}")
    is_valid = payload.get("is_valid")
    comment = payload.get("comment")
    if not isinstance(is_valid, bool) or not isinstance(comment, str):
        raise ValueError(f"Unexpected LLM response payload: {payload!r}")
    return AICheckResult(is_valid=is_valid, comment=comment)


class LLMPurposeChecker:
    def __init__(self) -> None:
        model_path = _ensure_model_file()
        kwargs: dict[str, object] = {
            "model_path": str(model_path),
            "n_ctx": settings.ai_n_ctx,
            "verbose": False,
        }
        if settings.ai_n_threads:
            kwargs["n_threads"] = settings.ai_n_threads
        self._model = Llama(**kwargs)  # type: ignore[arg-type]
        self.response_format = {
            "type": "json_object",
            "schema": {
                "type": "object",
                "properties": {
                    "is_valid": {"type": "boolean"},
                    "comment": {"type": "string"},
                },
                "required": ["is_valid", "comment"],
                "additionalProperties": False,
            },
        }
        self.prompt = (
            settings.ai_models_dir / settings.ai_prompt_filename
        ).read_text(encoding="utf-8")

    def _check_purpose_sync(self, purpose: str, okved: str) -> AICheckResult:
        response = self._model.create_chat_completion(
            messages=[
                {"role": "system", "content": "Answer the user's question."},
                {
                    "role": "user",
                    "content": self.prompt.format(purpose=purpose, okved=okved),
                },
            ],
            response_format=self.response_format,  # type: ignore[arg-type]
            temperature=0,
            max_tokens=256,
        )
        content = response["choices"][0]["message"]["content"]
        return _parse_ai_response(content)

    async def check_purpose(self, purpose: str, okved: str) -> AICheckResult:
        # llama.cpp contexts are not thread-safe, so serialize inference.
        async with _inference_lock:
            return await asyncio.to_thread(
                self._check_purpose_sync,
                purpose,
                okved,
            )


def _load_checker() -> LLMPurposeChecker:
    logger.info("Загрузка локальной LLM-модели %s", settings.ai_model_filename)
    return LLMPurposeChecker()


async def get_checker() -> LLMPurposeChecker:
    """Return a process-wide checker, loading the model only once."""
    global _checker
    if _checker is not None:
        return _checker
    async with _checker_lock:
        if _checker is None:
            _checker = await asyncio.to_thread(_load_checker)
    return _checker


async def warmup_ai() -> bool:
    """Load the model ahead of the first request without blocking startup."""
    try:
        await get_checker()
        logger.info("LLM-модель загружена")
        return True
    except Exception:
        logger.exception("Не удалось загрузить LLM-модель")
        return False


async def load_llm() -> bool:
    """Backward-compatible alias for older call sites."""
    return await warmup_ai()


if __name__ == "__main__":
    async def main() -> None:
        checker = await get_checker()
        result = await checker.check_purpose(
            purpose="Купить печь",
            okved="Разработка компьютерного программного обеспечения",
        )
        print(result)

    asyncio.run(main())
