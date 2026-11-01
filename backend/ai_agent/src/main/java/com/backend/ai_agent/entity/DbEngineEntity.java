package com.backend.ai_agent.entity;

import java.time.LocalDateTime;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;

/** One supported database engine and how to connect to it; see V6__create_db_engines.sql. */
@Entity
@Table(name = "db_engines")
public class DbEngineEntity {

    @Id
    @Column(length = 30)
    private String code;

    @Column(name = "display_name", nullable = false, length = 100)
    private String displayName;

    @Column(name = "sql_dialect", nullable = false, length = 50)
    private String sqlDialect;

    @Column(name = "driver_class", nullable = false, length = 255)
    private String driverClass;

    @Column(name = "url_template", nullable = false, length = 500)
    private String urlTemplate;

    @Column(name = "default_port", nullable = false)
    private Integer defaultPort;

    @Column(name = "default_schema", length = 128)
    private String defaultSchema;

    @Column(name = "identifier_quote_open", nullable = false, length = 2)
    private String identifierQuoteOpen;

    @Column(name = "identifier_quote_close", nullable = false, length = 2)
    private String identifierQuoteClose;

    @Column(name = "limit_style", nullable = false, length = 10)
    private String limitStyle;

    @Column(name = "schema_init_sql", length = 500)
    private String schemaInitSql;

    @Column(name = "default_properties", columnDefinition = "TEXT")
    private String defaultProperties;

    @Column(name = "ssl_properties", columnDefinition = "TEXT")
    private String sslProperties;

    @Column(name = "timeout_property", length = 100)
    private String timeoutProperty;

    @Column(name = "timeout_unit", nullable = false, length = 12)
    private String timeoutUnit;

    @Column(name = "supports_schema", nullable = false)
    private boolean supportsSchema;

    @Column(nullable = false)
    private boolean enabled;

    @Column(name = "sort_order", nullable = false)
    private Integer sortOrder;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    void onCreate() {
        LocalDateTime now = LocalDateTime.now();
        createdAt = now;
        updatedAt = now;
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    public String getCode() {
        return code;
    }

    public void setCode(String code) {
        this.code = code;
    }

    public String getDisplayName() {
        return displayName;
    }

    public void setDisplayName(String displayName) {
        this.displayName = displayName;
    }

    public String getSqlDialect() {
        return sqlDialect;
    }

    public void setSqlDialect(String sqlDialect) {
        this.sqlDialect = sqlDialect;
    }

    public String getDriverClass() {
        return driverClass;
    }

    public void setDriverClass(String driverClass) {
        this.driverClass = driverClass;
    }

    public String getUrlTemplate() {
        return urlTemplate;
    }

    public void setUrlTemplate(String urlTemplate) {
        this.urlTemplate = urlTemplate;
    }

    public Integer getDefaultPort() {
        return defaultPort;
    }

    public void setDefaultPort(Integer defaultPort) {
        this.defaultPort = defaultPort;
    }

    public String getDefaultSchema() {
        return defaultSchema;
    }

    public void setDefaultSchema(String defaultSchema) {
        this.defaultSchema = defaultSchema;
    }

    public String getIdentifierQuoteOpen() {
        return identifierQuoteOpen;
    }

    public void setIdentifierQuoteOpen(String value) {
        this.identifierQuoteOpen = value;
    }

    public String getIdentifierQuoteClose() {
        return identifierQuoteClose;
    }

    public void setIdentifierQuoteClose(String value) {
        this.identifierQuoteClose = value;
    }

    public String getLimitStyle() {
        return limitStyle;
    }

    public void setLimitStyle(String limitStyle) {
        this.limitStyle = limitStyle;
    }

    public String getSchemaInitSql() {
        return schemaInitSql;
    }

    public void setSchemaInitSql(String schemaInitSql) {
        this.schemaInitSql = schemaInitSql;
    }

    public String getDefaultProperties() {
        return defaultProperties;
    }

    public void setDefaultProperties(String defaultProperties) {
        this.defaultProperties = defaultProperties;
    }

    public String getSslProperties() {
        return sslProperties;
    }

    public void setSslProperties(String sslProperties) {
        this.sslProperties = sslProperties;
    }

    public String getTimeoutProperty() {
        return timeoutProperty;
    }

    public void setTimeoutProperty(String timeoutProperty) {
        this.timeoutProperty = timeoutProperty;
    }

    public String getTimeoutUnit() {
        return timeoutUnit;
    }

    public void setTimeoutUnit(String timeoutUnit) {
        this.timeoutUnit = timeoutUnit;
    }

    public boolean isSupportsSchema() {
        return supportsSchema;
    }

    public void setSupportsSchema(boolean supportsSchema) {
        this.supportsSchema = supportsSchema;
    }

    public boolean isEnabled() {
        return enabled;
    }

    public void setEnabled(boolean enabled) {
        this.enabled = enabled;
    }

    public Integer getSortOrder() {
        return sortOrder;
    }

    public void setSortOrder(Integer sortOrder) {
        this.sortOrder = sortOrder;
    }

    public boolean isSslSupported() {
        return sslProperties != null && !sslProperties.isBlank();
    }
}
