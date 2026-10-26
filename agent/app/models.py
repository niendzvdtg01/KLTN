from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class TableSchema(BaseModel):
    name: str = Field(..., min_length=1, max_length=128)
    columns: list[str] = Field(default_factory=list, max_length=200)


class ChartSpec(BaseModel):
    type: Literal["table", "bar", "line", "pie", "number"] = "table"
    x: str | None = None
    y: str | None = None
    series: list[str] = Field(default_factory=list, max_length=10)
    title: str | None = None


class AgentPlan(BaseModel):
    title: str = Field(..., min_length=1, max_length=120)
    sql: str = Field(..., min_length=1, max_length=100_000)
    chart: ChartSpec = Field(default_factory=ChartSpec)


class SqlExample(BaseModel):
    """An accepted question -> SQL pair reused as a few-shot example."""

    question: str = Field(..., max_length=2_000)
    sql: str = Field(..., max_length=100_000)


class GenerateSqlRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    question: str = Field(..., min_length=1, max_length=2_000)
    schema_: list[TableSchema] = Field(default_factory=list, max_length=100)
    conversation: list[dict[str, str]] = Field(default_factory=list, max_length=20)
    max_rows: int = Field(default=1000, ge=1, le=1000)
    # Self-correction feedback: the SQL that just failed and the DB error it raised.
    previous_sql: str | None = Field(default=None, max_length=100_000)
    error: str | None = Field(default=None, max_length=4_000)
    # Cross-turn memory: accepted question -> SQL pairs used as few-shot examples.
    examples: list[SqlExample] = Field(default_factory=list, max_length=10)

    @model_validator(mode="before")
    @classmethod
    def normalize_schema_input(cls, value: Any) -> Any:
        if isinstance(value, dict) and "schema" in value and "schema_" not in value:
            value = {**value, "schema_": value["schema"]}
        return value

    @field_validator("question")
    @classmethod
    def strip_question(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("question must not be blank")
        return value


class EvaluateRequest(BaseModel):
    question: str = Field(..., min_length=1, max_length=2_000)
    sql: str = Field(..., min_length=1, max_length=100_000)
    columns: list[str] = Field(default_factory=list, max_length=200)
    rows: list[dict[str, Any]] = Field(default_factory=list, max_length=1000)
    row_count: int = Field(default=0, ge=0)


class EvaluateResponse(BaseModel):
    analysis: str
    highlights: list[str] = Field(default_factory=list)
    chart: ChartSpec = Field(default_factory=ChartSpec)


class GenerateSqlResponse(BaseModel):
    title: str
    sql: str
    rows: list[dict[str, Any]] = Field(default_factory=list)
    provider: str = "openai"
    model: str = "gpt-4o-mini"
    read_only: bool = True
    rule: str = "fallback_select"
    chart: ChartSpec = Field(default_factory=ChartSpec)
    cache_hit: bool = False


class HealthResponse(BaseModel):
    status: str
    provider: str

