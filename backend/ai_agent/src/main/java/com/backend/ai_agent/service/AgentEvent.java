package com.backend.ai_agent.service;

import java.util.Map;

/**
 * Progress event of the agent loop, streamed to the client. Types: {@code thought} (agent picked a
 * tool), {@code observation} (tool finished, ok or failed), {@code retry} (something failed and the
 * backend is retrying).
 */
public record AgentEvent(String type, Map<String, Object> data) {

    @FunctionalInterface
    public interface Listener {
        Listener NONE = event -> {
        };

        void on(AgentEvent event);
    }
}
