-- V3 accidentally created usstat; normalize it to the entity/API column name.
ALTER TABLE conversations
    CHANGE COLUMN usstat status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE';
