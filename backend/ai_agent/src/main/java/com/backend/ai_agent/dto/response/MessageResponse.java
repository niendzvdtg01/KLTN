package com.backend.ai_agent.dto.response;

import java.time.LocalDateTime;

import com.backend.ai_agent.entity.MessageEntity;

public record MessageResponse(Long id, String role, String content, LocalDateTime createdAt) {
    public static MessageResponse from(MessageEntity message) {
        return new MessageResponse(message.getId(), message.getRole(), message.getContent(), message.getCreatedAt());
    }
}
