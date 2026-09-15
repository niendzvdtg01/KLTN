package com.backend.ai_agent.controller;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.backend.ai_agent.dto.request.DataSourceRequest;
import com.backend.ai_agent.dto.response.DataSourceResponse;
import com.backend.ai_agent.entity.DataSourceEntity;
import com.backend.ai_agent.exception.UnauthorizedException;
import com.backend.ai_agent.service.DataSourceService;

@RestController
@RequestMapping("v1/data-sources")
public class DataSourceController {

    private final DataSourceService dataSourceService;

    public DataSourceController(DataSourceService dataSourceService) {
        this.dataSourceService = dataSourceService;
    }

    @PostMapping
    public ResponseEntity<DataSourceResponse> create(
            Authentication authentication,
            @RequestBody DataSourceRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(toResponse(dataSourceService.create(currentUserId(authentication), request)));
    }

    @GetMapping
    public List<DataSourceResponse> findAll(Authentication authentication) {
        return dataSourceService.findAll(currentUserId(authentication)).stream()
                .map(this::toResponse)
                .toList();
    }

    @GetMapping("/{id}")
    public DataSourceResponse findById(Authentication authentication, @PathVariable Long id) {
        return toResponse(dataSourceService.findById(currentUserId(authentication), id));
    }

    @PutMapping("/{id}")
    public DataSourceResponse update(
            Authentication authentication,
            @PathVariable Long id,
            @RequestBody DataSourceRequest request) {
        return toResponse(dataSourceService.update(currentUserId(authentication), id, request));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> archive(Authentication authentication, @PathVariable Long id) {
        dataSourceService.archive(currentUserId(authentication), id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/test-connection")
    public DataSourceResponse testConnection(Authentication authentication, @PathVariable Long id) {
        return toResponse(dataSourceService.testConnection(currentUserId(authentication), id));
    }

    @PostMapping("/{id}/sync-schema")
    public DataSourceResponse syncSchema(Authentication authentication, @PathVariable Long id) {
        return toResponse(dataSourceService.syncSchema(currentUserId(authentication), id));
    }

    private DataSourceResponse toResponse(DataSourceEntity source) {
        return DataSourceResponse.from(source);
    }

    private Long currentUserId(Authentication authentication) {
        Object principal = authentication.getPrincipal();
        if (principal instanceof Number userId) {
            return userId.longValue();
        }
        throw new UnauthorizedException("Phiên đăng nhập không hợp lệ");
    }
}
