import json
import re
from dataclasses import dataclass

from openai import OpenAI

from .config import Settings
from .models import (
    AgentPlan,
    ChartSpec,
    EvaluateRequest,
    EvaluateResponse,
    GenerateSqlRequest,
    TableSchema,
)
from .sql_safety import UnsafeSqlError, quote_identifier, validate_read_only_sql

_CHART_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "properties": {
        "type": {"type": "string", "enum": ["table", "bar", "line", "pie", "number"]},
        "x": {"anyOf": [{"type": "string"}, {"type": "null"}]},
        "y": {"anyOf": [{"type": "string"}, {"type": "null"}]},
        "series": {"type": "array", "items": {"type": "string"}},
        "title": {"anyOf": [{"type": "string"}, {"type": "null"}]},
    },
    "required": ["type", "x", "y", "series", "title"],
}

_PLAN_FORMAT = {
    "type": "json_schema",
    "name": "text_to_sql_plan",
    "strict": True,
    "schema": {
        "type": "object",
        "additionalProperties": False,
        "properties": {"title": {"type": "string"}, "sql": {"type": "string"}, "chart": _CHART_SCHEMA},
        "required": ["title", "sql", "chart"],
    },
}

_EVAL_FORMAT = {
    "type": "json_schema",
    "name": "data_evaluation",
    "strict": True,
    "schema": {
        "type": "object",
        "additionalProperties": False,
        "properties": {
            "analysis": {"type": "string"},
            "highlights": {"type": "array", "items": {"type": "string"}},
            "chart": _CHART_SCHEMA,
        },
        "required": ["analysis", "highlights", "chart"],
    },
}


@dataclass
class GeneratedQuery:
    title: str
    sql: str
    rule: str
    chart: ChartSpec


