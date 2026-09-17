package com.backend.ai_agent.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

import com.backend.ai_agent.entity.MessageEntity;

public interface MessageRepository extends JpaRepository<MessageEntity, Long> {
    List<MessageEntity> findAllByConversationIdOrderByCreatedAtAsc(Long conversationId);
}
