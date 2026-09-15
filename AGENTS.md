# KLTN – Agent Guide

## 1. Mục tiêu hệ thống

KLTN là một ứng dụng AI Text-to-SQL. Người dùng đăng nhập, khai báo các database được phép truy cập, tạo cuộc hội thoại và đặt câu hỏi bằng ngôn ngữ tự nhiên. AI đọc schema của data source, sinh câu SQL chỉ đọc, chạy SQL và trả kết quả kèm lịch sử hội thoại.

Luồng nghiệp vụ chính:

```text
User đăng nhập
  -> tạo/test Data Source
  -> đồng bộ schema
  -> tạo Conversation
  -> gửi câu hỏi
  -> AI sinh SQL
  -> kiểm tra SQL read-only
  -> thực thi query
  -> lưu kết quả và trả Assistant message
```

## 2. Cấu trúc project

- `backend/ai_agent/`: Spring Boot backend hiện tại.
- `backend/ai_agent/src/main/java/com/backend/ai_agent/`:
  - `controller/`: REST API.
  - `service/`: nghiệp vụ ứng dụng.
  - `repository/`: Spring Data JPA repository.
  - `entity/`: entity ánh xạ database.
  - `dto/request`, `dto/response`: contract của API.
  - `security/`: JWT filter và xử lý authentication.
  - `config/`: cấu hình Spring Security/CORS.
  - `exception/`: exception nghiệp vụ và response lỗi chung.
- `backend/ai_agent/src/main/resources/db/migration/`: Flyway migrations.
- `backend/ai_agent/src/main/resources/application.yml`: datasource, Flyway, JPA và logging.
- `text-to-sql-agent/`: frontend/ứng dụng riêng; phải đọc `text-to-sql-agent/AGENTS.md` trước khi sửa phần này.

## 3. Trạng thái backend hiện tại

Backend hiện đã có nền tảng:

- User registration/update/login.
- JWT authentication.
- Global exception handling.
- Flyway với MySQL.
- Các bảng nền tảng `users`, `data_sources`, `conversations`, `messages`, `query_executions`.

Các entity/service/controller cho `data_sources`, `conversations`, `messages` và `query_executions` có thể chưa được triển khai đầy đủ. Khi bổ sung, giữ đúng mô hình nghiệp vụ trong tài liệu này.

## 4. Mô hình dữ liệu

```text
users 1 --- N data_sources
users 1 --- N conversations
data_sources 1 --- N conversations
conversations 1 --- N messages
conversations 1 --- N query_executions
```

### User

User sở hữu data sources và conversations của mình. Mọi API đọc/sửa/xóa tài nguyên phải kiểm tra ownership bằng user hiện tại từ JWT, không tin `user_id` do client gửi lên.

### Data source

Data source là thông tin kết nối tới database bên ngoài và schema snapshot dùng cho AI.

Trạng thái đề xuất:

```text
ACTIVE, ARCHIVED, CONNECTION_ERROR, SYNCING
```

Tên data source chỉ unique trong phạm vi một user. Password không được trả về response và về lâu dài phải được mã hóa ở application layer; không log password hoặc connection URL có password.

Data source bị archive thì không được tạo conversation mới, nhưng lịch sử conversation cũ vẫn phải đọc được.

### Conversation

Trong MVP, một conversation dùng đúng một data source. Conversation thuộc user tạo nó. Khi data source bị xóa hoặc archive, không được cascade xóa lịch sử hội thoại; ưu tiên archive/soft delete hoặc `ON DELETE RESTRICT`.

Trạng thái đề xuất:

```text
ACTIVE, ARCHIVED
```

### Message

Message là lịch sử append-only của conversation. Role hợp lệ:

```text
USER, ASSISTANT, SYSTEM, TOOL
```

Không sửa nội dung message cũ trong flow chat. Nếu cần hiệu chỉnh, tạo message mới hoặc metadata mới.

### Query execution

Mỗi lần AI sinh/chạy SQL là một query execution. Nên lưu câu hỏi gốc, SQL sinh ra, status, kết quả, số dòng, thời gian chạy và lỗi.

Status đề xuất:

```text
GENERATING, GENERATED, RUNNING, SUCCESS, FAILED, BLOCKED
```

Query execution chỉ được chạy SQL read-only. Chặn tối thiểu `INSERT`, `UPDATE`, `DELETE`, `DROP`, `ALTER`, `TRUNCATE`, `CREATE`, multi-statement và các thao tác nguy hiểm khác.

## 5. Quy tắc Flyway migration

Đây là phần bắt buộc phải tuân thủ.

