package com.backend.ai_agent.security;

import java.io.IOException;

import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

@Component
public class AuthFilter extends OncePerRequestFilter {

    private static final String ACCESS_COOKIE = "access_cookie";
    private static final String CREATE_USER_PATH = "v1/user/create_user";

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        if (isPreflightRequest(request) || isPublicRequest(request)) {
            filterChain.doFilter(request, response);
            return;
        }

        String token = findAccessToken(request);
        if (token == null) {
            writeError(response, HttpServletResponse.SC_UNAUTHORIZED, "Missing required cookie");
            return;
        }

        if (!JwtUtils.validateToken(token)) {
            writeError(response, HttpServletResponse.SC_FORBIDDEN, "Invalid or expired token");
            return;
        }

        SecurityContextHolder.getContext().setAuthentication(JwtUtils.getAuthentication(token));
        filterChain.doFilter(request, response);
    }

    private boolean isPreflightRequest(HttpServletRequest request) {
        return "OPTIONS".equalsIgnoreCase(request.getMethod());
    }

    private boolean isPublicRequest(HttpServletRequest request) {
        String path = request.getServletPath();
        return path.startsWith("/auth/") || path.contains(CREATE_USER_PATH);
    }

    private String findAccessToken(HttpServletRequest request) {
        if (request.getCookies() == null) {
            return null;
        }

        for (Cookie cookie : request.getCookies()) {
            if (ACCESS_COOKIE.equals(cookie.getName())) {
                return cookie.getValue();
            }
        }
        return null;
    }

    private void writeError(HttpServletResponse response, int status, String message) throws IOException {
        response.setStatus(status);
        response.setContentType("text/plain");
        response.getWriter().write(message);
    }
}
