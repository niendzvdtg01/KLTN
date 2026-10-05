package com.backend.ai_agent.repository;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import com.backend.ai_agent.entity.QueryExecutionEntity;

public interface QueryExecutionRepository extends JpaRepository<QueryExecutionEntity, Long> {
    List<QueryExecutionEntity> findAllByConversationIdOrderByCreatedAtDesc(Long conversationId);
}