1. Không sửa nội dung migration đã chạy thành công trên database dùng chung hoặc production.
2. Migration mới dùng tên tăng dần, ví dụ `V4__add_query_message_id.sql`.
3. Không dùng hai file cùng version như `V4__fix.sql` và `V4_fix.sql`; tên chuẩn phải có dạng `V<number>__<description>.sql`.
4. Mỗi migration phải chạy được trên schema do migration trước tạo ra.
5. Không đặt một câu `FOREIGN KEY` đứng riêng ngoài `ALTER TABLE`.
6. MySQL có thể commit ngầm các câu `ALTER TABLE`. Nếu migration fail giữa chừng, phải kiểm tra schema thực tế trước khi chạy lại.
7. Không tự động xóa database hoặc chạy `flyway clean` nếu chưa được user xác nhận.
8. Nếu migration local bị fail và không cần giữ dữ liệu, có thể reset database dev rồi chạy lại từ V1.
9. Nếu migration đã fail nhưng có dữ liệu cần giữ, kiểm tra `flyway_schema_history`, schema hiện tại và dùng `flyway repair` sau khi dọn phần thay đổi dở dang.
10. Checksum âm trong `flyway_schema_history` là bình thường vì checksum là signed integer. Chỉ xử lý khi Flyway báo `checksum mismatch`.

### V1, V2, V3 hiện tại

- `V1__create_primary_tables.sql`: tạo `data_sources`, `conversations`, `messages`, `query_executions`.
- `V2__create_users.sql`: tạo `users`.
- `V3__alter_data_conversations.sql`: thêm ownership/status và đổi quan hệ data source với conversation.

V3 hiện giả định database dev chưa có dữ liệu cần backfill trong `data_sources` và `conversations`, vì thêm `owner_id`/`user_id` là `NOT NULL`. Nếu cần migrate dữ liệu cũ, phải tạo migration riêng có chiến lược user mặc định/backfill rõ ràng, không đoán owner.

Khi đổi foreign key `fk_conversations_data_source`, không drop rồi add lại cùng tên trong cùng câu `ALTER TABLE`. Dùng hai câu riêng và tên mới, ví dụ `fk_conversations_data_source_restrict`.

## 6. Quy tắc triển khai nghiệp vụ chat

Khi xử lý `POST /conversations/{id}/messages`:

1. Lấy user từ JWT.
2. Tìm conversation theo `id` và `user_id`.
3. Kiểm tra data source thuộc cùng user và đang `ACTIVE`.
4. Lưu message `USER`.
5. Lấy schema snapshot.
6. Gửi câu hỏi + schema + context cần thiết cho AI.
7. Validate SQL trước khi chạy.
8. Lưu `query_execution` với status phù hợp.
9. Chạy query bằng read-only credentials/transaction nếu có thể.
10. Lưu message `ASSISTANT`, cập nhật `updated_at` và `last_message_at`.

Không cho phép client truyền tùy ý `owner_id`, `user_id`, `created_at`, `generated_sql` hoặc status để bypass nghiệp vụ.

## 7. API định hướng

Data sources:

```text
POST   /api/data-sources
GET    /api/data-sources
GET    /api/data-sources/{id}
PUT    /api/data-sources/{id}
DELETE /api/data-sources/{id}
POST   /api/data-sources/{id}/test-connection
POST   /api/data-sources/{id}/sync-schema
```

Conversations:

```text
POST   /api/conversations
GET    /api/conversations
GET    /api/conversations/{id}
PATCH  /api/conversations/{id}
DELETE /api/conversations/{id}
GET    /api/conversations/{id}/messages
POST   /api/conversations/{id}/messages
```

## 8. Quy tắc code

- Dùng DTO cho request/response; không expose JPA entity trực tiếp.
- Không trả `password`, `password_encrypted`, raw credentials hoặc schema nhạy cảm trong response không cần thiết.
- Controller mỏng; validation và nghiệp vụ nằm ở service.
- Repository query phải giới hạn theo ownership khi phù hợp.
- Dùng exception hiện có (`NotFoundException`, `BadRequestException`, `ConflictException`, `UnauthorizedException`) và để `GlobalExceptionHandler` chuyển thành API error thống nhất.
- Timestamps phải được set nhất quán và dùng microsecond-compatible `DATETIME(6)` theo schema.
- Không dùng `ON DELETE CASCADE` từ `data_sources` xuống `conversations`.
- Khi thêm bảng/cột mới, cập nhật migration trước rồi mới cập nhật entity.

## 9. Cách kiểm tra trước khi bàn giao

Từ thư mục `backend/ai_agent`:

```bash
mvn clean test
mvn spring-boot:run
```

Nếu startup fail ở Flyway:

1. Đọc câu SQL và line number trong log.
2. Kiểm tra `flyway_schema_history`.
3. Kiểm tra schema thật bằng `SHOW CREATE TABLE ...`.
4. Xác định migration đã chạy hết, chạy một phần hay chưa chạy.
5. Chỉ sau đó mới sửa migration/repair/reset database.

Không kết luận lỗi chỉ dựa vào checksum âm hoặc dòng `BUILD SUCCESS`; Spring Boot vẫn có thể fail trong lúc Flyway khởi tạo.

## 10. Thứ tự phát triển đề xuất

1. Hoàn thiện entity/repository/service/controller cho data source.
2. Implement test connection và schema sync.
3. Hoàn thiện conversation/message CRUD có kiểm tra ownership.
4. Implement AI Text-to-SQL và SQL safety validator.
5. Implement query execution và lưu lịch sử.
6. Thêm pagination, giới hạn row/result size, timeout và audit log.
7. Bổ sung schema versioning nếu schema database ngoài thường xuyên thay đổi.
