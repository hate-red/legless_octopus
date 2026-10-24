from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict
from pathlib import Path


class Settings(BaseSettings):
    project_root: Path = Path(__file__).parent.parent.parent
    backend_root: Path = project_root / "backend"

    POSTGRES_DB: str
    POSTGRES_USER: str
    POSTGRES_PASSWORD: str
    POSTGRES_PORT: int
    POSTGRES_HOST: str

    model_config = SettingsConfigDict(
        env_file=project_root / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    app_name: str = "Умный кредитный кабинет"
    app_env: str = "development"
    api_prefix: str = "/api"

    jwt_secret: str = "change-me-in-production-alfa-credit-cabinet"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24

    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"

    ai_models_dir: Path = backend_root / "ai_models"
    ai_model_repo_id: str = "google/gemma-4-E4B-it-qat-q4_0-gguf"
    ai_model_filename: str = "gemma-4-E4B_q4_0-it.gguf"
    ai_prompt_filename: str = "prompt.md"

    mock_base_url: str = "http://127.0.0.1:8000"

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


def get_db_url() -> str:
    return (
        f'postgresql+asyncpg://{settings.POSTGRES_USER}:{settings.POSTGRES_PASSWORD}@'
        f'{settings.POSTGRES_HOST}:{settings.POSTGRES_PORT}/{settings.POSTGRES_DB}'
    )


@lru_cache
def get_settings() -> Settings:
    return Settings() # type: ignore


settings = get_settings()
