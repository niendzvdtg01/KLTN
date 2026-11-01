package com.backend.ai_agent.dto.response;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.Map;

import com.backend.ai_agent.entity.DataSourceEntity;
import com.backend.ai_agent.entity.DataSourcePropertyEntity;

public record DataSourceResponse(
        Long id,
        String name,
        String dbType,
        String host,
        Integer port,
        String databaseName,
        String username,
        String schemaName,
        boolean sslEnabled,
        Integer connectTimeoutSeconds,
        Integer queryTimeoutSeconds,
        Integer maxRows,
        Map<String, String> properties,
        String status,
        String lastConnectionStatus,
        String lastConnectionError,
        String schemaJson,
        LocalDateTime lastSyncedAt,
        LocalDateTime createdAt,
        LocalDateTime updatedAt) {

    public static DataSourceResponse from(DataSourceEntity source) {
        Map<String, String> properties = new LinkedHashMap<>();
        for (DataSourcePropertyEntity property : source.getProperties()) {
            properties.put(property.getKey(), property.getValue());
        }
        return new DataSourceResponse(
                source.getId(), source.getName(), source.getDbType(), source.getHost(), source.getPort(),
                source.getDatabaseName(), source.getUsername(), source.getSchemaName(), source.isSslEnabled(),
                source.getConnectTimeoutSeconds(), source.getQueryTimeoutSeconds(), source.getMaxRows(),
                properties, source.getStatus(),
                source.getLastConnectionStatus(), source.getLastConnectionError(), source.getSchemaJson(),
                source.getLastSyncedAt(), source.getCreatedAt(), source.getUpdatedAt());
    }
}
