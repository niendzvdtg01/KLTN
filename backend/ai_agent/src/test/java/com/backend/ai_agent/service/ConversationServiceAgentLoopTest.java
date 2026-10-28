package com.backend.ai_agent.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import com.backend.ai_agent.dto.request.MessageRequest;
import com.backend.ai_agent.entity.ConversationEntity;
import com.backend.ai_agent.entity.DataSourceEntity;
import com.backend.ai_agent.entity.MessageEntity;
import com.backend.ai_agent.entity.QueryExecutionEntity;
import com.backend.ai_agent.exception.BadRequestException;
import com.backend.ai_agent.repository.ConversationRepository;
import com.backend.ai_agent.repository.DataSourceRepository;
import com.backend.ai_agent.repository.MessageFeedbackRepository;
import com.backend.ai_agent.repository.MessageRepository;
import com.backend.ai_agent.repository.UserRepository;

import tools.jackson.databind.json.JsonMapper;

class ConversationServiceAgentLoopTest {
    private static final String SCHEMA = "{\"tables\":[{\"name\":\"orders\",\"columns\":[{\"name\":\"id\",\"type\":\"INT\"}]}]}";

    private final AgentClient agentClient = mock(AgentClient.class);
    private final QueryExecutionService queryExecutionService = mock(QueryExecutionService.class);
    private final MessageRepository messageRepository = mock(MessageRepository.class);
    private final ConversationRepository conversationRepository = mock(ConversationRepository.class);
    private final List<AgentEvent> events = new ArrayList<>();
    private ConversationService service;

    @BeforeEach
    void setUp() {
        JsonMapper mapper = JsonMapper.builder().build();
        SqlSafetyValidator validator = new SqlSafetyValidator();
        service = new ConversationService(conversationRepository, messageRepository,
                mock(MessageFeedbackRepository.class), mock(DataSourceRepository.class), mock(UserRepository.class),
                agentClient, queryExecutionService, mock(QueryCacheService.class),
                new AgentToolService(validator, mapper), validator, mapper, 6, 2);

        DataSourceEntity source = new DataSourceEntity();
        source.setStatus("ACTIVE");
        source.setDbType("MYSQL");
        source.setSchemaJson(SCHEMA);
        ConversationEntity conversation = new ConversationEntity();
        conversation.setDataSource(source);
        when(conversationRepository.findByIdAndUserId(1L, 7L)).thenReturn(Optional.of(conversation));
        when(messageRepository.save(any(MessageEntity.class))).thenAnswer(call -> call.getArgument(0));
    }

    @Test
    void retriesUnreachableAgentThenUsesToolAndFinishes() {
        when(agentClient.step(anyString(), anyString(), anyList(), anyList(), anyList(), anyInt()))
                .thenThrow(new AgentClient.AgentUnavailableException("timeout"))
                .thenReturn(tool("describe_table"))
                .thenReturn(finalStep("SELECT COUNT(*) AS total FROM orders"));
        when(queryExecutionService.execute(eq(7L), eq(1L), any())).thenReturn(execution("SUCCESS", null));

        ConversationService.ChatResult result = chat();

        assertEquals(1, result.attempts());
        assertEquals(2, result.steps().size());
        assertEquals(List.of("retry", "thought", "observation", "thought", "observation"), eventTypes());
    }

    @Test
    void feedsFailedSqlBackToAgentAndReportsRetry() {
        when(agentClient.step(anyString(), anyString(), anyList(), anyList(), anyList(), anyInt()))
                .thenReturn(finalStep("SELECT total FROM orders"))
                .thenReturn(finalStep("SELECT COUNT(*) AS total FROM orders"));
        when(queryExecutionService.execute(eq(7L), eq(1L), any()))
                .thenReturn(execution("FAILED", "Unknown column 'total'"))
                .thenReturn(execution("SUCCESS", null));

        ConversationService.ChatResult result = chat();

        assertEquals(2, result.attempts());
        assertEquals(false, result.steps().get(0).get("ok"));
        assertEquals("Unknown column 'total'", result.steps().get(0).get("error"));
        assertTrue(eventTypes().contains("retry"));
    }

    @Test
    void blocksUnsafeSqlAndGivesUpAfterMaxRetries() {
        when(agentClient.step(anyString(), anyString(), anyList(), anyList(), anyList(), anyInt()))
                .thenReturn(finalStep("DELETE FROM orders"));

        BadRequestException exception = assertThrows(BadRequestException.class, this::chat);

        assertTrue(exception.getMessage().contains("2 lần thử lại"));
        assertEquals(2, eventTypes().stream().filter("retry"::equals).count());
    }

    private ConversationService.ChatResult chat() {
        return service.chat(7L, 1L, new MessageRequest("Có bao nhiêu đơn hàng?"), events::add);
    }

    private List<String> eventTypes() {
        return events.stream().map(AgentEvent::type).toList();
    }

    private static AgentClient.AgentStep tool(String name) {
        return new AgentClient.AgentStep("tool", "Xem bảng orders", name, "orders", null, null, null, null);
    }

    private static AgentClient.AgentStep finalStep(String sql) {
        return new AgentClient.AgentStep("final", "Đếm đơn hàng", null, null, null, sql, "Số đơn hàng", null);
    }

    private static QueryExecutionEntity execution(String status, String error) {
        QueryExecutionEntity execution = new QueryExecutionEntity();
        execution.setStatus(status);
        execution.setErrorMessage(error);
        execution.setGeneratedSql("SELECT COUNT(*) AS total FROM orders");
        execution.setRowCount("SUCCESS".equals(status) ? 1 : null);
        return execution;
    }
}
