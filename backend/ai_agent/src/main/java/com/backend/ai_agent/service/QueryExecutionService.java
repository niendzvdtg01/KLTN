package com.backend.ai_agent.service;

import java.math.BigDecimal;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.ResultSetMetaData;
import java.sql.SQLException;
import java.sql.Statement;
import java.sql.Timestamp;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.backend.ai_agent.dto.request.QueryRequest;
import com.backend.ai_agent.entity.ConversationEntity;
import com.backend.ai_agent.entity.DataSourceEntity;
import com.backend.ai_agent.entity.QueryExecutionEntity;
import com.backend.ai_agent.exception.BadRequestException;
import com.backend.ai_agent.exception.NotFoundException;
import com.backend.ai_agent.repository.ConversationRepository;
import com.backend.ai_agent.repository.QueryExecutionRepository;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.json.JsonMapper;

@Service
public class QueryExecutionService {
    private static final String ACTIVE = "ACTIVE";
    private static final int MAX_ROWS = 1000;
    private static final int QUERY_TIMEOUT_SECONDS = 30;

    private final ConversationRepository conversationRepository;
    private final QueryExecutionRepository queryExecutionRepository;
    private final SqlSafetyValidator sqlSafetyValidator;
    private final JsonMapper objectMapper;

    public QueryExecutionService(ConversationRepository conversationRepository,
            QueryExecutionRepository queryExecutionRepository, SqlSafetyValidator sqlSafetyValidator,
            JsonMapper objectMapper) {
        this.conversationRepository = conversationRepository;
        this.queryExecutionRepository = queryExecutionRepository;
        this.sqlSafetyValidator = sqlSafetyValidator;
        this.objectMapper = objectMapper;
    }

    @Transactional
    public QueryExecutionEntity execute(Long userId, Long conversationId, QueryRequest request) {
        if (request == null || request.sql() == null || request.sql().isBlank()) {
            throw new BadRequestException("SQL không được để trống");
        }
        String sql = request.sql().trim();
        sqlSafetyValidator.validateReadOnly(sql);

        ConversationEntity conversation = conversationRepository.findByIdAndUserId(conversationId, userId)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy conversation"));
        if (!ACTIVE.equals(conversation.getStatus())) {
            throw new BadRequestException("Không thể thực thi query trong conversation đã archive");
        }
        DataSourceEntity source = conversation.getDataSource();
        if (!ACTIVE.equals(source.getStatus())) {
            throw new BadRequestException("Data source không ở trạng thái ACTIVE");
        }

        QueryExecutionEntity execution = new QueryExecutionEntity();
        execution.setConversation(conversation);
        execution.setQuestion(request.question() == null || request.question().isBlank()
                ? sql : request.question().trim());
        execution.setGeneratedSql(sql);
        execution.setStatus("GENERATED");
        execution = queryExecutionRepository.save(execution);

        long startedAt = System.nanoTime();
        try (Connection connection = openConnection(source);
                Statement statement = connection.createStatement()) {
            execution.setStatus("RUNNING");
            statement.setMaxRows(MAX_ROWS);
            statement.setQueryTimeout(QUERY_TIMEOUT_SECONDS);
            try (ResultSet resultSet = statement.executeQuery(sql)) {
                execution.setResultJson(toJson(resultSet));
                execution.setRowCount(countRows(execution.getResultJson()));
            }
            execution.setStatus("SUCCESS");
        } catch (SQLException | JacksonException exception) {
            execution.setStatus("FAILED");
            execution.setErrorMessage(safeError(exception));
        } finally {
            execution.setExecutionTimeMs((System.nanoTime() - startedAt) / 1_000_000);
            queryExecutionRepository.save(execution);
        }
        return execution;
    }

    private Connection openConnection(DataSourceEntity source) throws SQLException {
        if (!"MYSQL".equalsIgnoreCase(source.getDbType())) {
            throw new SQLException("Chỉ hỗ trợ MySQL");
        }
        String url = "jdbc:mysql://" + source.getHost() + ":" + source.getPort() + "/"
                + source.getDatabaseName()
                + "?useSSL=false&serverTimezone=UTC&allowPublicKeyRetrieval=true";
        return DriverManager.getConnection(url, source.getUsername(), source.getPassword());
    }

    private String toJson(ResultSet resultSet) throws SQLException, JacksonException {
        ResultSetMetaData metadata = resultSet.getMetaData();
        int columnCount = metadata.getColumnCount();
        List<Map<String, Object>> rows = new ArrayList<>();
        while (resultSet.next() && rows.size() < MAX_ROWS) {
            Map<String, Object> row = new LinkedHashMap<>();
            for (int column = 1; column <= columnCount; column++) {
                String label = metadata.getColumnLabel(column);
                row.put(label == null || label.isBlank() ? metadata.getColumnName(column) : label,
                        normalizeValue(resultSet.getObject(column)));
            }
            rows.add(row);
        }
        return objectMapper.writeValueAsString(Map.of("columns", columnNames(metadata), "rows", rows,
                "rowLimit", MAX_ROWS));
    }

    private List<String> columnNames(ResultSetMetaData metadata) throws SQLException {
        List<String> names = new ArrayList<>();
        for (int column = 1; column <= metadata.getColumnCount(); column++) {
            String label = metadata.getColumnLabel(column);
            names.add(label == null || label.isBlank() ? metadata.getColumnName(column) : label);
        }
        return names;
    }

    private Object normalizeValue(Object value) {
        if (value instanceof Timestamp timestamp) return timestamp.toLocalDateTime();
        if (value instanceof java.sql.Date date) return date.toLocalDate();
        if (value instanceof java.sql.Time time) return time.toLocalTime();
        if (value instanceof BigDecimal || value instanceof Number || value instanceof Boolean
                || value instanceof String || value instanceof LocalDate || value instanceof LocalDateTime) {
            return value;
        }
        return value == null ? null : value.toString();
    }

    private int countRows(String resultJson) {
        int marker = resultJson.indexOf("\"rows\":[");
        if (marker < 0) return 0;
        int count = 0;
        for (int index = marker + 8; index < resultJson.length(); index++) {
            if (resultJson.charAt(index) == '{') count++;
        }
        return count;
    }

    private String safeError(Exception exception) {
        String message = exception.getMessage();
        return message == null ? exception.getClass().getSimpleName()
                : message.substring(0, Math.min(message.length(), 2000));
    }
}
