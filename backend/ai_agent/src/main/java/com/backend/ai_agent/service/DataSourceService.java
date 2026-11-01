package com.backend.ai_agent.service;

import java.sql.Connection;
import java.sql.DatabaseMetaData;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Locale;
import java.util.Map;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.backend.ai_agent.dto.request.DataSourceRequest;
import com.backend.ai_agent.dto.response.ConnectionTestResponse;
import com.backend.ai_agent.entity.DataSourceEntity;
import com.backend.ai_agent.entity.DataSourcePropertyEntity;
import com.backend.ai_agent.entity.DbEngineEntity;
import com.backend.ai_agent.entity.UserEntity;
import com.backend.ai_agent.exception.BadRequestException;
import com.backend.ai_agent.exception.ConflictException;
import com.backend.ai_agent.exception.NotFoundException;
import com.backend.ai_agent.repository.DataSourceRepository;
import com.backend.ai_agent.repository.UserRepository;

@Service
public class DataSourceService {

    private static final String ACTIVE = "ACTIVE";
    private static final String ARCHIVED = "ARCHIVED";
    private static final int MAX_SCHEMA_TABLES = 500;
    private static final String[] TABLE_TYPES = { "TABLE", "VIEW", "PARTITIONED TABLE" };

    private final DataSourceRepository dataSourceRepository;
    private final UserRepository userRepository;
    private final JdbcConnectionFactory connectionFactory;

    public DataSourceService(
            DataSourceRepository dataSourceRepository,
            UserRepository userRepository,
            JdbcConnectionFactory connectionFactory) {
        this.dataSourceRepository = dataSourceRepository;
        this.userRepository = userRepository;
        this.connectionFactory = connectionFactory;
    }

    @Transactional(readOnly = true)
    public List<DbEngineEntity> engines() {
        return connectionFactory.enabledEngines();
    }

    @Transactional
    public DataSourceEntity create(Long ownerId, DataSourceRequest request) {
        DbEngineEntity engine = validate(request);
        String name = request.name().trim();
        if (dataSourceRepository.existsByOwnerIdAndNameIgnoreCase(ownerId, name)) {
            throw new ConflictException("Tên data source đã tồn tại");
        }

        UserEntity owner = userRepository.findById(ownerId)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy người dùng"));

        DataSourceEntity source = new DataSourceEntity();
        source.setOwner(owner);
        apply(source, request, engine, true);
        source.setStatus(ACTIVE);
        return dataSourceRepository.save(source);
    }

    @Transactional(readOnly = true)
    public List<DataSourceEntity> findAll(Long ownerId) {
        return dataSourceRepository.findAllByOwnerIdOrderByUpdatedAtDesc(ownerId);
    }

    @Transactional(readOnly = true)
    public DataSourceEntity findById(Long ownerId, Long id) {
        return ownedSource(ownerId, id);
    }

    @Transactional
    public DataSourceEntity update(Long ownerId, Long id, DataSourceRequest request) {
        DbEngineEntity engine = validate(request);
        DataSourceEntity source = ownedSource(ownerId, id);
        String name = request.name().trim();
        if (dataSourceRepository.existsByOwnerIdAndNameIgnoreCaseAndIdNot(ownerId, name, id)) {
            throw new ConflictException("Tên data source đã tồn tại");
        }
        apply(source, request, engine, false);
        // Connection details may have changed: the old schema snapshot and status no longer apply.
        source.setLastConnectionStatus(null);
        source.setLastConnectionError(null);
        if (!ARCHIVED.equals(source.getStatus())) {
            source.setStatus(ACTIVE);
        }
        return dataSourceRepository.save(source);
    }

    @Transactional
    public DataSourceEntity archive(Long ownerId, Long id) {
        DataSourceEntity source = ownedSource(ownerId, id);
        source.setStatus(ARCHIVED);
        return dataSourceRepository.save(source);
    }

    @Transactional
    public DataSourceEntity testConnection(Long ownerId, Long id) {
        DataSourceEntity source = ownedSource(ownerId, id);
        try (Connection connection = connectionFactory.open(source)) {
            source.setLastConnectionStatus("SUCCESS");
            source.setLastConnectionError(null);
            if ("CONNECTION_ERROR".equals(source.getStatus())) {
                source.setStatus(ACTIVE);
            }
        } catch (SQLException exception) {
            source.setLastConnectionStatus("FAILED");
            source.setLastConnectionError(safeError(exception));
            dataSourceRepository.save(source);
            throw new BadRequestException("Không thể kết nối tới data source: " + safeError(exception));
        }
        return dataSourceRepository.save(source);
    }

