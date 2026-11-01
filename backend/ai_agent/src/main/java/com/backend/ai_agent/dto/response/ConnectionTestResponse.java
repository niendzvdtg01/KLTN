package com.backend.ai_agent.dto.response;

public record ConnectionTestResponse(
        boolean success,
        String message,
        String databaseProduct,
        String databaseVersion,
        long latencyMs) {
}
