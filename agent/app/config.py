from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "KLTN AI Agent"
    api_key: str = "mock-ai-agent-key"
    cors_origins: str = "http://localhost:3000"
    max_schema_chars: int = 40_000
    model_config = SettingsConfigDict(env_file=".env", env_prefix="AGENT_", extra="ignore")

    @property
    def allowed_origins(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()

