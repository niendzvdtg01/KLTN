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

