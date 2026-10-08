package com.backend.ai_agent.dto.response;

import java.time.LocalDateTime;

import com.backend.ai_agent.entity.QueryExecutionEntity;

public record QueryExecutionResponse(
        Long id,
        String question,
        String generatedSql,
        String status,
        String resultJson,
        Integer rowCount,
        Long executionTimeMs,
        String errorMessage,
        LocalDateTime createdAt) {

    public static QueryExecutionResponse from(QueryExecutionEntity execution) {
        return new QueryExecutionResponse(
                execution.getId(), execution.getQuestion(), execution.getGeneratedSql(), execution.getStatus(),
                execution.getResultJson(), execution.getRowCount(), execution.getExecutionTimeMs(),
                execution.getErrorMessage(), execution.getCreatedAt());
    }
}
