# backend/app/core/config.py

from functools import lru_cache
from typing import List

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    APP_NAME: str = "Doc2Excel Pro API"
    APP_ENV: str = "development"
    DEBUG: bool = True

    DATABASE_URL: str = "sqlite:///./doc2excel.db"
    STORAGE_ROOT: str = "./storage"
    MAX_UPLOAD_MB: int = 25

    ALLOWED_EXTENSIONS: str = ".pdf,.png,.jpg,.jpeg,.webp"

    ENABLE_AI_SCAN: bool = True
    AI_PROVIDER: str = "openai"
    AI_MODEL: str = "gpt-5.4"
    AI_API_KEY: str = ""

    CORS_ORIGINS: List[str] | str = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def parse_cors_origins(cls, value):
        if isinstance(value, str):
            value = value.strip()
            if value.startswith("[") and value.endswith("]"):
                value = value[1:-1]
            return [v.strip().strip('"').strip("'") for v in value.split(",") if v.strip()]
        return value

    @property
    def allowed_extensions_set(self) -> set[str]:
        return {ext.strip().lower() for ext in self.ALLOWED_EXTENSIONS.split(",") if ext.strip()}


@lru_cache
def get_settings() -> Settings:
    return Settings()