class OpenAIAgentProvider:
    """Real OpenAI Text-to-SQL provider with a strict structured-output contract."""

    name = "openai"

    def __init__(self, settings: Settings):
        self.api_key_configured = bool(settings.openai_api_key)
        self.model = settings.openai_model
        self.max_tokens = settings.ai_max_tokens
        self.retry_max_tokens = settings.ai_retry_max_tokens
        self.reasoning_effort = settings.ai_reasoning_effort
        self.client = OpenAI(api_key=settings.openai_api_key, timeout=settings.ai_timeout, max_retries=2) if self.api_key_configured else None

    def generate(self, request: GenerateSqlRequest) -> GeneratedQuery:
        if self.client is None:
            raise RuntimeError("OPENAI_API_KEY chưa được cấu hình")
        if not request.schema_:
            raise UnsafeSqlError("Không có schema được đồng bộ để sinh SQL")
        data = self._complete(self._instructions(request.schema_), self._input(request), _PLAN_FORMAT)
        plan = AgentPlan.model_validate(data)
        sql = validate_read_only_sql(plan.sql)
        self._validate_schema_scope(sql, request.schema_)
        return GeneratedQuery(plan.title, sql, "openai_structured", plan.chart)

    def evaluate(self, request: EvaluateRequest) -> EvaluateResponse:
        if self.client is None:
            raise RuntimeError("OPENAI_API_KEY chưa được cấu hình")
        instructions = (
            "You are a senior data analyst. You are given a user's question, the SQL that answered it, "
            "and a sample of the result rows. Write a concise, business-facing evaluation IN THE SAME "
            "LANGUAGE AS THE QUESTION: summarize what the data shows, call out notable trends, extremes "
            "or anomalies, and recommend the clearest chart for it. 'highlights' is 2-5 short bullet "
            "insights. Chart x/y must be actual column names present in the result or null. Return JSON "
            "matching the provided schema."
        )
        payload = json.dumps(
            {
                "question": request.question,
                "sql": request.sql,
                "columns": request.columns,
                "row_count": request.row_count,
                "rows_sample": request.rows[:50],
            },
            ensure_ascii=False,
            default=str,
        )
        data = self._complete(instructions, payload, _EVAL_FORMAT)
        return EvaluateResponse.model_validate(data)

    def _complete(self, instructions: str, payload: str, text_format: dict) -> dict:
        response = self._respond(instructions, payload, self.max_tokens, text_format)
        # Reasoning models spend part of the output budget on hidden reasoning tokens;
        # a tight budget truncates the JSON mid-string. Retry once with a larger budget.
        if self._is_truncated(response) and self.retry_max_tokens > self.max_tokens:
            response = self._respond(instructions, payload, self.retry_max_tokens, text_format)
        try:
            return json.loads(response.output_text)
        except json.JSONDecodeError as error:
            raise RuntimeError("Model trả về JSON bị cắt ngắn; hãy tăng AI_MAX_TOKENS/AI_RETRY_MAX_TOKENS") from error

    def _respond(self, instructions: str, payload: str, max_output_tokens: int, text_format: dict):
        kwargs = {
            "model": self.model,
            "instructions": instructions,
            "input": payload,
            "max_output_tokens": max_output_tokens,
            "text": {"format": text_format},
        }
        if self._supports_reasoning():
            kwargs["reasoning"] = {"effort": self.reasoning_effort}
        return self.client.responses.create(**kwargs)

    def _supports_reasoning(self) -> bool:
        model = self.model.lower()
        return model.startswith(("gpt-5", "o1", "o3", "o4"))

    @staticmethod
    def _is_truncated(response) -> bool:
        if getattr(response, "status", None) == "incomplete":
            return True
        text = (response.output_text or "").strip()
        return not text

    def _instructions(self, schema: list[TableSchema]) -> str:
        return (
            "You are a production Text-to-SQL agent. Generate exactly one read-only MySQL query. "
            "Use only tables and columns from the supplied schema. Never invent identifiers. "
            "Never use INSERT, UPDATE, DELETE, DDL, procedures, comments, multiple statements, "
            "or SELECT INTO. If the question cannot be answered from the schema, use a safe SELECT "
            "from the closest table and explain it in title. Return JSON matching the provided schema. "
            "Chart x and y must be actual selected column aliases or null. "
            "If the input contains 'previous_attempt', the prior SQL failed with the given error — "
            "produce a corrected query that avoids that error. If it contains 'accepted_examples', "
            "follow their style and column conventions. Schema: "
            + json.dumps([table.model_dump() for table in schema], ensure_ascii=False)
        )

    def _input(self, request: GenerateSqlRequest) -> str:
        payload: dict = {"question": request.question, "conversation": request.conversation[-20:]}
        if request.examples:
            payload["accepted_examples"] = [{"question": e.question, "sql": e.sql} for e in request.examples]
        if request.previous_sql and request.error:
            payload["previous_attempt"] = {"sql": request.previous_sql, "error": request.error}
        return json.dumps(payload, ensure_ascii=False)

    def _validate_schema_scope(self, sql: str, schema: list[TableSchema]) -> None:
        allowed_tables = {table.name.casefold() for table in schema}
        references = re.findall(r"\b(?:from|join)\s+[`]?([A-Za-z_][A-Za-z0-9_]*)[`]?", sql, re.IGNORECASE)
        if not references or any(reference.casefold() not in allowed_tables for reference in references):
            raise UnsafeSqlError("SQL truy cập table không có trong schema được cấp phép")

        allowed_columns = {column.casefold() for table in schema for column in table.columns}
        # Check explicit simple column references while allowing SQL keywords, functions and aliases.
        select_part = re.split(r"\bfrom\b", sql, maxsplit=1, flags=re.IGNORECASE)[0]
        identifiers = re.findall(r"\b[A-Za-z_][A-Za-z0-9_]*\b", select_part)
        aliases = {alias.casefold() for alias in re.findall(r"\bAS\s+([A-Za-z_][A-Za-z0-9_]*)", select_part, re.IGNORECASE)}
        ignored = {"select", "distinct", "as", "count", "sum", "avg", "min", "max", "date_format", "case", "when", "then", "else", "end"}
        ignored.update(table.casefold() for table in allowed_tables)
        ignored.update(aliases)
        unknown = [identifier for identifier in identifiers if identifier.casefold() not in allowed_columns and identifier.casefold() not in ignored]
        if unknown and "*" not in select_part:
            raise UnsafeSqlError("SQL dùng column không có trong schema được cấp phép")


# Kept only as a test seam for callers that inject a provider; production uses OpenAIAgentProvider.
class MockAgentProvider:
    name = "mock"
    model = "mock-disabled"

    def generate(self, request: GenerateSqlRequest) -> GeneratedQuery:
        table = request.schema_[0]
        table_name = quote_identifier(table.name)
        sql = validate_read_only_sql(f"SELECT COUNT(*) AS total_rows FROM {table_name};")
        return GeneratedQuery("Schema sample", sql, "mock_disabled", ChartSpec(type="table", title="Schema sample"))

    def evaluate(self, request: EvaluateRequest) -> EvaluateResponse:
        return EvaluateResponse(
            analysis=f"Query trả về {request.row_count} dòng.",
            highlights=[f"{len(request.columns)} cột: {', '.join(request.columns[:5])}"],
            chart=ChartSpec(type="table", title="Schema sample"),
        )
