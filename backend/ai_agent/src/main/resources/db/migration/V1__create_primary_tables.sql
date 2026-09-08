-- Database connections available to the agent.
CREATE TABLE data_sources (
    id BIGINT NOT NULL AUTO_INCREMENT,
    name VARCHAR(150) NOT NULL,
    db_type VARCHAR(30) NOT NULL,
    host VARCHAR(255) NOT NULL,
    port INT NOT NULL,
    database_name VARCHAR(255) NOT NULL,
    username VARCHAR(255) NOT NULL,
    password VARCHAR(500) NOT NULL,
    schema_json LONGTEXT NULL,
    last_synced_at DATETIME(6) NULL,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_data_sources_name (name)
) ENGINE = InnoDB;

-- A chat session using one data source.
CREATE TABLE conversations (
    id BIGINT NOT NULL AUTO_INCREMENT,
    title VARCHAR(255) NOT NULL,
    data_source_id BIGINT NOT NULL,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    PRIMARY KEY (id),
    KEY idx_conversations_data_source (data_source_id),
    KEY idx_conversations_updated_at (updated_at),
    CONSTRAINT fk_conversations_data_source
        FOREIGN KEY (data_source_id) REFERENCES data_sources (id)
        ON DELETE CASCADE
) ENGINE = InnoDB;

-- User and assistant messages in a conversation.
CREATE TABLE messages (
    id BIGINT NOT NULL AUTO_INCREMENT,
    conversation_id BIGINT NOT NULL,
    role VARCHAR(20) NOT NULL,
    content LONGTEXT NOT NULL,
    created_at DATETIME(6) NOT NULL,
    PRIMARY KEY (id),
    KEY idx_messages_conversation_created (conversation_id, created_at),
    CONSTRAINT fk_messages_conversation
        FOREIGN KEY (conversation_id) REFERENCES conversations (id)
        ON DELETE CASCADE
) ENGINE = InnoDB;

-- Generated SQL and its execution result.
CREATE TABLE query_executions (
    id BIGINT NOT NULL AUTO_INCREMENT,
    conversation_id BIGINT NOT NULL,
    question LONGTEXT NOT NULL,
    generated_sql LONGTEXT NOT NULL,
    status VARCHAR(20) NOT NULL,
    result_json LONGTEXT NULL,
    row_count INT NULL,
    execution_time_ms BIGINT NULL,
    error_message LONGTEXT NULL,
    created_at DATETIME(6) NOT NULL,
    PRIMARY KEY (id),
    KEY idx_query_executions_conversation_created (conversation_id, created_at),
    CONSTRAINT fk_query_executions_conversation
        FOREIGN KEY (conversation_id) REFERENCES conversations (id)
        ON DELETE CASCADE
) ENGINE = InnoDB;
