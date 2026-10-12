from dataclasses import dataclass

from .models import GenerateSqlRequest
from .sql_safety import validate_read_only_sql


@dataclass
class MockAgentProvider:
    """Deterministic local provider used until a real LLM is configured."""

    name: str = "mock"
    model: str = "mock-text-to-sql-v1"

    def generate(self, request: GenerateSqlRequest) -> tuple[str, str]:
        table = request.schema[0] if request.schema else None
        table_name = table.name if table else "orders"
        columns = table.columns if table else []
        selected = ", ".join(columns[:5]) if columns else "*"
        question = request.question.lower()

        if any(word in question for word in ("đếm", "count", "bao nhiêu", "số lượng", "how many")):
            sql = f"SELECT COUNT(*) AS total_rows FROM {table_name}"
            title = f"Row count for {table_name}"
        else:
            sql = f"SELECT {selected} FROM {table_name} LIMIT 10"
            title = request.question[:80].capitalize()

        return title, validate_read_only_sql(sql)

