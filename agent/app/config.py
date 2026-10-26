from functools import lru_cache

from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "KLTN AI Agent"
    api_key: str = "mock-ai-agent-key"
    cors_origins: str = "http://localhost:3000"
    max_schema_chars: int = 40_000
    cache_ttl_seconds: int = 300
    openai_api_key: str = Field(default="", validation_alias=AliasChoices("OPENAI_API_KEY", "AGENT_OPENAI_API_KEY"))
    openai_model: str = Field(default="gpt-4o-mini", validation_alias=AliasChoices("OPENAI_MODEL", "AGENT_OPENAI_MODEL"))
    ai_timeout: float = Field(default=60.0, validation_alias=AliasChoices("AI_TIMEOUT", "AGENT_AI_TIMEOUT"))
    ai_max_tokens: int = Field(default=1200, validation_alias=AliasChoices("AI_MAX_TOKENS", "AGENT_AI_MAX_TOKENS"))
    ai_retry_max_tokens: int = Field(default=2048, validation_alias=AliasChoices("AI_RETRY_MAX_TOKENS", "AGENT_AI_RETRY_MAX_TOKENS"))
    ai_reasoning_effort: str = Field(default="low", validation_alias=AliasChoices("AI_REASONING_EFFORT", "AGENT_AI_REASONING_EFFORT"))
    model_config = SettingsConfigDict(env_file=".env", env_prefix="AGENT_", extra="ignore")

    @property
    def allowed_origins(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()

