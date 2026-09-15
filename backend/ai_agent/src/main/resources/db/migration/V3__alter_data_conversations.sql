-- Add ownership and connection status to data sources.
-- This migration assumes data_sources and conversations do not contain
-- existing rows that need to be backfilled.
ALTER TABLE data_sources
    ADD COLUMN owner_id BIGINT NOT NULL,
    ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    ADD COLUMN last_connection_status VARCHAR(30) NULL,
    ADD COLUMN last_connection_error TEXT NULL,
    ADD KEY idx_data_sources_owner (owner_id),
    ADD CONSTRAINT fk_data_sources_owner
        FOREIGN KEY (owner_id) REFERENCES users (id)
        ON DELETE RESTRICT;

-- A data source name must be unique only for the same owner.
ALTER TABLE data_sources
    DROP INDEX uk_data_sources_name,
    ADD UNIQUE KEY uk_data_sources_owner_name (owner_id, name);

-- Add ownership and lifecycle status to conversations.
ALTER TABLE conversations
    ADD COLUMN user_id BIGINT NOT NULL,
    ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    ADD COLUMN last_message_at DATETIME(6) NULL,
    ADD KEY idx_conversations_user_updated (user_id, updated_at),
    ADD CONSTRAINT fk_conversations_user
        FOREIGN KEY (user_id) REFERENCES users (id)
        ON DELETE CASCADE;

-- Removing a data source must not delete conversation history.
ALTER TABLE conversations
    DROP FOREIGN KEY fk_conversations_data_source;

ALTER TABLE conversations
    ADD CONSTRAINT fk_conversations_data_source_restrict
        FOREIGN KEY (data_source_id) REFERENCES data_sources (id)
        ON DELETE RESTRICT;
