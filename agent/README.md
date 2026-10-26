# KLTN AI Agent (FastAPI)

Lõi agent độc lập cho flow Text-to-SQL, sử dụng OpenAI Responses API. Model được ép trả Structured Output JSON gồm title, SQL và chart metadata. Các rule trước đây chỉ còn là test seam; production không dùng mock provider.

## Chạy local

```bash
cd agent
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload --port 8001 --ws websockets
```

Agent luôn bind `0.0.0.0` trong Docker và publish port `8001`. Backend local gọi `http://localhost:8001`; backend trong Compose gọi `http://agent:8001`.

API docs: <http://localhost:8001/docs>

## API

`GET /health` không cần key. Các endpoint agent cần header `X-API-Key: mock-ai-agent-key` và gọi OpenAI bằng `OPENAI_API_KEY` trong `.env`. Có thể kiểm tra `/health`: trạng thái `degraded` nghĩa là process chạy nhưng chưa nhận được OpenAI key.

```bash
curl -X POST http://localhost:8001/v1/agent/generate-sql \
  -H 'Content-Type: application/json' \
  -H 'X-API-Key: mock-ai-agent-key' \
  -d '{
    "question": "Lấy 10 đơn hàng gần nhất",
    "schema": [{"name": "orders", "columns": ["id", "customer_name", "created_at"]}]
  }'
```

Agent chỉ trả SQL `SELECT`/`WITH`, một statement, không comment, chỉ dùng table/column có trong schema và chặn các keyword ghi/xóa dữ liệu. Response có `rule`, `chart` và `cache_hit`; cache in-process được khóa bởi question, schema và conversation context. OpenAI Structured Outputs được dùng để giảm lỗi JSON/field và SQL vẫn được validate độc lập trước khi trả về.

