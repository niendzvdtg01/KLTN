package com.backend.ai_agent.dto.response;

import java.time.LocalDateTime;

import com.backend.ai_agent.entity.DataSourceEntity;

public record DataSourceResponse(
        Long id,
        String name,
        String dbType,
        String host,
        Integer port,
        String databaseName,
        String username,
        String status,
        String lastConnectionStatus,
        String lastConnectionError,
        String schemaJson,
        LocalDateTime lastSyncedAt,
        LocalDateTime createdAt,
        LocalDateTime updatedAt) {

    public static DataSourceResponse from(DataSourceEntity source) {
        return new DataSourceResponse(
                source.getId(), source.getName(), source.getDbType(), source.getHost(), source.getPort(),
                source.getDatabaseName(), source.getUsername(), source.getStatus(),
                source.getLastConnectionStatus(), source.getLastConnectionError(), source.getSchemaJson(),
                source.getLastSyncedAt(), source.getCreatedAt(), source.getUpdatedAt());
    }
}
