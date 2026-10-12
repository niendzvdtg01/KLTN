# KLTN AI Agent (FastAPI)

Lõi agent độc lập cho flow Text-to-SQL. Provider hiện tại là mock deterministic, không gọi mạng và không cần API key thật. Có thể thay `MockAgentProvider` bằng provider LLM thật sau này.

## Chạy local

```bash
cd agent
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload --port 8001
```

API docs: <http://localhost:8001/docs>

## API

`GET /health` không cần key. Các endpoint agent cần header `X-API-Key: mock-ai-agent-key`.

```bash
curl -X POST http://localhost:8001/v1/agent/generate-sql \
  -H 'Content-Type: application/json' \
  -H 'X-API-Key: mock-ai-agent-key' \
  -d '{
    "question": "Lấy 10 đơn hàng gần nhất",
    "schema": [{"name": "orders", "columns": ["id", "customer_name", "created_at"]}]
  }'
```

Agent chỉ trả SQL `SELECT`/`WITH`, một statement, không comment và chặn các keyword ghi/xóa dữ liệu. Key được cấu hình bằng `AGENT_API_KEY`; giá trị mặc định chỉ dành cho development.

