package com.backend.ai_agent.dto.response;

import java.util.List;

public record ChatResponse(
        MessageResponse message,
        QueryExecutionResponse query,
        String chartType,
        String chartX,
        String chartY,
        String chartTitle,
        String evaluation,
        List<String> highlights,
        int attempts,
        boolean cacheHit) {
}
