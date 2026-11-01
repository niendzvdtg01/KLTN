package com.backend.ai_agent.service;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Properties;
import java.util.regex.Pattern;

import org.springframework.stereotype.Component;

import com.backend.ai_agent.entity.DataSourceEntity;
import com.backend.ai_agent.entity.DataSourcePropertyEntity;
import com.backend.ai_agent.entity.DbEngineEntity;
import com.backend.ai_agent.exception.BadRequestException;
import com.backend.ai_agent.repository.DbEngineRepository;

/**
 * Opens JDBC connections to user data sources for every engine in the {@code db_engines} catalog.
 * Engine behaviour (URL, driver, quoting, default/SSL properties) comes from the catalog; per source
 * settings come from {@code data_sources} and {@code data_source_properties}.
 */
@Component
public class JdbcConnectionFactory {
    public static final int MAX_PROPERTIES = 30;

    private static final Pattern HOST = Pattern.compile("[A-Za-z0-9._-]{1,255}|\\[[0-9A-Fa-f:.]{2,45}]");
    private static final Pattern DATABASE = Pattern.compile("[A-Za-z0-9_.$-]{1,255}");
    private static final Pattern IDENTIFIER = Pattern.compile("[A-Za-z_][A-Za-z0-9_$#]{0,127}");
    private static final Pattern PROPERTY_KEY = Pattern.compile("[A-Za-z][A-Za-z0-9._-]{0,99}");
    /** Keys the backend sets itself, which a data source must not override. */
    private static final List<String> RESERVED_KEYS = List.of("user", "username", "password", "databasename",
            "database", "servername", "portnumber", "host", "port");
    /**
     * Driver properties that load classes, read local files or deserialize objects are known JDBC attack
     * vectors (e.g. MySQL autoDeserialize/allowLoadLocalInfile, PostgreSQL socketFactory/loggerFile).
     */
    private static final List<String> DANGEROUS_KEY_PARTS = List.of("factory", "interceptor", "callback", "class",
            "deserializ", "infile", "logger", "plugin", "transform", "init", "script", "trace");

    private final DbEngineRepository dbEngineRepository;

    public JdbcConnectionFactory(DbEngineRepository dbEngineRepository) {
        this.dbEngineRepository = dbEngineRepository;
    }

    public List<DbEngineEntity> enabledEngines() {
        return dbEngineRepository.findAllByEnabledTrueOrderBySortOrderAscDisplayNameAsc();
    }

    public DbEngineEntity engine(String code) {
        String normalized = code == null ? "" : code.trim().toUpperCase(Locale.ROOT);
        return dbEngineRepository.findById(normalized).filter(DbEngineEntity::isEnabled)
                .orElseThrow(() -> new BadRequestException("Loại database '" + code + "' không được hỗ trợ"));
    }

    /** SQL dialect name sent to the AI agent; falls back to the raw type when the engine is unknown. */
    public String dialect(DataSourceEntity source) {
        return dbEngineRepository.findById(source.getDbType() == null ? "" : source.getDbType())
                .map(DbEngineEntity::getSqlDialect)
                .orElse(source.getDbType());
    }

    public Connection open(DataSourceEntity source) throws SQLException {
        DbEngineEntity engine;
        try {
            engine = engine(source.getDbType());
        } catch (BadRequestException exception) {
            throw new SQLException(exception.getMessage());
        }
        return open(source, engine);
    }

    public Connection open(DataSourceEntity source, DbEngineEntity engine) throws SQLException {
        try {
            Class.forName(engine.getDriverClass());
        } catch (ClassNotFoundException exception) {
            throw new SQLException("Backend chưa có JDBC driver cho " + engine.getDisplayName());
        }
        try {
            validateEndpoint(source.getHost(), source.getDatabaseName());
        } catch (BadRequestException exception) {
            throw new SQLException(exception.getMessage());
        }
        Connection connection = DriverManager.getConnection(buildUrl(engine, source), buildProperties(engine, source));
        try {
            String schema = blankToNull(source.getSchemaName());
            if (schema != null && engine.getSchemaInitSql() != null && !engine.getSchemaInitSql().isBlank()) {
                try (Statement statement = connection.createStatement()) {
                    statement.execute(engine.getSchemaInitSql().replace("{schema}", quote(engine, schema)));
                }
            }
            return connection;
        } catch (SQLException exception) {
            connection.close();
            throw exception;
        }
    }

