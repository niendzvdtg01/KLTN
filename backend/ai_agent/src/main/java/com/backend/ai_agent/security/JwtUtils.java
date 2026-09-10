package com.backend.ai_agent.security;

import java.util.Date;
import java.util.List;

import javax.crypto.SecretKey;

import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;

import com.backend.ai_agent.entity.UserEntity;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;

public class JwtUtils {

    private static final SecretKey SECRET_KEY = Jwts.SIG.HS512.key().build();
    private static final long EXPIRATION_TIME_MILLIS = 36_000_000L;
    private static final String USER_ID_CLAIM = "userId";
    private static final String ISSUER = "Niendz";

    public static String generateToken(UserEntity user) {
        Date now = new Date();
        Date expiration = new Date(now.getTime() + EXPIRATION_TIME_MILLIS);

        return Jwts.builder()
                .subject(user.getEmail())
                .claim(USER_ID_CLAIM, user.getId())
                .issuer(ISSUER)
                .issuedAt(now)
                .expiration(expiration)
                .signWith(SECRET_KEY)
                .compact();
    }

    public static boolean validateToken(String token) {
        try {
            parseClaims(token);
            return true;
        } catch (Exception exception) {
            return false;
        }
    }

    public static UsernamePasswordAuthenticationToken getAuthentication(String token) {
        Long userId = extractUserId(token);
        List<SimpleGrantedAuthority> authorities = List.of(new SimpleGrantedAuthority("ROLE_USER"));
        return new UsernamePasswordAuthenticationToken(userId, null, authorities);
    }

    private static Long extractUserId(String token) {
        Object userId = parseClaims(token).get(USER_ID_CLAIM);
        if (!(userId instanceof Number number)) {
            throw new IllegalArgumentException("Token does not contain a valid userId");
        }
        return number.longValue();
    }

    private static Claims parseClaims(String token) {
        return Jwts.parser()
                .verifyWith(SECRET_KEY)
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }
}
