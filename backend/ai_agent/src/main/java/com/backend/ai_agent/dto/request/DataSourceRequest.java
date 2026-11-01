package com.backend.ai_agent.dto.request;

import java.util.Map;

public record DataSourceRequest(
        String name,
        String dbType,
        String host,
        Integer port,
        String databaseName,
        String username,
        String password,
        String schemaName,
        Boolean sslEnabled,
        Integer connectTimeoutSeconds,
        Integer queryTimeoutSeconds,
        Integer maxRows,
        Map<String, String> properties) {
}
