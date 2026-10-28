package com.backend.ai_agent.controller;

import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import com.backend.ai_agent.dto.request.ConversationRequest;
import com.backend.ai_agent.dto.request.ConversationUpdateRequest;
import com.backend.ai_agent.dto.request.FeedbackRequest;
import com.backend.ai_agent.dto.request.MessageRequest;
import com.backend.ai_agent.dto.request.QueryRequest;
import com.backend.ai_agent.dto.response.ConversationResponse;
import com.backend.ai_agent.dto.response.MessageResponse;
import com.backend.ai_agent.dto.response.QueryExecutionResponse;
import com.backend.ai_agent.dto.response.ChatResponse;
import com.backend.ai_agent.entity.ConversationEntity;
import com.backend.ai_agent.exception.BadRequestException;
import com.backend.ai_agent.exception.NotFoundException;
import com.backend.ai_agent.exception.UnauthorizedException;
import com.backend.ai_agent.service.ConversationService;
import com.backend.ai_agent.service.QueryExecutionService;

@RestController
@RequestMapping("/v1/conversations")
public class ConversationController {
    private final ConversationService conversationService;
    private static final long STREAM_TIMEOUT_MS = 300_000L;

    private final QueryExecutionService queryExecutionService;
    private final ExecutorService streamExecutor = Executors.newVirtualThreadPerTaskExecutor();

    public ConversationController(ConversationService conversationService, QueryExecutionService queryExecutionService) {
        this.conversationService = conversationService;
        this.queryExecutionService = queryExecutionService;
    }

    @PostMapping
    public ResponseEntity<ConversationResponse> create(Authentication authentication,
            @RequestBody ConversationRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(toResponse(conversationService.create(userId(authentication), request)));
    }

    @GetMapping
    public List<ConversationResponse> findAll(Authentication authentication) {
        return conversationService.findAll(userId(authentication)).stream().map(this::toResponse).toList();
    }

    @GetMapping("/{id}")
    public ConversationResponse findById(Authentication authentication, @PathVariable Long id) {
        return toResponse(conversationService.findById(userId(authentication), id));
    }

    @PatchMapping("/{id}")
    public ConversationResponse update(Authentication authentication, @PathVariable Long id,
            @RequestBody ConversationUpdateRequest request) {
        return toResponse(conversationService.update(userId(authentication), id, request));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> archive(Authentication authentication, @PathVariable Long id) {
        conversationService.archive(userId(authentication), id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{id}/messages")
    public List<MessageResponse> findMessages(Authentication authentication, @PathVariable Long id) {
        return conversationService.findMessages(userId(authentication), id).stream().map(MessageResponse::from)
                .toList();
    }

    @PostMapping("/{id}/messages")
    public ResponseEntity<ChatResponse> addMessage(Authentication authentication, @PathVariable Long id, @RequestBody MessageRequest request) {
        ConversationService.ChatResult result = conversationService.chat(userId(authentication), id, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(toChatResponse(result));
    }

    /**
     * Same as {@link #addMessage} but streams the agent's progress as Server-Sent Events:
     * {@code thought}, {@code observation}, {@code retry}, then {@code result} or {@code error}.
     */
    @PostMapping(value = "/{id}/messages/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter streamMessage(Authentication authentication, @PathVariable Long id,
            @RequestBody MessageRequest request) {
        Long userId = userId(authentication);
        SseEmitter emitter = new SseEmitter(STREAM_TIMEOUT_MS);
        streamExecutor.execute(() -> {
            try {
                ConversationService.ChatResult result = conversationService.chat(userId, id, request,
                        event -> send(emitter, event.type(), event.data()));
                send(emitter, "result", toChatResponse(result));
            } catch (BadRequestException | NotFoundException exception) {
                send(emitter, "error", Map.of("message", exception.getMessage()));
            } catch (RuntimeException exception) {
                send(emitter, "error", Map.of("message", "Có lỗi không mong muốn khi xử lý câu hỏi"));
            } finally {
                emitter.complete();
            }
        });
        return emitter;
    }

    @PostMapping("/{id}/messages/{messageId}/feedback")
    public ResponseEntity<Void> feedback(Authentication authentication, @PathVariable Long id,
            @PathVariable Long messageId, @RequestBody FeedbackRequest request) {
        conversationService.saveFeedback(userId(authentication), id, messageId, request);
        return ResponseEntity.status(HttpStatus.CREATED).build();
    }

    @PostMapping("/{id}/query")
    public QueryExecutionResponse executeQuery(Authentication authentication, @PathVariable Long id,
            @RequestBody QueryRequest request) {
        return QueryExecutionResponse.from(queryExecutionService.execute(userId(authentication), id, request));
    }

    private ChatResponse toChatResponse(ConversationService.ChatResult result) {
        var evaluation = result.evaluation();
        // Prefer the data-aware chart from the evaluation step over the blind one from generation.
        var chart = evaluation != null && evaluation.chart() != null ? evaluation.chart() : result.agent().chart();
        return new ChatResponse(
                MessageResponse.from(result.message()), QueryExecutionResponse.from(result.execution()),
                chart == null ? "table" : chart.type(), chart == null ? null : chart.x(),
                chart == null ? null : chart.y(), chart == null ? null : chart.title(),
                evaluation == null ? null : evaluation.analysis(),
                evaluation == null ? List.of() : evaluation.highlights(),
                result.attempts(), result.agent().cache_hit(), result.steps());
    }

    private void send(SseEmitter emitter, String name, Object data) {
        try {
            emitter.send(SseEmitter.event().name(name).data(data, MediaType.APPLICATION_JSON));
        } catch (IOException | IllegalStateException exception) {
            // Client went away; the agent loop keeps going and the answer is still saved.
        }
    }

    private ConversationResponse toResponse(ConversationEntity conversation) {
        return ConversationResponse.from(conversation);
    }

    private Long userId(Authentication authentication) {
        if (authentication != null && authentication.getPrincipal() instanceof Number number)
            return number.longValue();
        throw new UnauthorizedException("Phiên đăng nhập không hợp lệ");
    }
}
