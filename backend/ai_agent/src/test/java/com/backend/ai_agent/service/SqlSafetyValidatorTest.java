package com.backend.ai_agent.service;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;

import org.junit.jupiter.api.Test;

import com.backend.ai_agent.exception.BadRequestException;

class SqlSafetyValidatorTest {
    private final SqlSafetyValidator validator = new SqlSafetyValidator();

    @Test
    void acceptsSelectAndWithQueries() {
        assertDoesNotThrow(() -> validator.validateReadOnly("SELECT id, name FROM users LIMIT 10"));
        assertDoesNotThrow(() -> validator.validateReadOnly("WITH recent AS (SELECT * FROM users) SELECT * FROM recent"));
    }

    @Test
    void rejectsMutatingAndMultiStatementQueries() {
        assertThrows(BadRequestException.class,
                () -> validator.validateReadOnly("DELETE FROM users"));
        assertThrows(BadRequestException.class,
                () -> validator.validateReadOnly("SELECT * FROM users; SELECT * FROM orders"));
        assertThrows(BadRequestException.class,
                () -> validator.validateReadOnly("SELECT * FROM users /* bypass */"));
    }
}
