package com.backend.ai_agent.controller;

import java.util.List;

import org.springframework.http.HttpStatus;
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

import com.backend.ai_agent.dto.request.ConversationRequest;
import com.backend.ai_agent.dto.request.ConversationUpdateRequest;
import com.backend.ai_agent.dto.request.MessageRequest;
import com.backend.ai_agent.dto.request.QueryRequest;
import com.backend.ai_agent.dto.response.ConversationResponse;
import com.backend.ai_agent.dto.response.MessageResponse;
import com.backend.ai_agent.dto.response.QueryExecutionResponse;
import com.backend.ai_agent.entity.ConversationEntity;
import com.backend.ai_agent.exception.UnauthorizedException;
import com.backend.ai_agent.service.ConversationService;
import com.backend.ai_agent.service.QueryExecutionService;

@RestController
@RequestMapping("/v1/conversations")
public class ConversationController {
    private final ConversationService conversationService;
    private final QueryExecutionService queryExecutionService;

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
    public ResponseEntity<MessageResponse> addMessage(Authentication authentication, @PathVariable Long id, @RequestBody MessageRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(MessageResponse.from(conversationService.addUserMessage(userId(authentication), id, request)));
    }

    @PostMapping("/{id}/query")
    public QueryExecutionResponse executeQuery(Authentication authentication, @PathVariable Long id,
            @RequestBody QueryRequest request) {
        return QueryExecutionResponse.from(queryExecutionService.execute(userId(authentication), id, request));
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
