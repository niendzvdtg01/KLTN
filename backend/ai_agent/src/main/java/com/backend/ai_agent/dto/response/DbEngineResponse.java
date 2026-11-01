package com.backend.ai_agent.dto.response;

import com.backend.ai_agent.entity.DbEngineEntity;

public record DbEngineResponse(
        String code,
        String displayName,
        String sqlDialect,
        Integer defaultPort,
        String defaultSchema,
        boolean supportsSchema,
        boolean supportsSsl) {

    public static DbEngineResponse from(DbEngineEntity engine) {
        return new DbEngineResponse(engine.getCode(), engine.getDisplayName(), engine.getSqlDialect(),
                engine.getDefaultPort(), engine.getDefaultSchema(), engine.isSupportsSchema(),
                engine.isSslSupported());
    }
}
