-- Catalog of supported database engines. How the backend connects to each engine
-- (driver, JDBC URL, quoting, default/SSL properties, timeout property) is stored as data,
-- so tuning an engine or adding a new one is an UPDATE/INSERT here instead of a code change.
-- A new engine still needs its JDBC driver on the backend classpath.
--
-- url_template placeholders: {host}, {port}, {database}.
-- schema_init_sql placeholder: {schema} (replaced by the quoted, validated schema name).
-- default_properties / ssl_properties: semicolon separated key=value pairs.
-- limit_style: LIMIT (... LIMIT n), TOP (SELECT TOP n ...), FETCH (... FETCH FIRST n ROWS ONLY).
CREATE TABLE db_engines (
    code VARCHAR(30) NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    sql_dialect VARCHAR(50) NOT NULL,
    driver_class VARCHAR(255) NOT NULL,
    url_template VARCHAR(500) NOT NULL,
    default_port INT NOT NULL,
    default_schema VARCHAR(128) NULL,
    identifier_quote_open VARCHAR(2) NOT NULL,
    identifier_quote_close VARCHAR(2) NOT NULL,
    limit_style VARCHAR(10) NOT NULL DEFAULT 'LIMIT',
    schema_init_sql VARCHAR(500) NULL,
    default_properties TEXT NULL,
    ssl_properties TEXT NULL,
    timeout_property VARCHAR(100) NULL,
    timeout_unit VARCHAR(12) NOT NULL DEFAULT 'SECONDS',
    supports_schema BOOLEAN NOT NULL DEFAULT FALSE,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order INT NOT NULL DEFAULT 0,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    PRIMARY KEY (code)
) ENGINE = InnoDB;

INSERT INTO db_engines (code, display_name, sql_dialect, driver_class, url_template, default_port, default_schema,
        identifier_quote_open, identifier_quote_close, limit_style, schema_init_sql, default_properties,
        ssl_properties, timeout_property, timeout_unit, supports_schema, enabled, sort_order, created_at, updated_at)
VALUES
    ('MYSQL', 'MySQL', 'MySQL', 'com.mysql.cj.jdbc.Driver',
        'jdbc:mysql://{host}:{port}/{database}', 3306, NULL, '`', '`', 'LIMIT', NULL,
        'sslMode=DISABLED;allowPublicKeyRetrieval=true;serverTimezone=UTC',
        'sslMode=REQUIRED', 'connectTimeout', 'MILLISECONDS', FALSE, TRUE, 10, NOW(6), NOW(6)),
    ('MARIADB', 'MariaDB', 'MariaDB', 'org.mariadb.jdbc.Driver',
        'jdbc:mariadb://{host}:{port}/{database}', 3306, NULL, '`', '`', 'LIMIT', NULL,
        NULL, 'sslMode=trust', 'connectTimeout', 'MILLISECONDS', FALSE, TRUE, 20, NOW(6), NOW(6)),
    ('POSTGRESQL', 'PostgreSQL', 'PostgreSQL', 'org.postgresql.Driver',
        'jdbc:postgresql://{host}:{port}/{database}', 5432, 'public', '"', '"', 'LIMIT',
        'SET search_path TO {schema}', 'ApplicationName=KLTN-AI-Agent',
        'sslmode=require', 'connectTimeout', 'SECONDS', TRUE, TRUE, 30, NOW(6), NOW(6)),
    ('SQLSERVER', 'Microsoft SQL Server', 'T-SQL (SQL Server)', 'com.microsoft.sqlserver.jdbc.SQLServerDriver',
        'jdbc:sqlserver://{host}:{port};databaseName={database}', 1433, 'dbo', '[', ']', 'TOP', NULL,
        'encrypt=false;applicationName=KLTN-AI-Agent',
        'encrypt=true;trustServerCertificate=true', 'loginTimeout', 'SECONDS', TRUE, TRUE, 40, NOW(6), NOW(6)),
    ('ORACLE', 'Oracle Database', 'Oracle SQL', 'oracle.jdbc.OracleDriver',
        'jdbc:oracle:thin:@//{host}:{port}/{database}', 1521, NULL, '"', '"', 'FETCH',
        'ALTER SESSION SET CURRENT_SCHEMA = {schema}', NULL,
        NULL, 'oracle.net.CONNECT_TIMEOUT', 'MILLISECONDS', TRUE, TRUE, 50, NOW(6), NOW(6));
