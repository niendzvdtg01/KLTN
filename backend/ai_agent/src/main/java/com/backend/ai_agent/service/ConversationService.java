package com.backend.ai_agent.service;

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

    private final ConversationRepository conversationRepository;
    private final MessageRepository messageRepository;
    private final MessageFeedbackRepository messageFeedbackRepository;
    private final DataSourceRepository dataSourceRepository;
    private final UserRepository userRepository;
    private final AgentClient agentClient;
    private final QueryExecutionService queryExecutionService;
    private final QueryCacheService queryCacheService;
    private final JsonMapper objectMapper;
    private final int maxCorrectionAttempts;

    public ConversationService(ConversationRepository conversationRepository, MessageRepository messageRepository,
            MessageFeedbackRepository messageFeedbackRepository, DataSourceRepository dataSourceRepository,
            UserRepository userRepository, AgentClient agentClient, QueryExecutionService queryExecutionService,
            QueryCacheService queryCacheService, JsonMapper objectMapper,
            @Value("${app.agent.max-correction-attempts:2}") int maxCorrectionAttempts) {
        this.conversationRepository = conversationRepository;
        this.messageRepository = messageRepository;
        this.messageFeedbackRepository = messageFeedbackRepository;
        this.dataSourceRepository = dataSourceRepository;
        this.userRepository = userRepository;
        this.agentClient = agentClient;
        this.queryExecutionService = queryExecutionService;
        this.queryCacheService = queryCacheService;
        this.objectMapper = objectMapper;
        this.maxCorrectionAttempts = Math.max(1, maxCorrectionAttempts);
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
        addUserMessage(userId, conversationId, request);
        ConversationEntity conversation = ownedConversation(userId, conversationId);
        String question = request.content().trim();
        String schemaJson = conversation.getDataSource().getSchemaJson();
        List<Map<String, String>> context = conversationContext(conversationId);
        List<Map<String, String>> examples = acceptedExamples(conversation.getDataSource().getId());

        // Agentic self-correction loop: on a failed execution, feed the SQL + DB error back to the
        // agent and regenerate, up to maxCorrectionAttempts.
        AgentClient.AgentResult generated = null;
        QueryExecutionEntity execution = null;
        String previousSql = null;
        String previousError = null;
        int attempts = 0;
        for (int attempt = 0; attempt < maxCorrectionAttempts; attempt++) {
            attempts++;
            generated = agentClient.generate(question, schemaJson, context, previousSql, previousError, examples);
            execution = queryExecutionService.execute(userId, conversationId,
                    new QueryRequest(question, generated.sql()));
            if ("SUCCESS".equals(execution.getStatus())) {
                break;
            }
            previousSql = generated.sql();
            previousError = execution.getErrorMessage();
        }
        if (execution == null || !"SUCCESS".equals(execution.getStatus())) {
            throw new BadRequestException(execution == null || execution.getErrorMessage() == null
                    ? "Query thất bại" : execution.getErrorMessage());
        }

        AgentClient.Evaluation evaluation = agentClient.evaluate(question, generated.sql(), execution.getResultJson());

        MessageEntity assistant = new MessageEntity();
        assistant.setConversation(conversation);
        assistant.setRole("ASSISTANT");
        assistant.setContent(generated.title() + "\n\n" + generated.sql());
        assistant.setMetadata(buildMetadata(question, generated, execution, evaluation, attempts));
        assistant = messageRepository.save(assistant);
        conversation.setLastMessageAt(assistant.getCreatedAt());
        conversationRepository.save(conversation);
        queryCacheService.evictConversation(conversationId);
        return new ChatResult(assistant, execution, generated, evaluation, attempts);
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
            AgentClient.Evaluation evaluation, int attempts) {}

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
