package com.backend.ai_agent.service;

import java.sql.Connection;
import java.sql.DatabaseMetaData;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Locale;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.backend.ai_agent.dto.request.DataSourceRequest;
import com.backend.ai_agent.entity.DataSourceEntity;
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

    private final DataSourceRepository dataSourceRepository;
    private final UserRepository userRepository;

    public DataSourceService(
            DataSourceRepository dataSourceRepository,
            UserRepository userRepository) {
        this.dataSourceRepository = dataSourceRepository;
        this.userRepository = userRepository;
    }

    @Transactional
    public DataSourceEntity create(Long ownerId, DataSourceRequest request) {
        validate(request, true);
        String name = request.name().trim();
        if (dataSourceRepository.existsByOwnerIdAndNameIgnoreCase(ownerId, name)) {
            throw new ConflictException("Tên data source đã tồn tại");
        }

        UserEntity owner = userRepository.findById(ownerId)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy người dùng"));

        DataSourceEntity source = new DataSourceEntity();
        source.setOwner(owner);
        apply(source, request, true);
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
        validate(request, false);
        DataSourceEntity source = ownedSource(ownerId, id);
        String name = request.name().trim();
        if (dataSourceRepository.existsByOwnerIdAndNameIgnoreCaseAndIdNot(ownerId, name, id)) {
            throw new ConflictException("Tên data source đã tồn tại");
        }
        apply(source, request, false);
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
        try (Connection connection = openConnection(source)) {
            source.setLastConnectionStatus("SUCCESS");
            source.setLastConnectionError(null);
        } catch (SQLException exception) {
            source.setLastConnectionStatus("FAILED");
            source.setLastConnectionError(safeError(exception));
            dataSourceRepository.save(source);
            throw new BadRequestException("Không thể kết nối tới data source: " + safeError(exception));
        }
        return dataSourceRepository.save(source);
    }

    @Transactional
    public DataSourceEntity syncSchema(Long ownerId, Long id) {
        DataSourceEntity source = ownedSource(ownerId, id);
        if (ARCHIVED.equals(source.getStatus())) {
            throw new BadRequestException("Không thể đồng bộ schema của data source đã archive");
        }

        try (Connection connection = openConnection(source)) {
            source.setSchemaJson(readSchema(connection));
            source.setLastSyncedAt(LocalDateTime.now());
            source.setLastConnectionStatus("SUCCESS");
            source.setLastConnectionError(null);
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

    private void apply(DataSourceEntity source, DataSourceRequest request, boolean passwordRequired) {
        source.setName(request.name().trim());
        source.setDbType(normalizeDbType(request.dbType()));
        source.setHost(request.host().trim());
        source.setPort(request.port());
        source.setDatabaseName(request.databaseName().trim());
        source.setUsername(request.username().trim());
        if (passwordRequired || request.password() != null && !request.password().isBlank()) {
            source.setPassword(request.password());
        }
    }

    private void validate(DataSourceRequest request, boolean passwordRequired) {
        if (request == null || isBlank(request.name()) || isBlank(request.dbType())
                || isBlank(request.host()) || request.port() == null || request.port() < 1 || request.port() > 65535
                || isBlank(request.databaseName()) || isBlank(request.username())
                || passwordRequired && isBlank(request.password())) {
            throw new BadRequestException("Thông tin data source không hợp lệ");
        }
        if (!"MYSQL".equals(normalizeDbType(request.dbType()))) {
            throw new BadRequestException("Hiện chỉ hỗ trợ dbType MYSQL");
        }
    }

    private Connection openConnection(DataSourceEntity source) throws SQLException {
        if (!"MYSQL".equals(normalizeDbType(source.getDbType()))) {
            throw new SQLException("Chỉ hỗ trợ MySQL");
        }
        String url = "jdbc:mysql://" + source.getHost() + ":" + source.getPort() + "/"
                + source.getDatabaseName() + "?useSSL=false&serverTimezone=UTC&allowPublicKeyRetrieval=true";
        return DriverManager.getConnection(url, source.getUsername(), source.getPassword());
    }

    private String readSchema(Connection connection) throws SQLException {
        DatabaseMetaData metadata = connection.getMetaData();
        StringBuilder json = new StringBuilder("{\"database\":");
        json.append(jsonValue(connection.getCatalog())).append(",\"tables\":[");
        boolean firstTable = true;
        int tableCount = 0;
        try (ResultSet tableSet = metadata.getTables(connection.getCatalog(), null, "%", new String[] { "TABLE" })) {
            while (tableSet.next() && tableCount < MAX_SCHEMA_TABLES) {
                String tableName = tableSet.getString("TABLE_NAME");
                if (!firstTable) {
                    json.append(',');
                }
                firstTable = false;
                json.append("{\"name\":").append(jsonValue(tableName)).append(",\"columns\":[");
                boolean firstColumn = true;
                try (ResultSet columnSet = metadata.getColumns(connection.getCatalog(), null, tableName, "%")) {
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

    private String normalizeDbType(String value) {
        return value == null ? "" : value.trim().toUpperCase(Locale.ROOT);
    }

    private boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    private String safeError(Exception exception) {
        String message = exception.getMessage();
        return message == null ? exception.getClass().getSimpleName()
                : message.substring(0, Math.min(message.length(), 1000));
    }
}
