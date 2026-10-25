from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy.engine import URL

BACKEND_ROOT = Path(__file__).resolve().parent.parent
PROJECT_ROOT = BACKEND_ROOT.parent


class Settings(BaseSettings):
    project_root: Path = PROJECT_ROOT
    backend_root: Path = BACKEND_ROOT

    # DATABASE_URL takes precedence. The POSTGRES_* fields remain as a
    # convenient fallback for local runs and docker-compose.
    database_url: str | None = None
    postgres_db: str = "alfa_credit"
    postgres_user: str = "alfa"
    postgres_password: str = "alfa_secret"
    postgres_host: str = "localhost"
    postgres_port: int = 5432

    model_config = SettingsConfigDict(
        env_file=(PROJECT_ROOT / ".env", BACKEND_ROOT / ".env"),
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

    ai_models_dir: Path = BACKEND_ROOT / "ai_models"
    ai_model_repo_id: str = "google/gemma-4-E4B-it-qat-q4_0-gguf"
    ai_model_filename: str = "gemma-4-E4B_q4_0-it.gguf"
    ai_prompt_filename: str = "prompt.md"
    ai_n_ctx: int = 2048
    ai_n_threads: int | None = None

    mock_base_url: str = "http://127.0.0.1:8000"

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


def get_db_url() -> str:
    if settings.database_url and settings.database_url.strip():
        return settings.database_url.strip()

    return URL.create(
        drivername="postgresql+asyncpg",
        username=settings.postgres_user,
        password=settings.postgres_password,
        host=settings.postgres_host,
        port=settings.postgres_port,
        database=settings.postgres_db,
    ).render_as_string(hide_password=False)


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]


settings = get_settings()
