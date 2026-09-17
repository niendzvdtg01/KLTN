package com.backend.ai_agent.dto.response;

import java.time.LocalDateTime;

import com.backend.ai_agent.entity.ConversationEntity;

public record ConversationResponse(
        Long id, String title, String status, Long dataSourceId, String dataSourceName,
        LocalDateTime lastMessageAt, LocalDateTime createdAt, LocalDateTime updatedAt) {
    public static ConversationResponse from(ConversationEntity conversation) {
        return new ConversationResponse(conversation.getId(), conversation.getTitle(), conversation.getStatus(),
                conversation.getDataSource().getId(), conversation.getDataSource().getName(),
                conversation.getLastMessageAt(), conversation.getCreatedAt(), conversation.getUpdatedAt());
    }
}
