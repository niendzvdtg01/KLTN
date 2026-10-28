import pytest
from fastapi.testclient import TestClient

from app import main
from app.main import app
from app.provider import MockAgentProvider


client = TestClient(app)


@pytest.fixture(autouse=True)
def force_mock_provider(monkeypatch):
    """Pin the Mock provider so tests are deterministic regardless of OPENAI_API_KEY."""
    monkeypatch.setattr(main, "provider", MockAgentProvider())


def test_health_does_not_require_key() -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "provider": "mock"}


def test_generate_sql_requires_mock_key() -> None:
    response = client.post("/v1/agent/generate-sql", json={"question": "đếm đơn hàng"})
    assert response.status_code == 401


def test_generate_sql_returns_read_only_query() -> None:
    response = client.post(
        "/v1/agent/generate-sql",
        headers={"X-API-Key": "mock-ai-agent-key"},
        json={
            "question": "đếm đơn hàng",
            "schema": [{"name": "orders", "columns": ["id", "created_at"]}],
        },
    )
    assert response.status_code == 200
    assert response.json()["sql"] == "SELECT COUNT(*) AS total_rows FROM orders;"
    assert response.json()["read_only"] is True



def test_step_calls_tool_then_finishes() -> None:
    body = {"question": "đếm đơn hàng", "schema": [{"name": "orders", "columns": ["id"]}], "remaining_steps": 5}
    first = client.post("/v1/agent/step", headers={"X-API-Key": "mock-ai-agent-key"}, json=body)
    assert first.status_code == 200
    assert first.json()["action"] == "tool"
    assert first.json()["tool"] == "describe_table"

    body["steps"] = [{"tool": "describe_table", "args": {"table": "orders"}, "ok": True, "result": [{"name": "id"}]}]
    second = client.post("/v1/agent/step", headers={"X-API-Key": "mock-ai-agent-key"}, json=body)
    assert second.status_code == 200
    assert second.json()["action"] == "final"
    assert second.json()["sql"] == "SELECT COUNT(*) AS total_rows FROM orders;"


def test_step_requires_sql_on_final() -> None:
    from app.models import AgentStepResponse

    with pytest.raises(ValueError):
        AgentStepResponse(action="final", thought="x")
