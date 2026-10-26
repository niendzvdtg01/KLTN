# KLTN Frontend

Frontend của KLTN được xây dựng bằng Next.js 16, React 19 và TypeScript.

## Chạy local

```bash
npm ci
npm run dev
```

Mở <http://localhost:3000>.

Frontend gọi backend qua biến môi trường:

```bash
NEXT_PUBLIC_API_URL=http://localhost:8081 npm run dev
```

Nếu không đặt biến, frontend mặc định dùng `http://localhost:8081`.

## Scripts

```bash
npm run dev      # Development server
npm run lint     # ESLint
npm run build    # Production build
npm run start    # Chạy production build
```

## Cấu trúc chính

```text
app/                         Next.js routes
src/data/                    HTTP client và API modules
src/core/                    Domain/use cases Text-to-SQL
src/features/workspace/      Workspace UI và hooks
src/presentation/            Components dùng chung và auth UI
```

## Docker

Frontend được build bằng `Dockerfile` trong thư mục này và chạy ở port `3000`. Backend URL được truyền lúc build image qua `NEXT_PUBLIC_API_URL`.

Nên chạy toàn bộ hệ thống từ thư mục gốc:

```bash
docker compose up --build
```
