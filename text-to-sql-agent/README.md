# KLTN Frontend

Giao diện web của KLTN, xây dựng bằng **Next.js 16 (App Router)**, **React 19**, **TypeScript**, **Tailwind CSS 4** và **Recharts**. Frontend chỉ giao tiếp với backend Spring Boot; không gọi trực tiếp AI agent.

> Next.js 16 có thay đổi lớn so với các phiên bản trước. Trước khi sửa code, đọc [`AGENTS.md`](AGENTS.md) và tài liệu trong `node_modules/next/dist/docs/`.

## Chạy local

Yêu cầu Node.js 22 và npm, backend đang chạy (mặc định `http://localhost:8081`).

```bash
npm ci
npm run dev                  # http://localhost:3000
```

Backend ở địa chỉ khác:

```bash
NEXT_PUBLIC_API_URL=http://localhost:9090 npm run dev
```

Origin của frontend phải nằm trong danh sách CORS của backend (`SecurityConfig`: `http://localhost:3000`, `http://localhost:5173`), nếu không trình duyệt sẽ chặn request có cookie.

## Scripts

| Lệnh | Mô tả |
|---|---|
| `npm run dev` | Dev server (dùng webpack: `next dev --webpack`) |
| `npm run lint` | ESLint |
| `npm run build` | Build production (output `standalone`) |
| `npm run start` | Chạy bản build |

## Màn hình

| Route | Nội dung |
|---|---|
| `/` và `/login` | Đăng nhập |
| `/register` | Đăng ký |
| `/workspace` | Không gian làm việc chính |

Workspace gồm:

- **Sidebar**: danh sách data source (badge engine, trạng thái kết nối) và danh sách conversation; tạo/đổi tên/archive conversation.
- **Modal data source** (`SourceModal`): chọn engine từ `GET /v1/db-engines` (tự điền port mặc định), host, database, user/password, schema, SSL, timeout, max rows, thuộc tính JDBC; **test kết nối nháp** trước khi lưu; sync schema.
- **Query panel**: ô hỏi, timeline các bước agent theo thời gian thực (`AgentTimeline`), thông báo retry, kết quả dạng bảng/biểu đồ (`ChartView`: bar, line, pie, number, table), SQL đã chạy, phần phân tích của AI (`DataEvaluation`), nút 👍/👎 (`FeedbackBar`).
- **Insight sidebar**: xem schema snapshot (bảng, cột) của data source đang chọn; có thể ẩn/hiện.

## Cấu trúc thư mục

```text
app/                                Next.js routes (layout, /, /login, /register, /workspace, globals.css)
src/
├── core/domain/textToSql.ts        Kiểu dữ liệu domain: QueryResult, ChartSpec, AgentProgress...
├── data/                           Lớp gọi API
│   ├── http.ts                     request<T>(): fetch + credentials: "include", chuẩn hóa lỗi
│   ├── authApi.ts                  login, register, me
│   ├── dataSourceApi.ts            engines, CRUD data source, test (đã lưu / nháp), sync schema
│   └── conversationApi.ts          conversation, messages, stream SSE, feedback
├── features/workspace/
│   ├── WorkspaceView.tsx           Layout workspace
│   ├── hooks/useWorkspace.ts       State & hành động của workspace
│   ├── chartData.ts                Chuyển result JSON thành dữ liệu biểu đồ
│   ├── constants.ts                Hằng số, form mặc định, nhãn trạng thái
│   └── components/                 QueryPanel, AgentTimeline, ChartView, DataEvaluation, FeedbackBar,
│                                   InsightSidebar, SourceModal, WorkspaceSidebar, EngineBadge
└── presentation/
    ├── components/                 AuthForm, ConversationSidebar, Icon, Workspace (re-export)
    └── hooks/useTextToSql.ts       Gửi câu hỏi, nhận stream và dựng tiến trình agent
```

## Giao tiếp với backend

- Base URL: `NEXT_PUBLIC_API_URL`, mặc định `http://localhost:8081`.
- Xác thực bằng cookie `access_cookie` do backend set; mọi request dùng `credentials: "include"`.
- `http.ts` đọc lỗi dạng JSON (`ApiError.message`) hoặc text (lỗi 401/403 từ `AuthFilter`) và ném `Error` với thông điệp đó.
- Câu hỏi được gửi qua `POST /v1/conversations/{id}/messages/stream`. Vì cần POST + cookie nên không dùng `EventSource`; `streamConversationMessage` đọc `ReadableStream`, tách event theo dòng trống và xử lý các event `thought`, `observation`, `retry`, `result`, `error`.
- Lịch sử hội thoại được dựng lại từ `GET /v1/conversations/{id}/messages`; chart và evaluation của câu trả lời cũ lấy từ `metadata` của message `ASSISTANT`.

Chi tiết API: [`../docs/api.md`](../docs/api.md).

## Docker

`Dockerfile` build 3 stage trên `node:22-alpine` và chạy `node server.js` (Next standalone) ở port 3000. `NEXT_PUBLIC_API_URL` được truyền như **build arg** và nhúng vào bundle, nên đổi URL backend phải build lại image.

Chạy toàn bộ hệ thống từ thư mục gốc:

```bash
docker compose up --build
```
