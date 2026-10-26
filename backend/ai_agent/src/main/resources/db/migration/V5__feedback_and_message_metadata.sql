-- Rich assistant-message payload (evaluation, highlights, chart spec, queryId) as JSON,
-- so reloading conversation history can re-render charts and evaluations, not just text.
ALTER TABLE messages
    ADD COLUMN metadata LONGTEXT NULL;

-- User feedback on an assistant answer. UP-rated rows double as the few-shot memory:
-- their (question, generated_sql) snapshot is reused as examples for future generations.
CREATE TABLE message_feedback (
    id BIGINT NOT NULL AUTO_INCREMENT,
    message_id BIGINT NOT NULL,
    rating VARCHAR(8) NOT NULL,
    correction LONGTEXT NULL,
    question LONGTEXT NULL,
    generated_sql LONGTEXT NULL,
    created_at DATETIME(6) NOT NULL,
    PRIMARY KEY (id),
    KEY idx_message_feedback_message (message_id),
    KEY idx_message_feedback_rating_created (rating, created_at),
    CONSTRAINT fk_message_feedback_message
        FOREIGN KEY (message_id) REFERENCES messages (id)
        ON DELETE CASCADE
) ENGINE = InnoDB;
