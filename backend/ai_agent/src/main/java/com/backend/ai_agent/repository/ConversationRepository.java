package com.backend.ai_agent.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.backend.ai_agent.entity.ConversationEntity;

public interface ConversationRepository extends JpaRepository<ConversationEntity, Long> {
    List<ConversationEntity> findAllByUserIdOrderByUpdatedAtDesc(Long userId);

    Optional<ConversationEntity> findByIdAndUserId(Long id, Long userId);
}
