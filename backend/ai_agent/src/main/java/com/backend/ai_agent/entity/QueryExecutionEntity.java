package com.backend.ai_agent.entity;

import java.time.LocalDateTime;
import jakarta.persistence.*;

@Entity
@Table(name = "query_executions")
public class QueryExecutionEntity {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "conversation_id", nullable = false) private ConversationEntity conversation;
    @Column(nullable = false, columnDefinition = "LONGTEXT") private String question;
    @Column(name = "generated_sql", nullable = false, columnDefinition = "LONGTEXT") private String generatedSql;
    @Column(nullable = false, length = 20) private String status;
    @Column(name = "result_json", columnDefinition = "LONGTEXT") private String resultJson;
    @Column(name = "row_count") private Integer rowCount;
    @Column(name = "execution_time_ms") private Long executionTimeMs;
    @Column(name = "error_message", columnDefinition = "LONGTEXT") private String errorMessage;
    @Column(name = "created_at", nullable = false) private LocalDateTime createdAt;
    @PrePersist void onCreate() { createdAt = LocalDateTime.now(); }
    public Long getId(){return id;} public ConversationEntity getConversation(){return conversation;} public void setConversation(ConversationEntity v){conversation=v;}
    public String getQuestion(){return question;} public void setQuestion(String v){question=v;} public String getGeneratedSql(){return generatedSql;} public void setGeneratedSql(String v){generatedSql=v;}
    public String getStatus(){return status;} public void setStatus(String v){status=v;} public String getResultJson(){return resultJson;} public void setResultJson(String v){resultJson=v;}
    public Integer getRowCount(){return rowCount;} public void setRowCount(Integer v){rowCount=v;} public Long getExecutionTimeMs(){return executionTimeMs;} public void setExecutionTimeMs(Long v){executionTimeMs=v;}
    public String getErrorMessage(){return errorMessage;} public void setErrorMessage(String v){errorMessage=v;} public LocalDateTime getCreatedAt(){return createdAt;}
}
