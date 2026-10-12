from typing import Any

from pydantic import BaseModel, Field, field_validator


class TableSchema(BaseModel):
    name: str = Field(..., min_length=1, max_length=128)
    columns: list[str] = Field(default_factory=list, max_length=200)


class GenerateSqlRequest(BaseModel):
    question: str = Field(..., min_length=1, max_length=2_000)
    schema: list[TableSchema] = Field(default_factory=list, max_length=100)
    conversation: list[dict[str, str]] = Field(default_factory=list, max_length=20)

    @field_validator("question")
    @classmethod
    def strip_question(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("question must not be blank")
        return value


class GenerateSqlResponse(BaseModel):
    title: str
    sql: str
    rows: list[dict[str, Any]] = Field(default_factory=list)
    provider: str = "mock"
    model: str = "mock-text-to-sql-v1"
    read_only: bool = True


class HealthResponse(BaseModel):
    status: str
    provider: str

