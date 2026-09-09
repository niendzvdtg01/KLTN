package com.backend.ai_agent.service;

import java.util.Locale;

import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import com.backend.ai_agent.entity.UserEntity;
import com.backend.ai_agent.repository.UserRepository;

@Service
public class UserService {

    private static final int MIN_PASSWORD_LENGTH = 8;

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    public UserService(UserRepository userRepository, PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
    }

    public UserEntity createUser(String fullName, String email, String password) {
        String normalizedEmail = normalizeEmail(email);
        validateInput(fullName, normalizedEmail, password);

        if (userRepository.existsByEmailIgnoreCase(normalizedEmail)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Email already exists");
        }

        UserEntity user = new UserEntity();
        user.setFullName(fullName.trim());
        user.setEmail(normalizedEmail);
        user.setPasswordHash(passwordEncoder.encode(password));
        return userRepository.save(user);
    }

    public UserEntity findById(Long id) {
        return userRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
    }

    public UserEntity updateUser(Long id, String fullName, String email) {
        UserEntity user = findById(id);
        String normalizedEmail = normalizeEmail(email);

        if (fullName == null || fullName.isBlank() || normalizedEmail == null || normalizedEmail.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Full name and email are required");
        }

        userRepository.findByEmailIgnoreCase(normalizedEmail)
                .filter(existing -> !existing.getId().equals(id))
                .ifPresent(existing -> {
                    throw new ResponseStatusException(HttpStatus.CONFLICT, "Email already exists");
                });

        user.setFullName(fullName.trim());
        user.setEmail(normalizedEmail);
        return userRepository.save(user);
    }

    public void deleteUser(Long id) {
        UserEntity user = findById(id);
        userRepository.delete(user);
    }

    private void validateInput(String fullName, String email, String password) {
        if (isBlank(fullName) || isBlank(email) || isBlank(password)
                || password.length() < MIN_PASSWORD_LENGTH) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Full name, email and password of at least 8 characters are required");
        }
    }

    private boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    private String normalizeEmail(String email) {
        return email == null ? null : email.trim().toLowerCase(Locale.ROOT);
    }

}
