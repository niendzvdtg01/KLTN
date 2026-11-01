package com.backend.ai_agent.controller;

import java.util.List;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.backend.ai_agent.dto.response.DbEngineResponse;
import com.backend.ai_agent.service.DataSourceService;

/** Database engines a data source can use, read from the db_engines catalog. */
@RestController
@RequestMapping("v1/db-engines")
public class DbEngineController {

    private final DataSourceService dataSourceService;

    public DbEngineController(DataSourceService dataSourceService) {
        this.dataSourceService = dataSourceService;
    }

    @GetMapping
    public List<DbEngineResponse> findAll() {
        return dataSourceService.engines().stream().map(DbEngineResponse::from).toList();
    }
}
