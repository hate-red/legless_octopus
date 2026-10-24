"""Using LLM to check validity of a purpose based on an okved"""
from llama_cpp import Llama
import huggingface_hub

import logging
import json
from dataclasses import dataclass

from app.config import settings


logger = logging.getLogger(__name__)


@dataclass(slots=True)
class AICheckResult:
    is_valid: bool
    comment: str


async def load_llm():
    if not (settings.ai_models_dir / settings.ai_model_filename).exists():
        huggingface_hub.hf_hub_download(
            repo_id=settings.ai_model_repo_id,
            filename=settings.ai_model_filename,
            local_dir=settings.ai_models_dir
        )


class LLMPuproseChecker:
    def __init__(self) -> None:
        self._model = Llama(
            model_path=str(settings.ai_models_dir / settings.ai_model_filename),
            verbose=False,
        )
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
        self.prompt = (settings.ai_models_dir / settings.ai_prompt_filename).read_text()


    async def check_purpose(
        self,
        purpose: str,
        okved: str,
    ) -> AICheckResult:
        result = self._model.create_chat_completion(
            messages=[
                {"role": "system", "content": "Answer the user's question."},
                {"role": "user", "content": self.prompt.format(purpose=purpose, okved=okved)},
            ],
            response_format=self.response_format, # type: ignore
            temperature=0
        )['choices'][0]['message']['content']
        result = json.loads(result) # type: ignore
        return AICheckResult(**result) # type: ignore


if __name__ == '__main__':
    import asyncio


    async def main():
        checker = LLMPuproseChecker()
        result = await checker.check_purpose(
            purpose='Купить печь',
            okved='Разработка компьютерного программного обеспечения',
        )
        print(result)


    asyncio.run(main())