    /**
     * Tests connection settings without saving them, so the form can be checked before submit. When
     * {@code existingId} is given and the password is blank, the stored password of that source is used.
     */
    @Transactional(readOnly = true)
    public ConnectionTestResponse testDraft(Long ownerId, Long existingId, DataSourceRequest request) {
        DbEngineEntity engine = validate(request);
        DataSourceEntity draft = new DataSourceEntity();
        apply(draft, request, engine, true);
        if (existingId != null && (request.password() == null || request.password().isBlank())) {
            draft.setPassword(ownedSource(ownerId, existingId).getPassword());
        }
        long startedAt = System.nanoTime();
        try (Connection connection = connectionFactory.open(draft, engine)) {
            DatabaseMetaData metadata = connection.getMetaData();
            return new ConnectionTestResponse(true, "Kết nối thành công", metadata.getDatabaseProductName(),
                    metadata.getDatabaseProductVersion(), (System.nanoTime() - startedAt) / 1_000_000);
        } catch (SQLException exception) {
            return new ConnectionTestResponse(false, safeError(exception), null, null,
                    (System.nanoTime() - startedAt) / 1_000_000);
        }
    }

    @Transactional
    public DataSourceEntity syncSchema(Long ownerId, Long id) {
        DataSourceEntity source = ownedSource(ownerId, id);
        if (ARCHIVED.equals(source.getStatus())) {
            throw new BadRequestException("Không thể đồng bộ schema của data source đã archive");
        }
        DbEngineEntity engine = connectionFactory.engine(source.getDbType());

        try (Connection connection = connectionFactory.open(source, engine)) {
            source.setSchemaJson(readSchema(connection, source, engine));
            source.setLastSyncedAt(LocalDateTime.now());
            source.setLastConnectionStatus("SUCCESS");
            source.setLastConnectionError(null);
            source.setStatus(ACTIVE);
        } catch (SQLException exception) {
            source.setLastConnectionStatus("FAILED");
            source.setLastConnectionError(safeError(exception));
            dataSourceRepository.save(source);
            throw new BadRequestException("Không thể đồng bộ schema: " + safeError(exception));
        }
        return dataSourceRepository.save(source);
    }

    private DataSourceEntity ownedSource(Long ownerId, Long id) {
        return dataSourceRepository.findByIdAndOwnerId(id, ownerId)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy data source"));
    }

    private void apply(DataSourceEntity source, DataSourceRequest request, DbEngineEntity engine, boolean creating) {
        source.setName(request.name().trim());
        source.setDbType(engine.getCode());
        source.setHost(request.host().trim());
        source.setPort(request.port());
        source.setDatabaseName(request.databaseName().trim());
        source.setUsername(request.username().trim());
        // Password is optional (e.g. public read-only databases); on update a blank value keeps the stored one.
        if (creating) {
            source.setPassword(request.password() == null ? "" : request.password());
        } else if (request.password() != null && !request.password().isBlank()) {
            source.setPassword(request.password());
        }
        source.setSchemaName(engine.isSupportsSchema() && !isBlank(request.schemaName())
                ? request.schemaName().trim() : null);
        source.setSslEnabled(engine.isSslSupported() && Boolean.TRUE.equals(request.sslEnabled()));
        source.setConnectTimeoutSeconds(valueOr(request.connectTimeoutSeconds(), 10));
        source.setQueryTimeoutSeconds(valueOr(request.queryTimeoutSeconds(), 30));
        source.setMaxRows(valueOr(request.maxRows(), 1000));
        applyProperties(source, request.properties() == null ? Map.of() : request.properties());
    }

    /** Updates rows in place: deleting and re-inserting the same key would hit the unique key on flush. */
    private void applyProperties(DataSourceEntity source, Map<String, String> requested) {
        List<DataSourcePropertyEntity> current = source.getProperties();
        current.removeIf(property -> !requested.containsKey(property.getKey()));
        requested.forEach((key, value) -> current.stream()
                .filter(property -> property.getKey().equals(key))
                .findFirst()
                .ifPresentOrElse(property -> property.setValue(value),
                        () -> current.add(new DataSourcePropertyEntity(source, key, value))));
    }

