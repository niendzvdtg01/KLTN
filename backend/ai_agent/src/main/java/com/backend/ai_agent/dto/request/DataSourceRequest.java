package com.backend.ai_agent.dto.request;

public record DataSourceRequest(
        String name,
        String dbType,
        String host,
        Integer port,
        String databaseName,
        String username,
        String password) {
}
