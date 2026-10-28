package com.backend.ai_agent.service;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.backend.ai_agent.dto.request.ConversationRequest;
import com.backend.ai_agent.dto.request.ConversationUpdateRequest;
import com.backend.ai_agent.dto.request.FeedbackRequest;
import com.backend.ai_agent.dto.request.MessageRequest;
import com.backend.ai_agent.dto.request.QueryRequest;
import com.backend.ai_agent.entity.ConversationEntity;
import com.backend.ai_agent.entity.DataSourceEntity;
import com.backend.ai_agent.entity.MessageEntity;
import com.backend.ai_agent.entity.MessageFeedbackEntity;
import com.backend.ai_agent.entity.QueryExecutionEntity;
import com.backend.ai_agent.entity.UserEntity;
import com.backend.ai_agent.exception.BadRequestException;
import com.backend.ai_agent.exception.NotFoundException;
import com.backend.ai_agent.repository.ConversationRepository;
import com.backend.ai_agent.repository.DataSourceRepository;
import com.backend.ai_agent.repository.MessageFeedbackRepository;
import com.backend.ai_agent.repository.MessageRepository;
import com.backend.ai_agent.repository.UserRepository;

import tools.jackson.databind.json.JsonMapper;

@Service
public class ConversationService {
    private static final String ACTIVE = "ACTIVE";
    private static final String ARCHIVED = "ARCHIVED";
    private static final String FINAL_TOOL = "final_answer";
    private static final int MAX_OBSERVATION_CHARS = 4000;

    private final ConversationRepository conversationRepository;
    private final MessageRepository messageRepository;
    private final MessageFeedbackRepository messageFeedbackRepository;
    private final DataSourceRepository dataSourceRepository;
    private final UserRepository userRepository;
    private final AgentClient agentClient;
    private final QueryExecutionService queryExecutionService;
    private final QueryCacheService queryCacheService;
    private final AgentToolService agentToolService;
    private final SqlSafetyValidator sqlSafetyValidator;
    private final JsonMapper objectMapper;
    private final int maxSteps;
    private final int maxRetries;

    public ConversationService(ConversationRepository conversationRepository, MessageRepository messageRepository,
            MessageFeedbackRepository messageFeedbackRepository, DataSourceRepository dataSourceRepository,
            UserRepository userRepository, AgentClient agentClient, QueryExecutionService queryExecutionService,
            QueryCacheService queryCacheService, AgentToolService agentToolService,
            SqlSafetyValidator sqlSafetyValidator, JsonMapper objectMapper,
            @Value("${app.agent.max-steps:8}") int maxSteps,
            @Value("${app.agent.max-retries:3}") int maxRetries) {
        this.conversationRepository = conversationRepository;
        this.messageRepository = messageRepository;
        this.messageFeedbackRepository = messageFeedbackRepository;
        this.dataSourceRepository = dataSourceRepository;
        this.userRepository = userRepository;
        this.agentClient = agentClient;
        this.queryExecutionService = queryExecutionService;
        this.queryCacheService = queryCacheService;
        this.agentToolService = agentToolService;
        this.sqlSafetyValidator = sqlSafetyValidator;
        this.objectMapper = objectMapper;
        this.maxSteps = Math.max(2, maxSteps);
        this.maxRetries = Math.max(0, maxRetries);
    }

    @Transactional
    public ConversationEntity create(Long userId, ConversationRequest request) {
        if (request == null || request.dataSourceId() == null || isInvalidTitle(request.title())) {
            throw new BadRequestException("Tiêu đề và data source là bắt buộc");
        }
        UserEntity user = userRepository.findById(userId)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy người dùng"));
        DataSourceEntity source = dataSourceRepository.findByIdAndOwnerId(request.dataSourceId(), userId)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy data source"));
        if (!ACTIVE.equals(source.getStatus())) {
            throw new BadRequestException("Không thể tạo conversation với data source đã archive");
        }
        ConversationEntity conversation = new ConversationEntity();
        conversation.setUser(user);
        conversation.setDataSource(source);
        conversation.setTitle(request.title().trim());
        return conversationRepository.save(conversation);
    }

