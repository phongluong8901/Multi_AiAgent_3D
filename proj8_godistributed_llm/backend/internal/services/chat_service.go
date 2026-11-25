package services

import (
	"context"
	"errors"
	"fmt"
	"hash/fnv"
	"log/slog"
	"math"
	"sort"
	"strings"
	"sync"
	"time"

	"go-distributed-llm/internal/metrics"
	"go-distributed-llm/shared/models"
	"go-distributed-llm/shared/ports"

	"github.com/google/uuid"
)

var (
	// ErrModelUnavailable được trả về khi không có Worker Node nào online/healthy hỗ trợ model yêu cầu.
	ErrModelUnavailable = errors.New("model unavailable")
	// ErrQueueFull được trả về ngay (< 1ms) khi độ dài hàng đợi vượt max_queue_depth để bảo vệ cụm.
	ErrQueueFull = errors.New("queue overloaded")
)

const defaultNodeCacheTTL = 2 * time.Second

// ChatInput chứa dữ liệu chuẩn hóa từ các HTTP handler (REST/SSE hoặc OpenAI /v1) trước khi đẩy vào hàng đợi.
type ChatInput struct {
	TraceID        string
	UserID         string
	ConversationID string
	Model          string
	Priority       string
	SystemPrompt   string
	Prompt         string
	Messages       []models.ChatTurn
	Temperature    *float64
	MaxTokens      *int
}

// EnqueuedJob đại diện cho job đã xếp hàng thành công, đi kèm TokenChan để handler đọc stream trả về client.
type EnqueuedJob struct {
	JobID          string
	TraceID        string
	ConversationID string
	StartedAt      time.Time
	TokenChan      <-chan models.TokenChunk
}

// ChatService đóng gói toàn bộ nghiệp vụ hội thoại, cache danh sách Worker (TTL 2s),
// kiểm soát độ sâu hàng đợi (fail-fast), multi-turn context và metric TTFT/TPS.
type ChatService struct {
	queue             ports.JobQueue
	pubsub            ports.EventBus
	registry          ports.NodeRegistry
	repo              ports.Repository
	sseHub            *SSEHub
	metrics           *metrics.GatewayMetrics
	advertiseGrpcAddr string
	advertiseHTTPAddr string
	maxQueueDepth     int
	log               *slog.Logger

	nodeCacheMu     sync.RWMutex
	cachedNodes     []models.WorkerNodeInfo
	nodeCacheExpiry time.Time
	nodeCacheTTL    time.Duration
}

// NewChatService khởi tạo ChatService đồng thời gắn callback đếm droppedTokens cho SSEHub.
func NewChatService(
	queue ports.JobQueue,
	pubsub ports.EventBus,
	registry ports.NodeRegistry,
	repo ports.Repository,
	sseHub *SSEHub,
	gatewayMetrics *metrics.GatewayMetrics,
	advertiseGrpcAddr string,
	advertiseHTTPAddr string,
	maxQueueDepth int,
	log *slog.Logger,
) *ChatService {
	if sseHub != nil && gatewayMetrics != nil {
		sseHub.SetDropObserver(gatewayMetrics.IncDroppedTokens)
	}
	return &ChatService{
		queue:             queue,
		pubsub:            pubsub,
		registry:          registry,
		repo:              repo,
		sseHub:            sseHub,
		metrics:           gatewayMetrics,
		advertiseGrpcAddr: advertiseGrpcAddr,
		advertiseHTTPAddr: advertiseHTTPAddr,
		maxQueueDepth:     maxQueueDepth,
		log:               log,
		nodeCacheTTL:      defaultNodeCacheTTL,
	}
}

// normalizePriority chuẩn hóa mức độ ưu tiên về 1 trong 3 giá trị hợp lệ (high/normal/low).
func normalizePriority(p string) string {
	switch strings.ToLower(strings.TrimSpace(p)) {
	case models.PriorityHigh:
		return models.PriorityHigh
	case models.PriorityLow:
		return models.PriorityLow
	default:
		return models.PriorityNormal
	}
}