    private DbEngineEntity validate(DataSourceRequest request) {
        if (request == null || isBlank(request.name()) || isBlank(request.dbType())
                || isBlank(request.host()) || request.port() == null || request.port() < 1 || request.port() > 65535
                || isBlank(request.databaseName()) || isBlank(request.username())) {
            throw new BadRequestException("Thông tin data source không hợp lệ");
        }
        if (request.name().trim().length() > 150) {
            throw new BadRequestException("Tên data source tối đa 150 ký tự");
        }
        DbEngineEntity engine = connectionFactory.engine(request.dbType());
        connectionFactory.validateEndpoint(request.host(), request.databaseName());
        if (!isBlank(request.schemaName()) && !connectionFactory.isValidIdentifier(request.schemaName().trim())) {
            throw new BadRequestException("Tên schema không hợp lệ");
        }
        checkRange(request.connectTimeoutSeconds(), 1, 120, "Connect timeout phải từ 1 đến 120 giây");
        checkRange(request.queryTimeoutSeconds(), 1, 600, "Query timeout phải từ 1 đến 600 giây");
        checkRange(request.maxRows(), 1, 10000, "Số dòng tối đa phải từ 1 đến 10000");
        Map<String, String> properties = request.properties() == null ? Map.of() : request.properties();
        if (properties.size() > JdbcConnectionFactory.MAX_PROPERTIES) {
            throw new BadRequestException("Tối đa " + JdbcConnectionFactory.MAX_PROPERTIES + " thuộc tính JDBC");
        }
        properties.forEach((key, value) -> {
            String error = connectionFactory.propertyError(key, value);
            if (error != null) {
                throw new BadRequestException(error);
            }
        });
        return engine;
    }

    private String readSchema(Connection connection, DataSourceEntity source, DbEngineEntity engine)
            throws SQLException {
        DatabaseMetaData metadata = connection.getMetaData();
        String catalog = connection.getCatalog();
        String schema = !isBlank(source.getSchemaName()) ? source.getSchemaName()
                : engine.getDefaultSchema() != null ? engine.getDefaultSchema() : connection.getSchema();
        // Without a session-level "use schema" statement, tables outside the default schema must be
        // referenced as schema.table, so the snapshot stores qualified names.
        boolean qualify = !isBlank(source.getSchemaName()) && isBlank(engine.getSchemaInitSql())
                && !source.getSchemaName().equalsIgnoreCase(String.valueOf(engine.getDefaultSchema()));

        StringBuilder json = new StringBuilder("{\"database\":");
        json.append(jsonValue(catalog == null ? source.getDatabaseName() : catalog))
                .append(",\"schema\":").append(jsonValue(schema))
                .append(",\"dialect\":").append(jsonValue(engine.getSqlDialect()))
                .append(",\"tables\":[");
        boolean firstTable = true;
        int tableCount = 0;
        try (ResultSet tableSet = metadata.getTables(catalog, schema, "%", TABLE_TYPES)) {
            while (tableSet.next() && tableCount < MAX_SCHEMA_TABLES) {
                String tableName = tableSet.getString("TABLE_NAME");
                String tableSchema = tableSet.getString("TABLE_SCHEM");
                if (!firstTable) {
                    json.append(',');
                }
                firstTable = false;
                json.append("{\"name\":").append(jsonValue(qualify ? source.getSchemaName() + "." + tableName : tableName))
                        .append(",\"type\":").append(jsonValue(tableSet.getString("TABLE_TYPE")))
                        .append(",\"columns\":[");
                boolean firstColumn = true;
                try (ResultSet columnSet = metadata.getColumns(catalog, tableSchema, tableName, "%")) {
                    while (columnSet.next()) {
                        if (!firstColumn) {
                            json.append(',');
                        }
                        firstColumn = false;
                        json.append("{\"name\":").append(jsonValue(columnSet.getString("COLUMN_NAME")))
                                .append(",\"type\":").append(jsonValue(columnSet.getString("TYPE_NAME")))
                                .append(",\"nullable\":")
                                .append("YES".equalsIgnoreCase(columnSet.getString("IS_NULLABLE")))
                                .append('}');
                    }
                }
                json.append("]}");
                tableCount++;
            }
        }
        return json.append("]}").toString();
    }

    private String jsonValue(String value) {
        if (value == null) {
            return "null";
        }
        return "\"" + value.replace("\\", "\\\\")
                .replace("\"", "\\\"")
                .replace("\r", "\\r")
                .replace("\n", "\\n") + "\"";
    }

    private void checkRange(Integer value, int min, int max, String message) {
        if (value != null && (value < min || value > max)) {
            throw new BadRequestException(message);
        }
    }

    private int valueOr(Integer value, int fallback) {
        return value == null ? fallback : value;
    }

    private boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    private String safeError(Exception exception) {
        String message = exception.getMessage();
        if (message == null) {
            return exception.getClass().getSimpleName();
        }
        // Some drivers echo the connection URL; never surface anything that may carry a password.
        if (message.toLowerCase(Locale.ROOT).contains("password=")) {
            return "Lỗi kết nối (chi tiết đã được ẩn)";
        }
        return message.substring(0, Math.min(message.length(), 1000));
    }
}
