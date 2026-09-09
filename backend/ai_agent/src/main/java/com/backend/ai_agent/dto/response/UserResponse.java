package com.backend.ai_agent.dto.response;

import com.backend.ai_agent.entity.UserEntity;

public record UserResponse(Long id, String fullName, String email) {

    public static UserResponse from(UserEntity user) {
        return new UserResponse(user.getId(), user.getFullName(), user.getEmail());
    }
}
