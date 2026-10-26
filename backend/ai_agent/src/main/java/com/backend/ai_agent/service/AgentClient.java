package com.backend.ai_agent.service;

import java.net.http.HttpClient;
import java.util.List;
import java.util.Map;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import com.backend.ai_agent.exception.BadRequestException;

import tools.jackson.databind.json.JsonMapper;

@Component
public class AgentClient {
    private final RestClient client;
    private final String apiKey;
    private final JsonMapper mapper;

    public AgentClient(RestClient.Builder builder,
            @Value("${app.agent.base-url:http://localhost:8001}") String baseUrl,
            @Value("${app.agent.api-key:mock-ai-agent-key}") String apiKey,
            JsonMapper mapper) {
        // Pin HTTP/1.1: the JDK HttpClient defaults to HTTP/2 and attempts an h2c
        // upgrade against cleartext http:// targets, which uvicorn (h11) rejects with
        // 400 "Invalid HTTP request received.".
        JdkClientHttpRequestFactory requestFactory = new JdkClientHttpRequestFactory(
                HttpClient.newBuilder().version(HttpClient.Version.HTTP_1_1).build());
        this.client = builder.baseUrl(baseUrl).requestFactory(requestFactory).build();
        this.apiKey = apiKey;
        this.mapper = mapper;
    }

    public AgentResult generate(String question, String schemaJson, List<Map<String, String>> conversation) {
        return generate(question, schemaJson, conversation, null, null, List.of());
    }

    public AgentResult generate(String question, String schemaJson, List<Map<String, String>> conversation,
            String previousSql, String error, List<Map<String, String>> examples) {
        try {
            Map<String, Object> schema = schemaJson == null || schemaJson.isBlank()
                    ? Map.of("tables", List.of())
                    : mapper.readValue(schemaJson, Map.class);
            Object tables = normalizeTables(schema.get("tables"));
            AgentRequest body = new AgentRequest(question, tables, conversation, 1000, previousSql, error,
                    examples == null ? List.of() : examples);
            String payload = mapper.writeValueAsString(body);
            AgentResult result = client.post().uri("/v1/agent/chat")
                    .header("X-API-Key", apiKey).contentType(MediaType.APPLICATION_JSON)
                    .body(payload).retrieve().body(AgentResult.class);
            if (result == null || result.sql() == null || result.sql().isBlank()) {
                throw new BadRequestException("Agent không trả về SQL hợp lệ");
            }
            return result;
        } catch (BadRequestException exception) {
            throw exception;
        } catch (RuntimeException exception) {
            throw new BadRequestException("Không thể kết nối AI agent: " + safeMessage(exception));
        }
    }

    /**
     * Data-aware evaluation of an executed result set. Best-effort: returns null on any failure so a
     * successful query is never lost just because the analysis step could not run.
     */
    public Evaluation evaluate(String question, String sql, String resultJson) {
        try {
            Map<String, Object> result = resultJson == null || resultJson.isBlank()
                    ? Map.of()
                    : mapper.readValue(resultJson, Map.class);
            Object columns = result.getOrDefault("columns", List.of());
            Object rows = result.getOrDefault("rows", List.of());
            int rowCount = rows instanceof List<?> list ? list.size() : 0;
            EvaluateRequest body = new EvaluateRequest(question, sql, columns, rows, rowCount);
            String payload = mapper.writeValueAsString(body);
            return client.post().uri("/v1/agent/evaluate")
                    .header("X-API-Key", apiKey).contentType(MediaType.APPLICATION_JSON)
                    .body(payload).retrieve().body(Evaluation.class);
        } catch (RuntimeException exception) {
            return null;
        }
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> normalizeTables(Object rawTables) {
        if (!(rawTables instanceof List<?> list)) return List.of();
        return list.stream().filter(Map.class::isInstance).map(item -> {
            Map<String, Object> source = (Map<String, Object>) item;
            List<String> columns = source.get("columns") instanceof List<?> values
                    ? values.stream().map(value -> value instanceof Map<?, ?> column
                            ? String.valueOf(column.get("name")) : String.valueOf(value)).toList()
                    : List.of();
            return Map.of("name", String.valueOf(source.get("name")), "columns", columns);
        }).toList();
    }

    private String safeMessage(Exception exception) {
        String value = exception.getMessage();
        return value == null ? exception.getClass().getSimpleName() : value.substring(0, Math.min(300, value.length()));
    }

    public record AgentRequest(String question, Object schema, List<Map<String, String>> conversation, int max_rows,
            String previous_sql, String error, List<Map<String, String>> examples) {}
    public record EvaluateRequest(String question, String sql, Object columns, Object rows, int row_count) {}
    public record Chart(String type, String x, String y, List<String> series, String title) {}
    public record AgentResult(String title, String sql, String provider, String model, boolean read_only,
            String rule, Chart chart, boolean cache_hit) {}
    public record Evaluation(String analysis, List<String> highlights, Chart chart) {}
}
