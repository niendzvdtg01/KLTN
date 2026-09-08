package com.backend.ai_agent.security;

import java.util.Date;
import java.util.List;

import javax.crypto.SecretKey;

import com.backend.ai_agent.entity.UserEntity;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;

import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;

public class jwtUtils {
    private static final SecretKey SECRET_KEY = Jwts.SIG.HS512.key().build();
    private static final long EXPIRATION_TIME = 36000000;

    public static String generateToken(UserEntity user) {
        return Jwts.builder()
                .subject(user.getEmail())
                .claim("userId", user.getId())
                .issuer("Niendz")
                .issuedAt(new Date())
                .expiration(new Date(System.currentTimeMillis() + EXPIRATION_TIME))
                .signWith(SECRET_KEY)
                .compact();
    }

    public static Integer extarctUser(String token) {
        Claims claims = Jwts.parser()
                .verifyWith(SECRET_KEY)
                .build()
                .parseSignedClaims(token)
                .getPayload();
        return claims.get("userId", Integer.class);
    }

    public static boolean validateToken(String token) {
        try {
            Claims claims = Jwts.parser()
                    .verifyWith(SECRET_KEY)
                    .build()
                    .parseSignedClaims(token)
                    .getPayload();
            return claims.getExpiration().after(new Date());
        } catch (Exception ex) {
            return false;
        }
    }

    public static UsernamePasswordAuthenticationToken getAuthentication(String token) {
        Integer userId = extarctUser(token);
        List<SimpleGrantedAuthority> authorities = List.of(new SimpleGrantedAuthority("ROLE_USER"));
        return new UsernamePasswordAuthenticationToken(userId, null, authorities);
    }
}