    @Transactional(readOnly = true)
    public List<ConversationEntity> findAll(Long userId) {
        return conversationRepository.findAllByUserIdOrderByUpdatedAtDesc(userId);
    }

    @Transactional(readOnly = true)
    public ConversationEntity findById(Long userId, Long id) {
        return ownedConversation(userId, id);
    }

    @Transactional
    public ConversationEntity update(Long userId, Long id, ConversationUpdateRequest request) {
        if (request == null || isInvalidTitle(request.title())) {
            throw new BadRequestException("Tiêu đề conversation không được để trống");
        }
        ConversationEntity conversation = ownedConversation(userId, id);
        conversation.setTitle(request.title().trim());
        return conversationRepository.save(conversation);
    }

    @Transactional
    public void archive(Long userId, Long id) {
        ConversationEntity conversation = ownedConversation(userId, id);
        conversation.setStatus(ARCHIVED);
        conversationRepository.save(conversation);
    }

    @Transactional(readOnly = true)
    public List<MessageEntity> findMessages(Long userId, Long conversationId) {
        ownedConversation(userId, conversationId);
        return messageRepository.findAllByConversationIdOrderByCreatedAtAsc(conversationId);
    }

    @Transactional
    public MessageEntity addUserMessage(Long userId, Long conversationId, MessageRequest request) {
        ConversationEntity conversation = ownedConversation(userId, conversationId);
        if (!ACTIVE.equals(conversation.getStatus()))
            throw new BadRequestException("Không thể gửi tin nhắn vào conversation đã archive");
        if (request == null || request.content() == null || request.content().isBlank()
                || request.content().trim().length() > 10000)
            throw new BadRequestException("Nội dung tin nhắn phải từ 1 đến 10000 ký tự");
        MessageEntity message = new MessageEntity();
        message.setConversation(conversation);
        message.setRole("USER");
        message.setContent(request.content().trim());
        MessageEntity saved = messageRepository.save(message);
        conversation.setLastMessageAt(saved.getCreatedAt());
        conversationRepository.save(conversation);
        queryCacheService.evictConversation(conversationId);
        return saved;
    }

    @Transactional
    public ChatResult chat(Long userId, Long conversationId, MessageRequest request) {
        return chat(userId, conversationId, request, AgentEvent.Listener.NONE);
    }

