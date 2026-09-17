package com.backend.ai_agent.service;

import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.backend.ai_agent.dto.request.ConversationRequest;
import com.backend.ai_agent.dto.request.ConversationUpdateRequest;
import com.backend.ai_agent.entity.ConversationEntity;
import com.backend.ai_agent.entity.DataSourceEntity;
import com.backend.ai_agent.entity.MessageEntity;
import com.backend.ai_agent.entity.UserEntity;
import com.backend.ai_agent.exception.BadRequestException;
import com.backend.ai_agent.exception.NotFoundException;
import com.backend.ai_agent.repository.ConversationRepository;
import com.backend.ai_agent.repository.DataSourceRepository;
import com.backend.ai_agent.repository.MessageRepository;
import com.backend.ai_agent.repository.UserRepository;

@Service
public class ConversationService {
    private static final String ACTIVE = "ACTIVE";
    private static final String ARCHIVED = "ARCHIVED";

    private final ConversationRepository conversationRepository;
    private final MessageRepository messageRepository;
    private final DataSourceRepository dataSourceRepository;
    private final UserRepository userRepository;

    public ConversationService(ConversationRepository conversationRepository, MessageRepository messageRepository,
            DataSourceRepository dataSourceRepository, UserRepository userRepository) {
        this.conversationRepository = conversationRepository;
        this.messageRepository = messageRepository;
        this.dataSourceRepository = dataSourceRepository;
        this.userRepository = userRepository;
    }

    @Transactional
    public ConversationEntity create(Long userId, ConversationRequest request) {
        if (request == null || request.dataSourceId() == null || isInvalidTitle(request.title())) {
            throw new BadRequestException("Tiêu đề và data source là bắt buộc");
        }
        UserEntity user = userRepository.findById(userId)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy người dùng"));
        DataSourceEntity source = dataSourceRepository.findByIdAndOwnerId(request.dataSourceId(), userId)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy data source"));
        if (!ACTIVE.equals(source.getStatus())) {
            throw new BadRequestException("Không thể tạo conversation với data source đã archive");
        }
        ConversationEntity conversation = new ConversationEntity();
        conversation.setUser(user);
        conversation.setDataSource(source);
        conversation.setTitle(request.title().trim());
        return conversationRepository.save(conversation);
    }

    @Transactional(readOnly = true)
    public List<ConversationEntity> findAll(Long userId) {
        return conversationRepository.findAllByUserIdOrderByUpdatedAtDesc(userId);
    }

    @Transactional(readOnly = true)
    public ConversationEntity findById(Long userId, Long id) {
        return ownedConversation(userId, id);
    }

    @Transactional
    public ConversationEntity update(Long userId, Long id, ConversationUpdateRequest request) {
        if (request == null || isInvalidTitle(request.title())) {
            throw new BadRequestException("Tiêu đề conversation không được để trống");
        }
        ConversationEntity conversation = ownedConversation(userId, id);
        conversation.setTitle(request.title().trim());
        return conversationRepository.save(conversation);
    }

    @Transactional
    public void archive(Long userId, Long id) {
        ConversationEntity conversation = ownedConversation(userId, id);
        conversation.setStatus(ARCHIVED);
        conversationRepository.save(conversation);
    }

    @Transactional(readOnly = true)
    public List<MessageEntity> findMessages(Long userId, Long conversationId) {
        ownedConversation(userId, conversationId);
        return messageRepository.findAllByConversationIdOrderByCreatedAtAsc(conversationId);
    }

    private ConversationEntity ownedConversation(Long userId, Long id) {
        return conversationRepository.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy conversation"));
    }

    private boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    private boolean isInvalidTitle(String value) {
        return isBlank(value) || value.trim().length() > 255;
    }
}
