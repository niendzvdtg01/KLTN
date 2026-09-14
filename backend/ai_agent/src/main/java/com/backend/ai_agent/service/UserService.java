package com.backend.ai_agent.service;

import java.util.Locale;

import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import com.backend.ai_agent.entity.UserEntity;
import com.backend.ai_agent.exception.BadRequestException;
import com.backend.ai_agent.exception.ConflictException;
import com.backend.ai_agent.exception.NotFoundException;
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
            throw new ConflictException("Email đã tồn tại");
        }

        UserEntity user = new UserEntity();
        user.setFullName(fullName.trim());
        user.setEmail(normalizedEmail);
        user.setPasswordHash(passwordEncoder.encode(password));
        return userRepository.save(user);
    }

    public UserEntity findById(Long id) {
        return userRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy người dùng"));
    }

    public UserEntity updateUser(Long id, String fullName, String email) {
        UserEntity user = findById(id);
        String normalizedEmail = normalizeEmail(email);

        if (fullName == null || fullName.isBlank() || normalizedEmail == null || normalizedEmail.isBlank()) {
            throw new BadRequestException("Họ tên và email là bắt buộc");
        }

        userRepository.findByEmailIgnoreCase(normalizedEmail)
                .filter(existing -> !existing.getId().equals(id))
                .ifPresent(existing -> {
                    throw new ConflictException("Email đã tồn tại");
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
            throw new BadRequestException("Họ tên, email và mật khẩu tối thiểu 8 ký tự là bắt buộc");
        }
    }

    private boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    private String normalizeEmail(String email) {
        return email == null ? null : email.trim().toLowerCase(Locale.ROOT);
    }

}