    /**
     * Agent loop: the agent picks a tool, the backend runs it and sends the observation back, until the
     * agent returns a final SQL that executes successfully. Every failure (agent unreachable, tool error,
     * unsafe or failing SQL) is reported to the listener as a {@code retry} event; tool/SQL errors are fed
     * back to the agent so it can correct itself, an unreachable agent is retried with backoff.
     */
    @Transactional
    public ChatResult chat(Long userId, Long conversationId, MessageRequest request, AgentEvent.Listener listener) {
        addUserMessage(userId, conversationId, request);
        ConversationEntity conversation = ownedConversation(userId, conversationId);
        DataSourceEntity source = conversation.getDataSource();
        if (!ACTIVE.equals(source.getStatus())) {
            throw new BadRequestException("Data source không ở trạng thái ACTIVE");
        }
        String question = request.content().trim();
        String schemaJson = source.getSchemaJson();
        List<Map<String, String>> context = conversationContext(conversationId);
        List<Map<String, String>> examples = acceptedExamples(source.getId());

        List<Map<String, Object>> steps = new ArrayList<>();
        int retries = 0;
        int sqlAttempts = 0;
        String lastError = null;
        while (steps.size() < maxSteps) {
            int stepNumber = steps.size() + 1;
            AgentClient.AgentStep decision;
            try {
                decision = agentClient.step(question, schemaJson, context, examples, steps, maxSteps - steps.size());
            } catch (AgentClient.AgentUnavailableException exception) {
                lastError = exception.getMessage();
                retries = registerRetry(listener, retries, lastError, "Đang kết nối lại AI agent");
                backoff(retries);
                continue;
            }

            boolean isFinal = "final".equals(decision.action());
            String tool = isFinal ? FINAL_TOOL : decision.tool();
            Map<String, Object> args = stepArgs(decision);
            listener.on(new AgentEvent("thought", eventData("step", stepNumber, "tool", tool,
                    "message", decision.thought(), "args", args)));

            Map<String, Object> step = new LinkedHashMap<>();
            step.put("tool", tool);
            step.put("thought", decision.thought());
            step.put("args", args);
            try {
                if (isFinal) {
                    sqlAttempts++;
                    QueryExecutionEntity execution = runFinal(userId, conversationId, question, decision.sql());
                    step.put("ok", true);
                    step.put("result", Map.of("rowCount", execution.getRowCount() == null ? 0 : execution.getRowCount()));
                    recordStep(conversation, steps, step, listener, stepNumber,
                            "Chạy thành công, " + (execution.getRowCount() == null ? 0 : execution.getRowCount()) + " dòng");
                    return finish(conversation, question, decision, execution, steps, sqlAttempts);
                }
                Object result = runTool(source, schemaJson, decision);
                step.put("ok", true);
                step.put("result", truncateForAgent(result));
                recordStep(conversation, steps, step, listener, stepNumber, summarize(result));
            } catch (BadRequestException exception) {
                lastError = exception.getMessage();
                step.put("ok", false);
                step.put("error", lastError);
                recordStep(conversation, steps, step, listener, stepNumber, lastError);
                retries = registerRetry(listener, retries, lastError, "Đã gửi lỗi lại cho agent để tự sửa");
            }
        }
        throw new BadRequestException("Agent không tìm được câu trả lời sau " + maxSteps + " bước"
                + (lastError == null ? "" : ": " + lastError));
    }

    private QueryExecutionEntity runFinal(Long userId, Long conversationId, String question, String sql) {
        // Validate here: a BadRequestException thrown inside the transactional execute() would mark the
        // whole chat transaction rollback-only even though we catch it.
        String safeSql = sqlSafetyValidator.validateReadOnly(sql);
        QueryExecutionEntity execution = queryExecutionService.execute(userId, conversationId,
                new QueryRequest(question, safeSql));
        if (!"SUCCESS".equals(execution.getStatus())) {
            throw new BadRequestException(execution.getErrorMessage() == null ? "Query thất bại"
                    : execution.getErrorMessage());
        }
        return execution;
    }

    private Object runTool(DataSourceEntity source, String schemaJson, AgentClient.AgentStep decision) {
        if (decision.tool() == null) {
            throw new BadRequestException("Agent không chỉ định tool");
        }
        return switch (decision.tool()) {
            case "describe_table" -> agentToolService.describeTable(schemaJson, decision.table());
            case "sample_values" -> agentToolService.sampleValues(source, decision.table(), decision.column());
            case "run_sql" -> agentToolService.runPreview(source, decision.sql());
            default -> throw new BadRequestException("Tool không được hỗ trợ: " + decision.tool());
        };
    }

    private ChatResult finish(ConversationEntity conversation, String question, AgentClient.AgentStep decision,
            QueryExecutionEntity execution, List<Map<String, Object>> steps, int sqlAttempts) {
        AgentClient.AgentResult generated = new AgentClient.AgentResult(
                decision.title() == null || decision.title().isBlank() ? question : decision.title(),
                execution.getGeneratedSql(), null, null, true, "agent_loop", decision.chart(), false);
        AgentClient.Evaluation evaluation = agentClient.evaluate(question, generated.sql(), execution.getResultJson());

        MessageEntity assistant = new MessageEntity();
        assistant.setConversation(conversation);
        assistant.setRole("ASSISTANT");
        assistant.setContent(generated.title() + "\n\n" + generated.sql());
        assistant.setMetadata(buildMetadata(question, generated, execution, evaluation, sqlAttempts));
        assistant = messageRepository.save(assistant);
        conversation.setLastMessageAt(assistant.getCreatedAt());
        conversationRepository.save(conversation);
        queryCacheService.evictConversation(conversation.getId());
        return new ChatResult(assistant, execution, generated, evaluation, sqlAttempts, List.copyOf(steps));
    }

