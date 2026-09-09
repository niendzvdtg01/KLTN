package com.backend.ai_agent.controller;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.backend.ai_agent.dto.request.UpdateUserRequest;
import com.backend.ai_agent.dto.request.UserRequest;
import com.backend.ai_agent.dto.response.UserResponse;
import com.backend.ai_agent.entity.UserEntity;
import com.backend.ai_agent.service.UserService;

@RestController
@RequestMapping("v1/user")
public class UserController {

    private final UserService userService;

    public UserController(UserService userService) {
        this.userService = userService;
    }

    @PostMapping("/create_user")
    public ResponseEntity<UserResponse> createUser(@RequestBody UserRequest request) {
        UserEntity user = userService.createUser(request.fullName(), request.email(), request.password());
        return ResponseEntity.status(HttpStatus.CREATED).body(UserResponse.from(user));
    }

    @GetMapping("/me")
    public UserResponse getCurrentUser(Authentication authentication) {
        return UserResponse.from(userService.findById(currentUserId(authentication)));
    }

    @PutMapping("/me")
    public UserResponse updateCurrentUser(
            Authentication authentication,
            @RequestBody UpdateUserRequest request) {
        UserEntity user = userService.updateUser(
                currentUserId(authentication), request.fullName(), request.email());
        return UserResponse.from(user);
    }

    @DeleteMapping("/me")
    public ResponseEntity<Void> deleteCurrentUser(Authentication authentication) {
        userService.deleteUser(currentUserId(authentication));
        return ResponseEntity.noContent().build();
    }

    private Long currentUserId(Authentication authentication) {
        Object principal = authentication.getPrincipal();
        if (principal instanceof Number userId) {
            return userId.longValue();
        }
        throw new IllegalStateException("Invalid authenticated user");
    }
}
