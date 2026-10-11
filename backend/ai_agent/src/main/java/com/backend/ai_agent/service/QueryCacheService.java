package com.backend.ai_agent.service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Duration;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import com.backend.ai_agent.entity.DataSourceEntity;

import tools.jackson.databind.json.JsonMapper;

@Service
public class QueryCacheService {
    private static final String KEY_PREFIX = "ai-agent:query:";

    private final StringRedisTemplate redisTemplate;
    private final JsonMapper jsonMapper;
    private final Duration ttl;

    public QueryCacheService(StringRedisTemplate redisTemplate, JsonMapper jsonMapper,
            @Value("${app.cache.query-ttl-seconds:60}") long ttlSeconds) {
        this.redisTemplate = redisTemplate;
        this.jsonMapper = jsonMapper;
        this.ttl = Duration.ofSeconds(Math.max(1, ttlSeconds));
    }

    public CachedQueryResult get(DataSourceEntity source, String sql) {
        try {
            String value = redisTemplate.opsForValue().get(key(source, sql));
            return value == null ? null : jsonMapper.readValue(value, CachedQueryResult.class);
        } catch (RuntimeException exception) {
            // Cache is optional: Redis outage must not make the database query fail.
            return null;
        }
    }

    public void put(DataSourceEntity source, String sql, CachedQueryResult result) {
        try {
            redisTemplate.opsForValue().set(key(source, sql), jsonMapper.writeValueAsString(result), ttl);
        } catch (RuntimeException ignored) {
            // Cache is best effort and may be unavailable during development/deployment.
        }
    }

    private String key(DataSourceEntity source, String sql) {
        String fingerprint = source.getId() + "|" + source.getHost() + "|" + source.getPort() + "|"
                + source.getDatabaseName() + "|" + sql.trim();
        return KEY_PREFIX + sha256(fingerprint);
    }

    private String sha256(String value) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                    .digest(value.getBytes(StandardCharsets.UTF_8));
            StringBuilder hex = new StringBuilder(digest.length * 2);
            for (byte item : digest) {
                hex.append(String.format("%02x", item));
            }
            return hex.toString();
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 không khả dụng", exception);
        }
    }

    public record CachedQueryResult(String resultJson, Integer rowCount) {
    }
}