// EnqueueChat kiểm tra model khả dụng, áp dụng Admission Control, lắp ghép ngữ cảnh hội thoại,
// mở kênh nhận token trên SSEHub rồi đẩy JobPayload vào Redis Stream.
func (s *ChatService) EnqueueChat(ctx context.Context, input ChatInput) (*EnqueuedJob, error) {
	// 1. Kiểm tra model khả dụng & chọn PreferredWorkerID cho KV-Cache Affinity (dùng RAM cache 2s).
	var preferredWorkerID string
	if s.registry != nil {
		workerID, err := s.resolveModelAndAffinity(ctx, input.Model, input.ConversationID)
		if err != nil {
			return nil, err
		}
		preferredWorkerID = workerID
	}

	// 2. Fail-fast Admission Control: chặn sớm nếu hàng đợi thực tế vượt max_queue_depth.
	if s.maxQueueDepth > 0 {
		qLen, err := s.queue.GetQueueLength(ctx, input.Model)
		if err == nil && qLen >= int64(s.maxQueueDepth) {
			return nil, fmt.Errorf("%w: model %q queue depth %d reached limit %d", ErrQueueFull, input.Model, qLen, s.maxQueueDepth)
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
	traceID := strings.TrimSpace(input.TraceID)
	if traceID == "" {
		traceID = uuid.New().String()
	}
	priority := normalizePriority(input.Priority)

	turns := s.buildConversationTurns(ctx, convID, input)
	lastUserPrompt := input.Prompt
	if lastUserPrompt == "" && len(turns) > 0 {
		lastUserPrompt = turns[len(turns)-1].Content
	}

	jobID := uuid.New().String()
	startedAt := time.Now()

	if s.repo != nil && lastUserPrompt != "" {
		_ = s.repo.SaveMessage(ctx, models.Message{
			ID:             uuid.New().String(),
			ConversationID: convID,
			JobID:          jobID,
			Role:           "user",
			Model:          input.Model,
			Content:        lastUserPrompt,
			CreatedAt:      startedAt,
		})
	}

	tokenCh := s.sseHub.Register(jobID)

	job := models.JobPayload{
		ID:                jobID,
		TraceID:           traceID,
		UserID:            userID,
		ConversationID:    convID,
		Model:             input.Model,
		Priority:          priority,
		PreferredWorkerID: preferredWorkerID,
		Prompt:            lastUserPrompt,
		Messages:          turns,
		Options: models.GenerationOptions{
			Temperature: input.Temperature,
			MaxTokens:   input.MaxTokens,
		},
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
		TraceID:        traceID,
		ConversationID: convID,
		StartedAt:      startedAt,
		TokenChan:      tokenCh,
	}, nil
}

// --- Cụm xây dựng Multi-turn Prompt & Định tuyến Node / KV-Cache Affinity ---

// buildConversationTurns lắp ghép SystemPrompt + tối đa 10 tin nhắn lịch sử + prompt hiện tại thành []ChatTurn.
func (s *ChatService) buildConversationTurns(ctx context.Context, convID string, input ChatInput) []models.ChatTurn {
	var turns []models.ChatTurn

	sysPrompt := strings.TrimSpace(input.SystemPrompt)
	if len(input.Messages) > 0 {
		if sysPrompt != "" && input.Messages[0].Role != "system" {
			turns = append(turns, models.ChatTurn{Role: "system", Content: sysPrompt})
		}
		turns = append(turns, input.Messages...)
		return turns
	}

	if sysPrompt != "" {
		turns = append(turns, models.ChatTurn{Role: "system", Content: sysPrompt})
	}
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
	return turns
}

// getCachedNodes đọc danh sách Worker Node từ RAM cache (2s TTL, double-check locking) để giảm tải Redis ở RPS cao.
func (s *ChatService) getCachedNodes(ctx context.Context) ([]models.WorkerNodeInfo, error) {
	now := time.Now()
	s.nodeCacheMu.RLock()
	if now.Before(s.nodeCacheExpiry) && s.cachedNodes != nil {
		nodes := s.cachedNodes
		s.nodeCacheMu.RUnlock()
		return nodes, nil
	}
	s.nodeCacheMu.RUnlock()

	s.nodeCacheMu.Lock()
	defer s.nodeCacheMu.Unlock()

	if time.Now().Before(s.nodeCacheExpiry) && s.cachedNodes != nil {
		return s.cachedNodes, nil
	}

	nodes, err := s.registry.GetOnlineNodes(ctx)
	if err != nil {
		return nil, err
	}
	s.cachedNodes = nodes
	s.nodeCacheExpiry = time.Now().Add(s.nodeCacheTTL)
	return nodes, nil
}

// resolveModelAndAffinity kiểm tra có ít nhất 1 Worker khỏe hỗ trợ model hay không;
// nếu có nhiều Worker và có conversationID, dùng FNV-1a hash chọn PreferredWorkerID còn slot để giữ KV-cache.
func (s *ChatService) resolveModelAndAffinity(ctx context.Context, model string, convID string) (string, error) {
	nodes, err := s.getCachedNodes(ctx)
	if err != nil {
		return "", err
	}

	var eligible []models.WorkerNodeInfo
	for _, n := range nodes {
		if n.Status == "DRAINING" || n.Status == "UNHEALTHY" {
			continue
		}
		for _, m := range n.SupportedModels {
			if m == model {
				eligible = append(eligible, n)
				break
			}
		}
	}

	if len(eligible) == 0 {
		return "", fmt.Errorf("%w: no active healthy worker serves model %q", ErrModelUnavailable, model)
	}

	if len(eligible) > 1 && convID != "" {
		sort.Slice(eligible, func(i, j int) bool {
			return eligible[i].WorkerID < eligible[j].WorkerID
		})
		h := fnv.New32a()
		_, _ = h.Write([]byte(convID))
		candidate := eligible[int(h.Sum32())%len(eligible)]
		if candidate.MaxSlots <= 0 || candidate.ActiveJobs < candidate.MaxSlots {
			return candidate.WorkerID, nil
		}
	}

	return "", nil
}

// --- Cụm điều phối Stream Token, Hủy Job & Lưu kết quả / Usage ---

// ReleaseJobStream gỡ subscriber của jobID khỏi SSEHub và đóng channel nhận token.
func (s *ChatService) ReleaseJobStream(jobID string) {
	s.sseHub.Unregister(jobID)
}

// PushToken bơm một mảnh TokenChunk từ Worker (gRPC/HTTP) vào đúng channel của client đang chờ.
func (s *ChatService) PushToken(chunk models.TokenChunk) {
	s.sseHub.PushToUser(chunk)
}

// RecordQueueWait cập nhật metric độ trễ chờ hàng đợi (từ lúc enqueue tới token đầu tiên).
func (s *ChatService) RecordQueueWait(model string, waitMs int64) {
	if s.metrics != nil {
		s.metrics.RecordQueueWait(model, waitMs)
	}
}

// CancelJob gửi yêu cầu hủy job thông qua Redis Pub/Sub với context từ request hiện tại.
func (s *ChatService) CancelJob(ctx context.Context, jobID string) error {
	return s.pubsub.PublishCancel(ctx, jobID)
}

// CancelJobDetached gửi yêu cầu hủy job bằng background context (2s timeout) khi client HTTP vừa đóng kết nối.
func (s *ChatService) CancelJobDetached(jobID string) {
	cancelCtx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	if err := s.pubsub.PublishCancel(cancelCtx, jobID); err != nil && s.log != nil {
		s.log.Warn("publish cancel on client disconnect failed", "job_id", jobID, "err", err)
	}
}

// ComputeTPS tính tốc độ sinh chữ (Tokens Per Second) làm tròn 2 chữ số thập phân.
func ComputeTPS(tokenCount int, durationMs int64) float64 {
	if tokenCount <= 0 || durationMs <= 0 {
		return 0
	}
	tps := float64(tokenCount) / (float64(durationMs) / 1000.0)
	return math.Round(tps*100) / 100
}

// SaveAssistantResult ghi lại metric Prometheus, câu trả lời của assistant và UsageLog (TTFT, TPS, token thật) vào DB.
func (s *ChatService) SaveAssistantResult(userID, convID, jobID, traceID, model, workerID, answer string, promptTokens, completionTokens int, ttftMs int64, durationMs int64) {
	tps := ComputeTPS(completionTokens, durationMs)
	if s.metrics != nil {
		s.metrics.RecordGeneration(model, workerID, promptTokens, completionTokens, ttftMs, durationMs)
	}
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
		JobID:            jobID,
		TraceID:          traceID,
		UserID:           userID,
		Model:            model,
		WorkerID:         workerID,
		PromptTokens:     promptTokens,
		CompletionTokens: completionTokens,
		TokenCount:       completionTokens,
		TTFTMs:           ttftMs,
		DurationMs:       durationMs,
		TokensPerSec:     tps,
		CreatedAt:        time.Now(),
	})
}

// GetHistory lấy lịch sử tin nhắn của một hội thoại từ kho lưu trữ.
func (s *ChatService) GetHistory(ctx context.Context, conversationID string, limit int) ([]models.Message, error) {
	if s.repo == nil {
		return []models.Message{}, nil
	}
	return s.repo.GetHistory(ctx, conversationID, limit)
}

// ListConversations liệt kê danh sách các cuộc hội thoại gần đây.
func (s *ChatService) ListConversations(ctx context.Context, userID string, limit int) ([]models.Conversation, error) {
	if s.repo == nil {
		return []models.Conversation{}, nil
	}
	return s.repo.ListConversations(ctx, userID, limit)
}
