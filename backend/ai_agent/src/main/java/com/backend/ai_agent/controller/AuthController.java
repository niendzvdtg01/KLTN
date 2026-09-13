package com.backend.ai_agent.controller;

import org.springframework.http.HttpHeaders;

import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.RequestMapping;

import com.backend.ai_agent.dto.request.LoginRequest;
import com.backend.ai_agent.entity.UserEntity;
import com.backend.ai_agent.security.JwtUtils;
import com.backend.ai_agent.service.AuthService;

import java.time.Duration;
import jakarta.servlet.http.HttpServletResponse;

import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;


@Controller 
@RequestMapping("v1/auth")
public class AuthController {
    private final AuthService authServicce;
    private final String COOKIE_NAME = "access_cookie";

    public AuthController(AuthService authServicce) {
        this.authServicce = authServicce;
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody LoginRequest request, HttpServletResponse response) {
        UserEntity user = authServicce.authenticate(request);
        String token = JwtUtils.generateToken(user);

        ResponseCookie cookie = ResponseCookie.from(COOKIE_NAME, token)
        .httpOnly(false)
        .sameSite("Lax")
        .path("/")
        .maxAge(Duration.ofMinutes(60))
        .build();
        
        response.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());
        return ResponseEntity.ok("Login sucessfully!!!");
    }
    
}
