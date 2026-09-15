package com.backend.ai_agent.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.backend.ai_agent.entity.DataSourceEntity;

public interface DataSourceRepository extends JpaRepository<DataSourceEntity, Long> {

    List<DataSourceEntity> findAllByOwnerIdOrderByUpdatedAtDesc(Long ownerId);

    Optional<DataSourceEntity> findByIdAndOwnerId(Long id, Long ownerId);

    boolean existsByOwnerIdAndNameIgnoreCase(Long ownerId, String name);

    boolean existsByOwnerIdAndNameIgnoreCaseAndIdNot(Long ownerId, String name, Long id);
}