    /** Persists the step as an append-only TOOL message and streams the observation. */
    private void recordStep(ConversationEntity conversation, List<Map<String, Object>> steps,
            Map<String, Object> step, AgentEvent.Listener listener, int stepNumber, String summary) {
        steps.add(step);
        boolean ok = Boolean.TRUE.equals(step.get("ok"));
        MessageEntity message = new MessageEntity();
        message.setConversation(conversation);
        message.setRole("TOOL");
        message.setContent(step.get("tool") + (ok ? ": " : " lỗi: ") + summary);
        message.setMetadata(toJson(Map.of("step", stepNumber, "tool", step.get("tool"), "ok", ok,
                "args", step.get("args"), "thought", String.valueOf(step.get("thought")))));
        messageRepository.save(message);
        listener.on(new AgentEvent("observation", eventData("step", stepNumber, "tool", step.get("tool"),
                "status", ok ? "ok" : "error", "message", summary)));
    }

    private int registerRetry(AgentEvent.Listener listener, int retries, String reason, String action) {
        int attempt = retries + 1;
        if (attempt > maxRetries) {
            throw new BadRequestException("Agent vẫn gặp lỗi sau " + maxRetries + " lần thử lại: " + reason);
        }
        listener.on(new AgentEvent("retry", eventData("attempt", attempt, "maxAttempts", maxRetries,
                "message", reason, "action", action)));
        return attempt;
    }

    private void backoff(int attempt) {
        try {
            Thread.sleep(Math.min(4000L, 500L * (1L << (attempt - 1))));
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new BadRequestException("Yêu cầu đã bị hủy");
        }
    }

    private Map<String, Object> stepArgs(AgentClient.AgentStep decision) {
        Map<String, Object> args = new LinkedHashMap<>();
        if (decision.table() != null) args.put("table", decision.table());
        if (decision.column() != null) args.put("column", decision.column());
        if (decision.sql() != null) args.put("sql", decision.sql());
        return args;
    }

    private Object truncateForAgent(Object result) {
        String json = toJson(result);
        if (json == null || json.length() <= MAX_OBSERVATION_CHARS) return result;
        return json.substring(0, MAX_OBSERVATION_CHARS) + "...(truncated)";
    }

    private String summarize(Object result) {
        if (result instanceof Map<?, ?> map && map.get("rowCount") instanceof Number count) {
            return count + " dòng xem trước";
        }
        if (result instanceof List<?> list) {
            return list.size() + " mục";
        }
        return "xong";
    }

    private Map<String, Object> eventData(Object... pairs) {
        Map<String, Object> data = new LinkedHashMap<>();
        for (int index = 0; index + 1 < pairs.length; index += 2) {
            data.put(String.valueOf(pairs[index]), pairs[index + 1]);
        }
        return data;
    }

    private String toJson(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (RuntimeException exception) {
            return null;
        }
    }

