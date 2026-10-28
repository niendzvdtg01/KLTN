package com.backend.ai_agent.dto.response;

import java.util.List;
import java.util.Map;

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
        boolean cacheHit,
        List<Map<String, Object>> steps) {
}
