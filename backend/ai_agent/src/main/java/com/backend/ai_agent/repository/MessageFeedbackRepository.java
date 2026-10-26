package com.backend.ai_agent.repository;

import java.util.List;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.backend.ai_agent.entity.MessageFeedbackEntity;

public interface MessageFeedbackRepository extends JpaRepository<MessageFeedbackEntity, Long> {

    /**
     * Cross-turn memory: the most recent UP-rated question -> SQL pairs for a data source,
     * reused as few-shot examples when generating future queries.
     */
    @Query("select f from MessageFeedbackEntity f "
            + "where f.message.conversation.dataSource.id = :dataSourceId "
            + "and f.rating = 'UP' and f.generatedSql is not null "
            + "order by f.createdAt desc")
    List<MessageFeedbackEntity> findAcceptedExamples(@Param("dataSourceId") Long dataSourceId, Pageable pageable);
}