    @Transactional
    public MessageFeedbackEntity saveFeedback(Long userId, Long conversationId, Long messageId,
            FeedbackRequest request) {
        ownedConversation(userId, conversationId);
        MessageEntity message = messageRepository.findById(messageId)
                .filter(candidate -> candidate.getConversation().getId().equals(conversationId))
                .orElseThrow(() -> new NotFoundException("Không tìm thấy tin nhắn"));
        String rating = request == null ? null : request.rating();
        if (!"UP".equals(rating) && !"DOWN".equals(rating)) {
            throw new BadRequestException("rating phải là UP hoặc DOWN");
        }
        MessageFeedbackEntity feedback = new MessageFeedbackEntity();
        feedback.setMessage(message);
        feedback.setRating(rating);
        feedback.setCorrection(request.correction() == null || request.correction().isBlank()
                ? null : request.correction().trim());
        // Snapshot question + SQL from the assistant message so UP ratings can seed few-shot memory.
        applyMetadataSnapshot(message.getMetadata(), feedback);
        return messageFeedbackRepository.save(feedback);
    }

    private List<Map<String, String>> conversationContext(Long conversationId) {
        List<Map<String, String>> context = queryCacheService.getConversation(conversationId);
        if (context == null) {
            context = messageRepository.findAllByConversationIdOrderByCreatedAtAsc(conversationId).stream()
                    .filter(message -> "USER".equals(message.getRole()) || "ASSISTANT".equals(message.getRole()))
                    .limit(20)
                    .map(message -> Map.of("role", message.getRole().toLowerCase(), "content", message.getContent()))
                    .toList();
            queryCacheService.putConversation(conversationId, context);
        }
        return context;
    }

    private List<Map<String, String>> acceptedExamples(Long dataSourceId) {
        return messageFeedbackRepository.findAcceptedExamples(dataSourceId, PageRequest.of(0, 5)).stream()
                .map(feedback -> Map.of(
                        "question", feedback.getQuestion() == null ? "" : feedback.getQuestion(),
                        "sql", feedback.getGeneratedSql() == null ? "" : feedback.getGeneratedSql()))
                .filter(example -> !example.get("sql").isBlank())
                .toList();
    }

    private String buildMetadata(String question, AgentClient.AgentResult generated, QueryExecutionEntity execution,
            AgentClient.Evaluation evaluation, int attempts) {
        Map<String, Object> meta = new LinkedHashMap<>();
        meta.put("title", generated.title());
        meta.put("sql", generated.sql());
        meta.put("question", question);
        meta.put("queryId", execution.getId());
        meta.put("attempts", attempts);
        AgentClient.Chart chart = evaluation != null && evaluation.chart() != null
                ? evaluation.chart() : generated.chart();
        if (chart != null) {
            Map<String, Object> chartMeta = new LinkedHashMap<>();
            chartMeta.put("type", chart.type());
            chartMeta.put("x", chart.x());
            chartMeta.put("y", chart.y());
            chartMeta.put("title", chart.title());
            meta.put("chart", chartMeta);
        }
        if (evaluation != null) {
            meta.put("evaluation", evaluation.analysis());
            meta.put("highlights", evaluation.highlights());
        }
        try {
            return objectMapper.writeValueAsString(meta);
        } catch (RuntimeException exception) {
            return null;
        }
    }

    @SuppressWarnings("unchecked")
    private void applyMetadataSnapshot(String metadataJson, MessageFeedbackEntity feedback) {
        if (metadataJson == null || metadataJson.isBlank()) {
            return;
        }
        try {
            Map<String, Object> meta = objectMapper.readValue(metadataJson, Map.class);
            if (meta.get("question") != null) {
                feedback.setQuestion(String.valueOf(meta.get("question")));
            }
            if (meta.get("sql") != null) {
                feedback.setGeneratedSql(String.valueOf(meta.get("sql")));
            }
        } catch (RuntimeException ignored) {
            // metadata is best-effort; feedback is still recorded without the snapshot.
        }
    }

    public record ChatResult(MessageEntity message, QueryExecutionEntity execution, AgentClient.AgentResult agent,
            AgentClient.Evaluation evaluation, int attempts, List<Map<String, Object>> steps) {}

    private ConversationEntity ownedConversation(Long userId, Long id) {
        return conversationRepository.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy conversation"));
    }

    private boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    private boolean isInvalidTitle(String value) {
        return isBlank(value) || value.trim().length() > 255;
    }
}
