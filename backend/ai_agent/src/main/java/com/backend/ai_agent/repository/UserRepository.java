package com.backend.ai_agent.repository;

import org.springframework.data.jpa.repository.JpaRepository;

import com.backend.ai_agent.entity.UserEntity;

public interface UserRepository extends JpaRepository<UserEntity, Long> {

}
