package services

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"time"

	"go-distributed-llm/internal/models"
	"go-distributed-llm/internal/ports"

	"github.com/google/uuid"
)

// ErrModelUnavailable được trả về khi không có Worker Node nào online (không draining) hỗ trợ model yêu cầu.
var ErrModelUnavailable = errors.New("model unavailable")

type ChatInput struct {
	UserID         string
	ConversationID string
	Model          string
	Prompt         string
}

type EnqueuedJob struct {
	JobID          string
	ConversationID string
	StartedAt      time.Time
	TokenChan      <-chan models.TokenChunk
}

// ChatService đóng gói toàn bộ nghiệp vụ hội thoại:
// - Kiểm tra Worker hỗ trợ model đang sẵn sàng.
// - Kéo lịch sử hội thoại gần nhất (Multi-turn Context) truyền xuống Worker.
// - Lưu tin nhắn/usage và điều phối token real-time qua SSEHub.
type ChatService struct {
	queue             ports.JobQueue
	pubsub            ports.EventBus
	registry          ports.NodeRegistry
	repo              ports.Repository
	sseHub            *SSEHub
	advertiseGrpcAddr string
	advertiseHTTPAddr string
	log               *slog.Logger
}

func NewChatService(
	queue ports.JobQueue,
	pubsub ports.EventBus,
	registry ports.NodeRegistry,
	repo ports.Repository,
	sseHub *SSEHub,
	advertiseGrpcAddr string,
	advertiseHTTPAddr string,
	log *slog.Logger,
) *ChatService {
	return &ChatService{
		queue:             queue,
		pubsub:            pubsub,
		registry:          registry,
		repo:              repo,
		sseHub:            sseHub,
		advertiseGrpcAddr: advertiseGrpcAddr,
		advertiseHTTPAddr: advertiseHTTPAddr,
		log:               log,
	}
}

func (s *ChatService) EnqueueChat(ctx context.Context, input ChatInput) (*EnqueuedJob, error) {
	// 1. Kiểm tra xem có ít nhất 1 Worker đang ONLINE (không DRAINING) phục vụ model này không.
	if s.registry != nil {
		if err := s.ensureModelServed(ctx, input.Model); err != nil {
			return nil, err
		}
	}

	userID := input.UserID
	if userID == "" {
		userID = "anonymous"
	}
	convID := input.ConversationID
	if convID == "" {
		convID = uuid.New().String()
	}

	// 2. Lấy lịch sử hội thoại gần nhất (tối đa 10 lượt) trước khi ghi câu hỏi mới để tạo Multi-turn context.
	turns := make([]models.ChatTurn, 0, 11)
	if s.repo != nil && input.ConversationID != "" {
		if history, err := s.repo.GetHistory(ctx, convID, 10); err == nil {
			for _, msg := range history {
				turns = append(turns, models.ChatTurn{
					Role:    msg.Role,
					Content: msg.Content,
				})
			}
		}
	}
	turns = append(turns, models.ChatTurn{
		Role:    "user",
		Content: input.Prompt,
	})

	jobID := uuid.New().String()
	startedAt := time.Now()

	if s.repo != nil {
		_ = s.repo.SaveMessage(ctx, models.Message{
			ID:             uuid.New().String(),
			ConversationID: convID,
			JobID:          jobID,
			Role:           "user",
			Model:          input.Model,
			Content:        input.Prompt,
			CreatedAt:      startedAt,
		})
	}

	// 3. Đăng ký channel TRƯỚC KHI đẩy job vào Redis để tránh race condition mất token đầu.
	tokenCh := s.sseHub.Register(jobID)

	job := models.JobPayload{
		ID:              jobID,
		UserID:          userID,
		ConversationID:  convID,
		Model:           input.Model,
		Prompt:          input.Prompt,
		Messages:        turns,
		ReplyToGrpcAddr: s.advertiseGrpcAddr,
		ReplyToHTTPAddr: s.advertiseHTTPAddr,
		CreatedAt:       startedAt,
	}
	if err := s.queue.PushJob(ctx, job); err != nil {
		s.sseHub.Unregister(jobID)
		return nil, err
	}

	return &EnqueuedJob{
		JobID:          jobID,
		ConversationID: convID,
		StartedAt:      startedAt,
		TokenChan:      tokenCh,
	}, nil
}

func (s *ChatService) ensureModelServed(ctx context.Context, model string) error {
	nodes, err := s.registry.GetOnlineNodes(ctx)
	if err != nil {
		return err
	}
	for _, n := range nodes {
		if n.Status == "DRAINING" {
			continue
		}
		for _, m := range n.SupportedModels {
			if m == model {
				return nil
			}
		}
	}
	return fmt.Errorf("%w: no active worker serves model %q", ErrModelUnavailable, model)
}

func (s *ChatService) ReleaseJobStream(jobID string) {
	s.sseHub.Unregister(jobID)
}

func (s *ChatService) PushToken(chunk models.TokenChunk) {
	s.sseHub.PushToUser(chunk)
}

func (s *ChatService) CancelJob(ctx context.Context, jobID string) error {
	return s.pubsub.PublishCancel(ctx, jobID)
}

func (s *ChatService) CancelJobDetached(jobID string) {
	cancelCtx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	if err := s.pubsub.PublishCancel(cancelCtx, jobID); err != nil && s.log != nil {
		s.log.Warn("publish cancel on client disconnect failed", "job_id", jobID, "err", err)
	}
}

func (s *ChatService) SaveAssistantResult(userID, convID, jobID, model, workerID, answer string, tokenCount int, startedAt time.Time) {
	if s.repo == nil {
		return
	}
	if userID == "" {
		userID = "anonymous"
	}
	saveCtx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	_ = s.repo.SaveMessage(saveCtx, models.Message{
		ID:             uuid.New().String(),
		ConversationID: convID,
		JobID:          jobID,
		Role:           "assistant",
		Model:          model,
		Content:        answer,
		CreatedAt:      time.Now(),
	})
	_ = s.repo.LogUsage(saveCtx, models.UsageLog{
		JobID:      jobID,
		UserID:     userID,
		Model:      model,
		WorkerID:   workerID,
		TokenCount: tokenCount,
		DurationMs: time.Since(startedAt).Milliseconds(),
		CreatedAt:  time.Now(),
	})
}

func (s *ChatService) GetHistory(ctx context.Context, conversationID string, limit int) ([]models.Message, error) {
	if s.repo == nil {
		return []models.Message{}, nil
	}
	return s.repo.GetHistory(ctx, conversationID, limit)
}
