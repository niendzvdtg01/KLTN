package com.backend.ai_agent.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

import com.backend.ai_agent.entity.DbEngineEntity;

public interface DbEngineRepository extends JpaRepository<DbEngineEntity, String> {

    List<DbEngineEntity> findAllByEnabledTrueOrderBySortOrderAscDisplayNameAsc();
}
