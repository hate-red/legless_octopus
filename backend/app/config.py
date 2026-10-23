from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    app_name: str = "Умный кредитный кабинет"
    app_env: str = "development"
    api_prefix: str = "/api"

    database_url: str = (
        "postgresql+asyncpg://alfa:alfa_secret@localhost:5432/alfa_credit"
    )

    jwt_secret: str = "change-me-in-production-alfa-credit-cabinet"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24

    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"

    ai_model_name: str = "paraphrase-multilingual-MiniLM-L12-v2"
    ai_similarity_threshold: float = 0.5
    ai_enabled: bool = True

    mock_base_url: str = "http://127.0.0.1:8000"

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
