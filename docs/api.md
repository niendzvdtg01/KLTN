# API Reference

- Backend base URL: `http://localhost:8081` (biến `SERVER_PORT` / `BACKEND_PORT`).
- Mọi endpoint backend có tiền tố `/v1`, body JSON (`Content-Type: application/json`).
- Thời gian (`createdAt`, `updatedAt`, ...) là `LocalDateTime` ISO-8601 không có timezone, ví dụ `2026-11-01T15:04:05.123456`.
- Lỗi trả theo định dạng `ApiError` (xem [cuối tài liệu](#mã-lỗi)).

## Mục lục

1. [Xác thực](#1-xác-thực)
2. [User](#2-user)
3. [Database engine](#3-database-engine)
4. [Data source](#4-data-source)
5. [Conversation](#5-conversation)
6. [Message, chat và feedback](#6-message-chat-và-feedback)
7. [Query thủ công](#7-query-thủ-công)
8. [AI agent API (nội bộ)](#8-ai-agent-api-nội-bộ)
9. [Mã lỗi](#mã-lỗi)

---

## 1. Xác thực

Backend dùng JWT lưu trong cookie tên `access_cookie`. Trình duyệt phải gửi request với `credentials: "include"`; với `curl` dùng cookie jar:

```bash
curl -c cookies.txt -X POST http://localhost:8081/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"an@example.com","password":"matkhau123"}'

curl -b cookies.txt http://localhost:8081/v1/user/me
```

| Tình huống | Kết quả |
|---|---|
| Không có cookie | `401`, `text/plain`: `Missing required cookie` |
| Token sai / hết hạn / backend đã restart | `403`, `text/plain`: `Invalid or expired token` |

### `POST /v1/auth/login` — public

Request:

```json
{ "email": "an@example.com", "password": "matkhau123" }
```

Response `200`, body text `Login sucessfully!!!`, header:

```text
Set-Cookie: access_cookie=<jwt>; Path=/; Max-Age=3600; SameSite=Lax
```

Lỗi: `401` `"Email hoặc mật khẩu không đúng"` / `"Email hoặc mật khẩu không hợp lệ"` (thiếu trường).

### `/logout`

Do Spring Security xử lý. Xóa cookie `access_cookie` và trả `200`. Cần đang đăng nhập (có cookie hợp lệ).

---

## 2. User

### `POST /v1/user/create_user` — public

```json
{ "fullName": "Nguyễn Văn An", "email": "an@example.com", "password": "matkhau123" }
```

- `fullName`, `email`, `password` bắt buộc; `password` tối thiểu 8 ký tự → nếu sai: `400`.
- Email đã tồn tại (không phân biệt hoa thường) → `409 "Email đã tồn tại"`.

Response `201`:

```json
{ "id": 1, "fullName": "Nguyễn Văn An", "email": "an@example.com" }
```

### `GET /v1/user/me`

Response `200`: `UserResponse` như trên.

### `PUT /v1/user/me`

```json
{ "fullName": "Nguyễn Văn An", "email": "an.nguyen@example.com" }
```

Cả hai trường bắt buộc (`400`); email trùng user khác → `409`. Không đổi mật khẩu qua endpoint này.

### `DELETE /v1/user/me`

`204`. Lưu ý: nếu user còn data source, thao tác lỗi `500` do ràng buộc `fk_data_sources_owner ON DELETE RESTRICT`.

---

## 3. Database engine

### `GET /v1/db-engines`

Danh sách engine đang `enabled`, sắp theo `sort_order`. Dùng để dựng dropdown và điền port mặc định.

```json
[
  {
    "code": "POSTGRESQL",
    "displayName": "PostgreSQL",
    "sqlDialect": "PostgreSQL",
    "defaultPort": 5432,
    "defaultSchema": "public",
    "supportsSchema": true,
    "supportsSsl": true
  }
]
```

Giá trị `code` hiện có: `MYSQL`, `MARIADB`, `POSTGRESQL`, `SQLSERVER`, `ORACLE`.

---

## 4. Data source

### Đối tượng request `DataSourceRequest`

| Trường | Kiểu | Bắt buộc | Ràng buộc / mặc định |
|---|---|---|---|
| `name` | string | ✔ | ≤ 150 ký tự, unique theo user (không phân biệt hoa thường) |
| `dbType` | string | ✔ | `code` của engine đang bật |
| `host` | string | ✔ | `[A-Za-z0-9._-]{1,255}` hoặc IPv6 trong `[...]` |
| `port` | int | ✔ | 1–65535 |
| `databaseName` | string | ✔ | `[A-Za-z0-9_.$-]{1,255}`; với Oracle là service name |
| `username` | string | ✔ | |
| `password` | string | | Tạo mới: trống = không mật khẩu. Cập nhật: trống = giữ mật khẩu cũ |
| `schemaName` | string | | Chỉ áp dụng khi engine `supportsSchema`; identifier hợp lệ |
| `sslEnabled` | bool | | Mặc định `false`; bỏ qua nếu engine không hỗ trợ SSL |
| `connectTimeoutSeconds` | int | | 1–120, mặc định 10 |
| `queryTimeoutSeconds` | int | | 1–600, mặc định 30 |
| `maxRows` | int | | 1–10000, mặc định 1000 |
| `properties` | object | | Thuộc tính JDBC bổ sung, ≤ 30 cặp; xem [quy tắc](architecture.md#74-thông-tin-kết-nối) |

### Đối tượng response `DataSourceResponse`

```json
{
  "id": 3,
  "name": "Rfam public",
  "dbType": "MYSQL",
  "host": "mysql-rfam-public.ebi.ac.uk",
  "port": 4497,
  "databaseName": "Rfam",
  "username": "rfamro",
  "schemaName": null,
  "sslEnabled": false,
  "connectTimeoutSeconds": 10,
  "queryTimeoutSeconds": 30,
  "maxRows": 1000,
  "properties": { "characterEncoding": "UTF-8" },
  "status": "ACTIVE",
  "lastConnectionStatus": "SUCCESS",
  "lastConnectionError": null,
  "schemaJson": "{\"database\":\"Rfam\",\"schema\":null,\"dialect\":\"MySQL\",\"tables\":[...]}",
  "lastSyncedAt": "2026-11-01T15:04:05.123456",
  "createdAt": "2026-11-01T15:00:00.000000",
  "updatedAt": "2026-11-01T15:04:05.123456"
}
```

Không bao giờ có `password`. `schemaJson` là chuỗi JSON (xem [định dạng snapshot](database.md#5-định-dạng-schema-snapshot)).

### `POST /v1/data-sources`

Tạo data source, status `ACTIVE`. Không tự test kết nối hay sync schema. Response `201` `DataSourceResponse`.

```bash
curl -b cookies.txt -X POST http://localhost:8081/v1/data-sources \
  -H 'Content-Type: application/json' \
  -d '{"name":"Rfam public","dbType":"MYSQL","host":"mysql-rfam-public.ebi.ac.uk","port":4497,
       "databaseName":"Rfam","username":"rfamro","password":""}'
```

Lỗi: `400` dữ liệu không hợp lệ / engine không hỗ trợ / thuộc tính JDBC bị chặn; `409` trùng tên.

### `GET /v1/data-sources`

Mọi data source của user (kể cả `ARCHIVED`), sắp theo `updatedAt` giảm dần.

### `GET /v1/data-sources/{id}`

`404` nếu không tồn tại hoặc không thuộc user.

### `PUT /v1/data-sources/{id}`

Thay toàn bộ cấu hình (body như khi tạo). Reset `lastConnectionStatus`/`lastConnectionError`; nếu không bị archive thì status về `ACTIVE`. `properties` được đồng bộ: key không còn trong request bị xóa. Schema snapshot cũ **được giữ** – nên sync lại nếu đổi database.

### `DELETE /v1/data-sources/{id}`

Archive (status `ARCHIVED`), `204`. Conversation cũ vẫn đọc được nhưng không thể chat/query hay tạo conversation mới với data source này. Không có API bỏ archive.

### `POST /v1/data-sources/{id}/test-connection`

Mở thử kết nối với cấu hình đã lưu.

- Thành công: `200` `DataSourceResponse` với `lastConnectionStatus = "SUCCESS"`.
- Thất bại: lưu `lastConnectionStatus = "FAILED"` + lỗi, trả `400 "Không thể kết nối tới data source: ..."`.

### `POST /v1/data-sources/test-connection?sourceId={id}`

Test cấu hình **chưa lưu** (body `DataSourceRequest`). Nếu truyền `sourceId` và `password` trống, dùng password đã lưu của data source đó (dùng cho form sửa). Không ghi gì vào DB. Luôn trả `200` khi request hợp lệ:

```json
{
  "success": true,
  "message": "Kết nối thành công",
  "databaseProduct": "MySQL",
  "databaseVersion": "8.0.32",
  "latencyMs": 412
}
```

Khi thất bại: `success: false`, `message` là lỗi đã làm sạch, `databaseProduct`/`databaseVersion` = `null`.

### `POST /v1/data-sources/{id}/sync-schema`

Đọc metadata (bảng, view, partitioned table; tối đa 500 bảng; mỗi cột gồm tên, kiểu, nullable) và lưu vào `schemaJson`, cập nhật `lastSyncedAt`. Không đọc dữ liệu. `400` nếu data source đã archive hoặc kết nối lỗi.

---

## 5. Conversation

### `ConversationResponse`

```json
{
  "id": 7,
  "title": "Phân tích Rfam",
  "status": "ACTIVE",
  "dataSourceId": 3,
  "dataSourceName": "Rfam public",
  "lastMessageAt": "2026-11-01T15:10:00.000000",
  "createdAt": "2026-11-01T15:05:00.000000",
  "updatedAt": "2026-11-01T15:10:00.000000"
}
```

### `POST /v1/conversations`

```json
{ "title": "Phân tích Rfam", "dataSourceId": 3 }
```

- `title` 1–255 ký tự, `dataSourceId` bắt buộc → `400`.
- Data source không thuộc user → `404`; data source không `ACTIVE` → `400`.

Response `201`.

### `GET /v1/conversations`

Mọi conversation của user (kể cả `ARCHIVED`), sắp theo `updatedAt` giảm dần.

### `GET /v1/conversations/{id}`

### `PATCH /v1/conversations/{id}`

```json
{ "title": "Tên mới" }
```

### `DELETE /v1/conversations/{id}`

Archive, `204`. Lịch sử vẫn đọc được; không gửi message hay query được nữa.

---

## 6. Message, chat và feedback

### `MessageResponse`

```json
{
  "id": 42,
  "role": "ASSISTANT",
  "content": "Top 5 họ RNA có nhiều vùng nhất\n\nSELECT rfam_acc, rfam_id, num_full FROM family ORDER BY num_full DESC LIMIT 5;",
  "metadata": "{\"title\":\"...\",\"sql\":\"...\",\"question\":\"...\",\"queryId\":18,\"attempts\":1,\"chart\":{\"type\":\"bar\",\"x\":\"rfam_id\",\"y\":\"num_full\",\"title\":\"...\"},\"evaluation\":\"...\",\"highlights\":[\"...\"]}",
  "createdAt": "2026-11-01T15:10:00.000000"
}
```

`role` ∈ `USER`, `ASSISTANT`, `TOOL` (`SYSTEM` dự phòng). `metadata` là chuỗi JSON hoặc `null`; nội dung theo role xem [architecture.md §3.3](architecture.md#33-message-được-lưu).

### `GET /v1/conversations/{id}/messages`

Toàn bộ message theo thứ tự thời gian tăng dần (chưa phân trang).

### `POST /v1/conversations/{id}/messages`

Gửi câu hỏi và chờ agent loop chạy xong (đồng bộ, có thể mất hàng chục giây).

```json
{ "content": "Top 5 họ RNA có nhiều vùng nhất" }
```

- `content` 1–10.000 ký tự.
- Conversation phải `ACTIVE`, data source phải `ACTIVE` → nếu không: `400`.
- Nên sync schema trước; nếu snapshot trống agent trả lỗi “Không có schema được đồng bộ để sinh SQL”.

Response `201` `ChatResponse`:

```json
{
  "message": { "id": 42, "role": "ASSISTANT", "content": "...", "metadata": "{...}", "createdAt": "..." },
  "query": {
    "id": 18,
    "question": "Top 5 họ RNA có nhiều vùng nhất",
    "generatedSql": "SELECT rfam_acc, rfam_id, num_full FROM family ORDER BY num_full DESC LIMIT 5",
    "status": "SUCCESS",
    "resultJson": "{\"columns\":[\"rfam_acc\",\"rfam_id\",\"num_full\"],\"rows\":[{...}],\"rowLimit\":1000}",
    "rowCount": 5,
    "executionTimeMs": 231,
    "errorMessage": null,
    "createdAt": "..."
  },
  "chartType": "bar",
  "chartX": "rfam_id",
  "chartY": "num_full",
  "chartTitle": "Top 5 họ RNA theo số vùng",
  "evaluation": "tRNA chiếm áp đảo với hơn 5,3 triệu vùng ...",
  "highlights": ["tRNA dẫn đầu với 5.335.975 vùng", "..."],
  "attempts": 1,
  "cacheHit": false,
  "steps": [
    { "tool": "describe_table", "thought": "Xem cấu trúc bảng family", "args": { "table": "family" }, "ok": true, "result": [ ... ] },
    { "tool": "final_answer", "thought": "Sắp xếp theo num_full", "args": { "sql": "SELECT ..." }, "ok": true, "result": { "rowCount": 5 } }
  ]
}
```

| Trường | Ý nghĩa |
|---|---|
| `chartType` | `table`, `bar`, `line`, `pie`, `number` (mặc định `table`) |
| `chartX` / `chartY` | Tên cột trong kết quả, có thể `null` |
| `evaluation`, `highlights` | `null` / `[]` nếu bước evaluate lỗi |
| `attempts` | Số lần agent chốt SQL cuối (≥ 1) |
| `cacheHit` | Luôn `false` trong luồng agent loop; xem `query.executionTimeMs = 0` để biết kết quả lấy từ Redis |
| `steps` | Các bước đã chạy; bước lỗi có `ok: false` và `error` |

Lỗi `400` khi agent bỏ cuộc: `"Agent vẫn gặp lỗi sau 3 lần thử lại: ..."` hoặc `"Agent không tìm được câu trả lời sau 8 bước: ..."`. Khi đó toàn bộ lượt hỏi được rollback.

### `POST /v1/conversations/{id}/messages/stream`

Giống endpoint trên nhưng trả `text/event-stream`. Request header `Accept: text/event-stream`.

```text
event:thought
data:{"step":1,"tool":"describe_table","message":"Xem cấu trúc bảng family","args":{"table":"family"}}

event:observation
data:{"step":1,"tool":"describe_table","status":"ok","message":"12 mục"}

event:thought
data:{"step":2,"tool":"final_answer","message":"Sắp xếp theo num_full","args":{"sql":"SELECT ..."}}

event:observation
data:{"step":2,"tool":"final_answer","status":"ok","message":"Chạy thành công, 5 dòng"}

event:result
data:{ ...ChatResponse... }
```

Event `retry`: `{"attempt":1,"maxAttempts":3,"message":"<lỗi>","action":"Đã gửi lỗi lại cho agent để tự sửa"}`. Event `error`: `{"message":"..."}`, sau đó stream đóng. Lỗi xác thực/ownership trước khi stream bắt đầu vẫn trả HTTP status bình thường.

```bash
curl -N -b cookies.txt -X POST http://localhost:8081/v1/conversations/7/messages/stream \
  -H 'Content-Type: application/json' -H 'Accept: text/event-stream' \
  -d '{"content":"Có bao nhiêu họ RNA?"}'
```

### `POST /v1/conversations/{id}/messages/{messageId}/feedback`

```json
{ "rating": "UP", "correction": null }
```

- `rating` bắt buộc `UP` hoặc `DOWN` → nếu không: `400`.
- `correction` tùy chọn (ghi chú/SQL đúng mà user đề xuất); hiện chỉ được lưu, chưa đưa vào prompt.
- Message phải thuộc conversation → nếu không: `404`.
- Có thể gửi nhiều lần (mỗi lần một bản ghi). Rating `UP` trên message ASSISTANT sẽ được dùng làm few-shot example.

Response `201`, body rỗng.

---

## 7. Query thủ công

### `POST /v1/conversations/{id}/query`

Chạy SQL do user tự viết trên data source của conversation, không qua AI.

```json
{ "question": "Đếm số họ RNA", "sql": "SELECT COUNT(*) AS total FROM family" }
```

- `sql` bắt buộc, phải qua `SqlSafetyValidator` → nếu không: `400 "Chỉ cho phép một câu SQL đọc dữ liệu (SELECT/WITH)"`.
- `question` trống thì lưu bằng chính câu SQL.
- Conversation và data source phải `ACTIVE`.

Response `200` `QueryExecutionResponse` (như trường `query` ở trên). Lưu ý: SQL lỗi khi chạy **không** trả HTTP lỗi mà trả `200` với `status: "FAILED"` và `errorMessage`. Endpoint này không tạo message.

---

## 8. AI agent API (nội bộ)

Base URL `http://localhost:8001`. Swagger UI: `/docs`, OpenAPI: `/openapi.json`. Chỉ backend nên gọi trực tiếp. Mọi endpoint trừ `/health` cần header `X-API-Key: <AGENT_API_KEY>`, sai → `401 {"detail":"Invalid or missing X-API-Key"}`. Lỗi provider/validate → `502 {"detail":"..."}`; request sai schema → `422`.

Kiểu dùng chung:

```json
// TableSchema
{ "name": "family", "columns": ["rfam_acc", "rfam_id", "num_full"] }
// ChartSpec
{ "type": "bar", "x": "rfam_id", "y": "num_full", "series": [], "title": "..." }
```

Trường `schema` (alias của `schema_`) tối đa 100 bảng × 200 cột.

### `GET /health`

```json
{ "status": "ok", "provider": "openai" }
```

`provider = "mock"` khi chưa cấu hình `OPENAI_API_KEY` (agent chạy `MockAgentProvider`).

### `POST /v1/agent/step`

Một bước của agent loop.

Request:

| Trường | Kiểu | Ghi chú |
|---|---|---|
| `question` | string | 1–2000 ký tự |
| `schema` | TableSchema[] | Bắt buộc có ít nhất 1 bảng với provider OpenAI |
| `dialect` | string | VD `MySQL`, `PostgreSQL`, `T-SQL (SQL Server)`, `Oracle SQL`; mặc định `MySQL` |
| `conversation` | `{role, content}[]` | ≤ 20 |
| `examples` | `{question, sql}[]` | ≤ 10 |
| `steps` | `{tool, thought, args, ok, result, error}[]` | ≤ 30 bước đã chạy |
| `remaining_steps` | int | 1–30; khi = 1 agent bắt buộc trả `final` |

Response:

```json
{
  "action": "tool",
  "thought": "Kiểm tra giá trị thật của cột type",
  "tool": "sample_values",
  "table": "family",
  "column": "type",
  "sql": null,
  "title": null,
  "chart": null
}
```

`action = "tool"` phải có `tool` ∈ `describe_table`, `sample_values`, `run_sql`. `action = "final"` phải có `sql` (và thường có `title`, `chart`).

### `POST /v1/agent/evaluate`

Request: `question`, `sql`, `columns` (≤ 200), `rows` (≤ 1000, chỉ 50 dòng đầu vào prompt), `row_count`. Response:

```json
{
  "analysis": "…",
  "highlights": ["…", "…"],
  "chart": { "type": "bar", "x": "rfam_id", "y": "num_full", "series": [], "title": "…" }
}
```

### `POST /v1/agent/generate-sql` (alias `POST /v1/agent/chat`)

Sinh SQL một phát, không dùng tool. Hiện backend không dùng trong luồng chat.

Request: `question`, `schema`, `dialect`, `conversation`, `max_rows` (1–1000), `previous_sql` + `error` (để tự sửa), `examples`.

Response:

```json
{
  "title": "10 đơn hàng gần nhất",
  "sql": "SELECT id, customer_name, created_at FROM orders ORDER BY created_at DESC LIMIT 10;",
  "rows": [],
  "provider": "openai",
  "model": "gpt-4o-mini",
  "read_only": true,
  "rule": "openai_structured",
  "chart": { "type": "table", "x": null, "y": null, "series": [], "title": null },
  "cache_hit": false
}
```

SQL được kiểm tra read-only và phạm vi bảng/cột trong schema trước khi trả về; kết quả được cache trong RAM theo nội dung request.

```bash
curl -X POST http://localhost:8001/v1/agent/generate-sql \
  -H 'Content-Type: application/json' -H 'X-API-Key: mock-ai-agent-key' \
  -d '{"question":"Lấy 10 đơn hàng gần nhất",
       "schema":[{"name":"orders","columns":["id","customer_name","created_at"]}]}'
```

---

## Mã lỗi

Định dạng `ApiError` của backend:

```json
{
  "timestamp": "2026-11-01T08:00:00.123Z",
  "status": 404,
  "error": "Not Found",
  "message": "Không tìm thấy conversation",
  "path": "/v1/conversations/99"
}
```

| HTTP | Khi nào |
|---|---|
| 400 | Dữ liệu không hợp lệ, SQL không an toàn, tài nguyên đã archive, không kết nối được DB, agent bỏ cuộc |
| 401 | Thiếu cookie (text/plain), sai email/mật khẩu, principal không hợp lệ |
| 403 | JWT không hợp lệ hoặc hết hạn (text/plain) |
| 404 | Không tồn tại hoặc không thuộc user hiện tại |
| 409 | Trùng email, trùng tên data source |
| 500 | Lỗi không mong muốn (`"Đã xảy ra lỗi trên máy chủ."`) |
