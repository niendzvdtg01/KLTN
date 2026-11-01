-- Per data source connection settings. Defaults keep existing rows behaving as before
-- (30s query timeout, 1000 rows, no SSL).
ALTER TABLE data_sources
    ADD COLUMN schema_name VARCHAR(128) NULL,
    ADD COLUMN ssl_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN connect_timeout_seconds INT NOT NULL DEFAULT 10,
    ADD COLUMN query_timeout_seconds INT NOT NULL DEFAULT 30,
    ADD COLUMN max_rows INT NOT NULL DEFAULT 1000;

-- Every data source must use an engine from the catalog. Existing rows are MYSQL, seeded in V6.
ALTER TABLE data_sources
    ADD KEY idx_data_sources_db_type (db_type),
    ADD CONSTRAINT fk_data_sources_db_engine
        FOREIGN KEY (db_type) REFERENCES db_engines (code)
        ON UPDATE CASCADE
        ON DELETE RESTRICT;

-- Extra JDBC properties of one data source (e.g. characterEncoding, sslrootcert).
-- Credentials and dangerous driver properties are rejected by the application.
CREATE TABLE data_source_properties (
    id BIGINT NOT NULL AUTO_INCREMENT,
    data_source_id BIGINT NOT NULL,
    prop_key VARCHAR(100) NOT NULL,
    prop_value VARCHAR(1000) NOT NULL,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_data_source_properties_key (data_source_id, prop_key),
    CONSTRAINT fk_data_source_properties_source
        FOREIGN KEY (data_source_id) REFERENCES data_sources (id)
        ON DELETE CASCADE
) ENGINE = InnoDB;
