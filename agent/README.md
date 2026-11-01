# KLTN AI Agent (FastAPI)

Dịch vụ AI của KLTN. Nhận câu hỏi + schema từ backend, gọi OpenAI Responses API với **Structured Outputs** (JSON schema `strict`) và trả về quyết định của agent, câu SQL read-only hoặc phần đánh giá kết quả.

Agent **stateless** và **không kết nối database của người dùng**: backend Spring Boot thực thi tool/SQL rồi gửi kết quả lại. Xem toàn bộ luồng trong [`../docs/architecture.md`](../docs/architecture.md#3-agent-loop).

## Cấu trúc

```text
agent/
├── app/
│   ├── main.py        FastAPI app, routing, cache in-process cho generate-sql, CORS
│   ├── config.py      Settings (pydantic-settings), đọc .env
│   ├── models.py      Pydantic model cho request/response
│   ├── provider.py    OpenAIAgentProvider (prompt, JSON schema, retry khi bị cắt) và MockAgentProvider
│   ├── security.py    Kiểm tra header X-API-Key
│   └── sql_safety.py  Kiểm tra SQL read-only
├── tests/test_agent.py
├── requirements.txt   fastapi, uvicorn, pydantic-settings, openai, pytest, httpx
├── Dockerfile         python:3.12-slim, port 8001
└── .env.example
```

## Chạy local

```bash
cd agent
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env            # điền OPENAI_API_KEY
uvicorn app.main:app --reload --port 8001 --ws websockets
```

- Swagger UI: <http://localhost:8001/docs>
- Health: `curl http://localhost:8001/health`

Trong Docker Compose, agent đọc `./agent/.env` (bắt buộc phải tồn tại) và được backend gọi qua `http://agent:8001`.

## Cấu hình

Đọc từ biến môi trường hoặc `agent/.env`. Các biến OpenAI chấp nhận cả tên có tiền tố `AGENT_` (VD `AGENT_OPENAI_MODEL`).

| Biến | Mặc định | Ý nghĩa |
|---|---|---|
| `OPENAI_API_KEY` | trống | Key OpenAI. **Trống ⇒ dùng `MockAgentProvider`** |
| `OPENAI_MODEL` | `gpt-4o-mini` | Model |
| `AI_TIMEOUT` | `60` | Timeout (giây) mỗi request OpenAI; SDK tự retry tối đa 2 lần |
| `AI_MAX_TOKENS` | `1200` | `max_output_tokens` lần đầu |
| `AI_RETRY_MAX_TOKENS` | `2048` | Budget khi gọi lại do output bị cắt (`status = incomplete` hoặc rỗng) |
| `AI_REASONING_EFFORT` | `low` | Chỉ gửi cho model `gpt-5*`, `o1*`, `o3*`, `o4*` |
| `AGENT_API_KEY` | `mock-ai-agent-key` | Key mà backend phải gửi trong `X-API-Key`. Đổi khi triển khai thật |
| `AGENT_CORS_ORIGINS` | `http://localhost:3000` | Danh sách origin, phân tách bằng dấu phẩy |
| `AGENT_CACHE_TTL_SECONDS` | `300` | TTL cache in-process của `generate-sql` |
| `AGENT_MAX_SCHEMA_CHARS` | `40000` | Khai báo trong settings, hiện chưa được dùng |

### Provider

| Provider | Khi nào | Hành vi |
|---|---|---|
| `OpenAIAgentProvider` (`openai`) | Có `OPENAI_API_KEY` | Gọi OpenAI thật |
| `MockAgentProvider` (`mock`) | Không có key | `step`: lần đầu gọi `describe_table` bảng đầu tiên, lần sau trả `SELECT COUNT(*) AS total_rows FROM <bảng>`; `evaluate`: tóm tắt số dòng. Chỉ dùng cho test/dev |

Kiểm tra provider đang chạy: `GET /health` → `{"status":"ok","provider":"openai"}` hoặc `"provider":"mock"`.

## Endpoint

| Method | Path | Key | Mô tả |
|---|---|---|---|
| GET | `/health` | Không | Trạng thái + provider |
| POST | `/v1/agent/step` | Có | Một bước của agent loop: trả `action = tool` (`describe_table`, `sample_values`, `run_sql`) hoặc `action = final` kèm `sql`, `title`, `chart` |
| POST | `/v1/agent/evaluate` | Có | Phân tích kết quả (`analysis`, `highlights`, `chart`) |
| POST | `/v1/agent/generate-sql` | Có | Sinh SQL một phát (có hỗ trợ `previous_sql` + `error` để tự sửa, `examples` few-shot) |
| POST | `/v1/agent/chat` | Có | Alias của `generate-sql` |

Request/response đầy đủ: [`../docs/api.md#8-ai-agent-api-nội-bộ`](../docs/api.md#8-ai-agent-api-nội-bộ).

Ví dụ:

```bash
curl -X POST http://localhost:8001/v1/agent/step \
  -H 'Content-Type: application/json' -H 'X-API-Key: mock-ai-agent-key' \
  -d '{
    "question": "Có bao nhiêu đơn hàng trong tháng này?",
    "schema": [{"name": "orders", "columns": ["id", "status", "created_at"]}],
    "dialect": "PostgreSQL",
    "steps": [],
    "remaining_steps": 8
  }'
```

Mã lỗi: `401` sai/thiếu key; `422` request sai schema; `502` lỗi từ provider hoặc SQL không hợp lệ (thông điệp ≤ 500 ký tự, không chứa prompt/response thô/key).

## Prompt và đảm bảo đầu ra

- Mọi lời gọi dùng `text.format = json_schema` với `strict: true`, sau đó parse lại bằng Pydantic (`AgentPlan`, `AgentStepResponse`, `EvaluateResponse`).
- Prompt `step` yêu cầu: chỉ dùng bảng/cột trong schema; kết thúc sớm nếu đủ thông tin; đọc lỗi khi bước trước `ok=false` và không lặp lại lời gọi lỗi; dùng `sample_values` khi lọc theo giá trị văn bản chưa chắc chính tả; bắt buộc `final` khi `remaining_steps = 1`; `thought` là một câu ngắn cùng ngôn ngữ với câu hỏi; tuân theo `accepted_examples` nếu có; viết đúng cú pháp của `dialect` (cách giới hạn dòng, hàm ngày/chuỗi, quote identifier).
- Prompt `evaluate` đóng vai data analyst, trả lời cùng ngôn ngữ câu hỏi, 2–5 highlight, chart x/y phải là cột có thật trong kết quả. Chỉ 50 dòng đầu được đưa vào prompt.
- `generate-sql` còn kiểm tra thêm bảng sau `FROM`/`JOIN` và cột trong `SELECT` phải nằm trong schema.

## SQL safety (`sql_safety.py`)

`validate_read_only_sql` chấp nhận đúng một statement bắt đầu bằng `SELECT` hoặc `WITH`, không chứa `--`, `/*`, `*/`, không chứa các từ khóa `insert update delete drop alter truncate create replace merge grant revoke call execute outfile load_file dumpfile lock unlock set use handler into`, và chuẩn hóa về một dấu `;` cuối. Đây chỉ là lớp đầu; backend luôn kiểm tra lại bằng `SqlSafetyValidator` và chạy với kết nối read-only.

## Test

```bash
cd agent
source .venv/bin/activate
pytest
```

Test dùng `MockAgentProvider`, không gọi OpenAI: kiểm tra `/health` không cần key, endpoint yêu cầu key, SQL trả về là read-only, vòng `step` gọi tool rồi kết thúc, và `final` bắt buộc có `sql`.