    String buildUrl(DbEngineEntity engine, DataSourceEntity source) {
        return engine.getUrlTemplate()
                .replace("{host}", source.getHost().trim())
                .replace("{port}", String.valueOf(source.getPort()))
                .replace("{database}", source.getDatabaseName().trim());
    }

    Properties buildProperties(DbEngineEntity engine, DataSourceEntity source) {
        Properties properties = new Properties();
        properties.putAll(parseProperties(engine.getDefaultProperties()));
        if (source.isSslEnabled()) {
            properties.putAll(parseProperties(engine.getSslProperties()));
        }
        if (engine.getTimeoutProperty() != null && !engine.getTimeoutProperty().isBlank()) {
            int seconds = source.getConnectTimeoutSeconds() == null ? 10 : source.getConnectTimeoutSeconds();
            long value = "MILLISECONDS".equalsIgnoreCase(engine.getTimeoutUnit()) ? seconds * 1000L : seconds;
            properties.setProperty(engine.getTimeoutProperty(), String.valueOf(value));
        }
        for (DataSourcePropertyEntity property : source.getProperties()) {
            // Re-checked here so a row edited directly in the database cannot bypass the rules.
            if (propertyError(property.getKey(), property.getValue()) == null) {
                properties.setProperty(property.getKey(), property.getValue());
            }
        }
        properties.setProperty("user", source.getUsername());
        properties.setProperty("password", source.getPassword() == null ? "" : source.getPassword());
        return properties;
    }

    /** Quotes an identifier with the engine's quote characters; "schema.table" is quoted part by part. */
    public String quote(DbEngineEntity engine, String identifier) {
        String[] parts = identifier.split("\\.", -1);
        StringBuilder quoted = new StringBuilder();
        for (String part : parts) {
            if (!IDENTIFIER.matcher(part).matches()) {
                throw new BadRequestException("Tên định danh không hợp lệ: " + identifier);
            }
            if (!quoted.isEmpty()) {
                quoted.append('.');
            }
            quoted.append(engine.getIdentifierQuoteOpen()).append(part).append(engine.getIdentifierQuoteClose());
        }
        return quoted.toString();
    }

    /** Adds the engine's row limit to a query that starts with SELECT. */
    public String limit(DbEngineEntity engine, String selectSql, int rows) {
        return switch (engine.getLimitStyle() == null ? "LIMIT" : engine.getLimitStyle().toUpperCase(Locale.ROOT)) {
            case "TOP" -> selectSql.replaceFirst("(?i)^SELECT(\\s+DISTINCT)?", "SELECT$1 TOP " + rows);
            case "FETCH" -> selectSql + " FETCH FIRST " + rows + " ROWS ONLY";
            default -> selectSql + " LIMIT " + rows;
        };
    }

    public void validateEndpoint(String host, String databaseName) {
        if (host == null || !HOST.matcher(host.trim()).matches()) {
            throw new BadRequestException("Host không hợp lệ");
        }
        if (databaseName == null || !DATABASE.matcher(databaseName.trim()).matches()) {
            throw new BadRequestException("Tên database không hợp lệ");
        }
    }

    public boolean isValidIdentifier(String value) {
        return value != null && IDENTIFIER.matcher(value).matches();
    }

    /** Returns why a custom JDBC property is rejected, or null when it is allowed. */
    public String propertyError(String key, String value) {
        if (key == null || !PROPERTY_KEY.matcher(key).matches()) {
            return "Tên thuộc tính JDBC không hợp lệ: " + key;
        }
        String lower = key.toLowerCase(Locale.ROOT);
        if (RESERVED_KEYS.contains(lower)) {
            return "Không được ghi đè thuộc tính '" + key + "', hãy dùng trường tương ứng của form";
        }
        if (DANGEROUS_KEY_PARTS.stream().anyMatch(lower::contains)) {
            return "Thuộc tính JDBC '" + key + "' bị chặn vì lý do bảo mật";
        }
        if (value == null || value.length() > 1000 || value.chars().anyMatch(Character::isISOControl)) {
            return "Giá trị của thuộc tính '" + key + "' không hợp lệ";
        }
        return null;
    }

    static Map<String, String> parseProperties(String value) {
        Map<String, String> properties = new LinkedHashMap<>();
        if (value == null || value.isBlank()) {
            return properties;
        }
        for (String pair : value.split(";")) {
            int separator = pair.indexOf('=');
            if (separator > 0) {
                properties.put(pair.substring(0, separator).trim(), pair.substring(separator + 1).trim());
            }
        }
        return properties;
    }

    private String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
