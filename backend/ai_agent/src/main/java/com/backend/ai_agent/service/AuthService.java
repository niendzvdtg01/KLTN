package com.backend.ai_agent.service;

import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import com.backend.ai_agent.dto.request.LoginRequest;
import com.backend.ai_agent.entity.UserEntity;
import com.backend.ai_agent.repository.UserRepository;

@Service
public class AuthService {
    private final UserRepository userRepository;
    private final PasswordEncoder encoder;

    public AuthService(UserRepository userRepository, PasswordEncoder encoder) {
        this.userRepository = userRepository;
        this.encoder = encoder;
    }

    public UserEntity authenticate(LoginRequest request){
        UserEntity user = userRepository.findByEmailIgnoreCase(request.email()).orElseThrow(() -> new RuntimeException("Email is not exist!"));
        if(!encoder.matches(request.password(), user.getPasswordHash())){
            throw new RuntimeException("Incorect password");
        }
        return user;
    } 
}
