package com.backend.ai_agent.service;

import java.math.BigDecimal;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.ResultSetMetaData;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.regex.Pattern;

import org.springframework.stereotype.Service;

import com.backend.ai_agent.entity.DataSourceEntity;
import com.backend.ai_agent.exception.BadRequestException;

import tools.jackson.databind.json.JsonMapper;

/**
 * Executes the exploration tools the agent can call. Deliberately not transactional: a failing tool
 * must surface as an exception the orchestrator feeds back to the agent, without marking the chat
 * transaction rollback-only.
 */
@Service
public class AgentToolService {
    private static final int PREVIEW_ROWS = 20;
    private static final int TOOL_TIMEOUT_SECONDS = 15;
    private static final Pattern IDENTIFIER = Pattern.compile("[A-Za-z_][A-Za-z0-9_$]*");

    private final SqlSafetyValidator sqlSafetyValidator;
    private final JsonMapper mapper;

    public AgentToolService(SqlSafetyValidator sqlSafetyValidator, JsonMapper mapper) {
        this.sqlSafetyValidator = sqlSafetyValidator;
        this.mapper = mapper;
    }

    /** Column metadata of one table, answered from the synced schema snapshot. */
    public Object describeTable(String schemaJson, String table) {
        Map<String, Object> found = findTable(schemaJson, table)
                .orElseThrow(() -> new BadRequestException("Bảng '" + table + "' không có trong schema"));
        return found.getOrDefault("columns", List.of());
    }

    /** Distinct real values of one column, so the agent filters on values that actually exist. */
    public Object sampleValues(DataSourceEntity source, String table, String column) {
        Map<String, Object> found = findTable(source.getSchemaJson(), table)
                .orElseThrow(() -> new BadRequestException("Bảng '" + table + "' không có trong schema"));
        boolean known = found.get("columns") instanceof List<?> columns && columns.stream()
                .anyMatch(item -> item instanceof Map<?, ?> map && column != null
                        && column.equalsIgnoreCase(String.valueOf(map.get("name"))));
        if (!known || !IDENTIFIER.matcher(column).matches()) {
            throw new BadRequestException("Cột '" + column + "' không có trong bảng '" + table + "'");
        }
        String name = String.valueOf(found.get("name"));
        String sql = "SELECT DISTINCT `" + column + "` AS value FROM `" + name + "` WHERE `" + column
                + "` IS NOT NULL LIMIT " + PREVIEW_ROWS;
        return run(source, sql).get("rows");
    }

    /** Exploratory read-only query, limited to a small preview. */
    public Map<String, Object> runPreview(DataSourceEntity source, String sql) {
        return run(source, sqlSafetyValidator.validateReadOnly(sql));
    }

    private Map<String, Object> run(DataSourceEntity source, String sql) {
        try (Connection connection = openConnection(source);
                Statement statement = connection.createStatement()) {
            connection.setReadOnly(true);
            statement.setMaxRows(PREVIEW_ROWS);
            statement.setQueryTimeout(TOOL_TIMEOUT_SECONDS);
            try (ResultSet resultSet = statement.executeQuery(sql)) {
                ResultSetMetaData metadata = resultSet.getMetaData();
                List<String> columns = new ArrayList<>();
                for (int index = 1; index <= metadata.getColumnCount(); index++) {
                    columns.add(metadata.getColumnLabel(index));
                }
                List<Map<String, Object>> rows = new ArrayList<>();
                while (resultSet.next() && rows.size() < PREVIEW_ROWS) {
                    Map<String, Object> row = new LinkedHashMap<>();
                    for (int index = 1; index <= columns.size(); index++) {
                        Object value = resultSet.getObject(index);
                        row.put(columns.get(index - 1), value == null || value instanceof Number
                                || value instanceof Boolean || value instanceof BigDecimal ? value : value.toString());
                    }
                    rows.add(row);
                }
                Map<String, Object> result = new LinkedHashMap<>();
                result.put("columns", columns);
                result.put("rows", rows);
                result.put("rowCount", rows.size());
                return result;
            }
        } catch (SQLException exception) {
            String message = exception.getMessage() == null ? exception.getClass().getSimpleName() : exception.getMessage();
            throw new BadRequestException(message.substring(0, Math.min(message.length(), 1000)));
        }
    }

    @SuppressWarnings("unchecked")
    private Optional<Map<String, Object>> findTable(String schemaJson, String table) {
        if (schemaJson == null || schemaJson.isBlank() || table == null) {
            return Optional.empty();
        }
        Map<String, Object> schema = mapper.readValue(schemaJson, Map.class);
        if (!(schema.get("tables") instanceof List<?> tables)) {
            return Optional.empty();
        }
        return tables.stream().filter(Map.class::isInstance).map(item -> (Map<String, Object>) item)
                .filter(item -> table.equalsIgnoreCase(String.valueOf(item.get("name")))).findFirst();
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
}
