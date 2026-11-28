package handlers

import (
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	"go-distributed-llm/internal/metrics"
	"go-distributed-llm/internal/services"
	"go-distributed-llm/shared/models"

	"github.com/gin-gonic/gin"
)

const (
	defaultFirstTokenTimeout = 30 * time.Second
	defaultKeepaliveInterval = 10 * time.Second
)

// ChatHandler là tầng HTTP mỏng lo bind request, gọi ChatService và đo TTFT/TPS + TraceID.
type ChatHandler struct {
	chat              *services.ChatService
	metrics           *metrics.GatewayMetrics
	firstTokenTimeout time.Duration
	keepaliveInterval time.Duration
}

// NewChatHandler khởi tạo HTTP handler cho các endpoint chat nội bộ (/api/v1/chat/*).
func NewChatHandler(chat *services.ChatService, m *metrics.GatewayMetrics) *ChatHandler {
	return &ChatHandler{
		chat:              chat,
		metrics:           m,
		firstTokenTimeout: defaultFirstTokenTimeout,
		keepaliveInterval: defaultKeepaliveInterval,
	}
}

// chatRequest là payload JSON đầu vào từ Web/API client cho luồng chat đồng bộ hoặc SSE.
type chatRequest struct {
	UserID         string   `json:"user_id"`
	ConversationID string   `json:"conversation_id"`
	Model          string   `json:"model" binding:"required"`
	Priority       string   `json:"priority"`
	SystemPrompt   string   `json:"system_prompt"`
	Prompt         string   `json:"prompt" binding:"required"`
	Temperature    *float64 `json:"temperature"`
	MaxTokens      *int     `json:"max_tokens"`
}

// --- Cụm helper dùng chung cho cả ChatHandler và OpenAIHandler ---

// extractTraceID lấy TraceID từ header X-Trace-Id hoặc X-Request-Id (nếu không có, ChatService sẽ tự sinh UUID).
func extractTraceID(c *gin.Context) string {
	if tid := strings.TrimSpace(c.GetHeader("X-Trace-Id")); tid != "" {
		return tid
	}
	return strings.TrimSpace(c.GetHeader("X-Request-Id"))
}

// classifyEnqueueError ánh xạ lỗi nội bộ lúc enqueue (model offline, queue đầy) sang HTTP Status Code phù hợp.
func classifyEnqueueError(err error) (status int, errType string, retryAfter string) {
	if errors.Is(err, services.ErrModelUnavailable) {
		return http.StatusServiceUnavailable, "model_not_found", ""
	}
	if errors.Is(err, services.ErrQueueFull) {
		return http.StatusTooManyRequests, "rate_limit_error", "5"
	}
	return http.StatusInternalServerError, "server_error", ""
}

// streamStats gom toàn bộ nội dung trả lời và bộ đếm token/TTFT trong suốt vòng đời một job stream.
type streamStats struct {
	answer           strings.Builder
	streamedUnits    int
	promptTokens     int
	completionTokens int
	lastWorkerID     string
	ttftMs           int64
}

// consume cộng dồn từng TokenChunk nhận được từ Worker vào streamStats.
func (s *streamStats) consume(chunk models.TokenChunk) {
	if chunk.Token != "" {
		s.answer.WriteString(chunk.Token)
		units := chunk.TokenUnits
		if units <= 0 {
			units = 1
		}
		s.streamedUnits += units
	}
	if chunk.WorkerID != "" {
		s.lastWorkerID = chunk.WorkerID
	}
	if chunk.PromptTokens > 0 {
		s.promptTokens = chunk.PromptTokens
	}
	if chunk.CompletionTokens > 0 {
		s.completionTokens = chunk.CompletionTokens
	}
}

// effectiveCompletionTokens ưu tiên trả về số token thật do LLM Engine báo cáo; fallback sang số chunk đã stream.
func (s *streamStats) effectiveCompletionTokens() int {
	if s.completionTokens > 0 {
		return s.completionTokens
	}
	return s.streamedUnits
}

// recordReq ghi nhận bộ đếm Prometheus cho request chat theo endpoint và HTTP status.
func (h *ChatHandler) recordReq(endpoint string, status int) {
	if h.metrics != nil {
		h.metrics.RecordRequest(endpoint, status)
	}
}

// --- Cụm Endpoint Streaming (SSE), Sync Chat, Stop & Lịch sử hội thoại ---

// StreamChat mở kết nối SSE, đẩy job vào Redis Stream và stream từng token về client kèm keepalive & first-token timeout.
func (h *ChatHandler) StreamChat(c *gin.Context) {
	var req chatRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		h.recordReq("/api/v1/chat/stream", http.StatusBadRequest)
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	enqueued, err := h.chat.EnqueueChat(c.Request.Context(), services.ChatInput{
		TraceID:        extractTraceID(c),
		UserID:         req.UserID,
		ConversationID: req.ConversationID,
		Model:          req.Model,
		Priority:       req.Priority,
		SystemPrompt:   req.SystemPrompt,
		Prompt:         req.Prompt,
		Temperature:    req.Temperature,
		MaxTokens:      req.MaxTokens,
	})
	if err != nil {
		status, _, retryAfter := classifyEnqueueError(err)
		h.recordReq("/api/v1/chat/stream", status)
		if retryAfter != "" {
			c.Header("Retry-After", retryAfter)
		}
		msg := err.Error()
		if status == http.StatusInternalServerError {
			msg = "failed to enqueue job: " + msg
		}
		c.JSON(status, gin.H{"error": msg})
		return
	}
	defer h.chat.ReleaseJobStream(enqueued.JobID)

	if h.metrics != nil {
		h.metrics.IncActiveStreams()
		defer h.metrics.DecActiveStreams()
	}

	c.Writer.Header().Set("Content-Type", "text/event-stream")
	c.Writer.Header().Set("Cache-Control", "no-cache")
	c.Writer.Header().Set("Connection", "keep-alive")
	c.Writer.Header().Set("X-Job-Id", enqueued.JobID)
	c.Writer.Header().Set("X-Conversation-Id", enqueued.ConversationID)
	c.Writer.Header().Set("X-Trace-Id", enqueued.TraceID)
	c.Writer.WriteHeader(http.StatusOK)
	c.Writer.Flush()
	h.recordReq("/api/v1/chat/stream", http.StatusOK)

	clientGone := c.Request.Context().Done()
	firstTokenTimer := time.NewTimer(h.firstTokenTimeout)
	defer firstTokenTimer.Stop()
	keepaliveTicker := time.NewTicker(h.keepaliveInterval)
	defer keepaliveTicker.Stop()
	gotFirstChunk := false

	var stats streamStats

	for {
		var timeoutCh <-chan time.Time
		if !gotFirstChunk {
			timeoutCh = firstTokenTimer.C
		}

		select {
		case <-clientGone:
			h.chat.CancelJobDetached(enqueued.JobID)
			return

		case <-keepaliveTicker.C:
			_, _ = fmt.Fprint(c.Writer, ": keepalive\n\n")
			c.Writer.Flush()

		case <-timeoutCh:
			h.chat.CancelJobDetached(enqueued.JobID)
			c.SSEvent("error", gin.H{
				"job_id":   enqueued.JobID,
				"trace_id": enqueued.TraceID,
				"error":    "queue timeout waiting for worker response",
			})
			c.Writer.Flush()
			return

		case chunk, ok := <-enqueued.TokenChan:
			if !gotFirstChunk {
				gotFirstChunk = true
				firstTokenTimer.Stop()
				stats.ttftMs = time.Since(enqueued.StartedAt).Milliseconds()
				h.chat.RecordQueueWait(req.Model, stats.ttftMs)
			}
			if !ok {
				return
			}
			if chunk.Error != "" {
				c.SSEvent("error", gin.H{"job_id": enqueued.JobID, "trace_id": enqueued.TraceID, "error": chunk.Error})
				c.Writer.Flush()
				return
			}

			stats.consume(chunk)
			compTokens := stats.effectiveCompletionTokens()
			durationMs := time.Since(enqueued.StartedAt).Milliseconds()
			tps := services.ComputeTPS(compTokens, durationMs)

			payload := gin.H{
				"job_id":          enqueued.JobID,
				"trace_id":        enqueued.TraceID,
				"conversation_id": enqueued.ConversationID,
				"worker_id":       chunk.WorkerID,
				"token":           chunk.Token,
				"done":            chunk.Done,
			}
			if chunk.Done {
				payload["ttft_ms"] = stats.ttftMs
				payload["duration_ms"] = durationMs
				payload["token_count"] = compTokens
				payload["prompt_tokens"] = stats.promptTokens
				payload["completion_tokens"] = compTokens
				payload["tokens_per_sec"] = tps
			}

			c.SSEvent("message", payload)
			c.Writer.Flush()

			if chunk.Done {
				h.chat.SaveAssistantResult(req.UserID, enqueued.ConversationID, enqueued.JobID, enqueued.TraceID, req.Model, stats.lastWorkerID, stats.answer.String(), stats.promptTokens, compTokens, stats.ttftMs, durationMs)
				return
			}
		}
	}
}

// ChatSync tiếp nhận prompt, chờ Worker sinh đủ câu trả lời rồi trả JSON 1 lần (non-streaming).
func (h *ChatHandler) ChatSync(c *gin.Context) {
	var req chatRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		h.recordReq("/api/v1/chat", http.StatusBadRequest)
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	enqueued, err := h.chat.EnqueueChat(c.Request.Context(), services.ChatInput{
		TraceID:        extractTraceID(c),
		UserID:         req.UserID,
		ConversationID: req.ConversationID,
		Model:          req.Model,
		Priority:       req.Priority,
		SystemPrompt:   req.SystemPrompt,
		Prompt:         req.Prompt,
		Temperature:    req.Temperature,
		MaxTokens:      req.MaxTokens,
	})
	if err != nil {
		status, _, retryAfter := classifyEnqueueError(err)
		h.recordReq("/api/v1/chat", status)
		if retryAfter != "" {
			c.Header("Retry-After", retryAfter)
		}
		msg := err.Error()
		if status == http.StatusInternalServerError {
			msg = "failed to enqueue job: " + msg
		}
		c.JSON(status, gin.H{"error": msg})
		return
	}
	defer h.chat.ReleaseJobStream(enqueued.JobID)
	c.Header("X-Trace-Id", enqueued.TraceID)

	clientGone := c.Request.Context().Done()
	firstTokenTimer := time.NewTimer(h.firstTokenTimeout)
	defer firstTokenTimer.Stop()
	gotFirstChunk := false

	var stats streamStats

	respondOK := func() {
		dur := time.Since(enqueued.StartedAt).Milliseconds()
		compTokens := stats.effectiveCompletionTokens()
		tps := services.ComputeTPS(compTokens, dur)
		h.recordReq("/api/v1/chat", http.StatusOK)
		c.JSON(http.StatusOK, gin.H{
			"job_id":            enqueued.JobID,
			"trace_id":          enqueued.TraceID,
			"conversation_id":   enqueued.ConversationID,
			"worker_id":         stats.lastWorkerID,
			"model":             req.Model,
			"answer":            stats.answer.String(),
			"token_count":       compTokens,
			"prompt_tokens":     stats.promptTokens,
			"completion_tokens": compTokens,
			"ttft_ms":           stats.ttftMs,
			"duration_ms":       dur,
			"tokens_per_sec":    tps,
		})
	}

	for {
		var timeoutCh <-chan time.Time
		if !gotFirstChunk {
			timeoutCh = firstTokenTimer.C
		}

		select {
		case <-clientGone:
			h.chat.CancelJobDetached(enqueued.JobID)
			return

		case <-timeoutCh:
			h.chat.CancelJobDetached(enqueued.JobID)
			h.recordReq("/api/v1/chat", http.StatusGatewayTimeout)
			c.JSON(http.StatusGatewayTimeout, gin.H{
				"job_id":   enqueued.JobID,
				"trace_id": enqueued.TraceID,
				"error":    "queue timeout waiting for worker response",
			})
			return

		case chunk, ok := <-enqueued.TokenChan:
			if !gotFirstChunk {
				gotFirstChunk = true
				firstTokenTimer.Stop()
				stats.ttftMs = time.Since(enqueued.StartedAt).Milliseconds()
				h.chat.RecordQueueWait(req.Model, stats.ttftMs)
			}
			if !ok {
				respondOK()
				return
			}
			if chunk.Error != "" {
				h.recordReq("/api/v1/chat", http.StatusBadGateway)
				c.JSON(http.StatusBadGateway, gin.H{"job_id": enqueued.JobID, "trace_id": enqueued.TraceID, "error": chunk.Error})
				return
			}
			stats.consume(chunk)
			if chunk.Done {
				dur := time.Since(enqueued.StartedAt).Milliseconds()
				compTokens := stats.effectiveCompletionTokens()
				h.chat.SaveAssistantResult(req.UserID, enqueued.ConversationID, enqueued.JobID, enqueued.TraceID, req.Model, stats.lastWorkerID, stats.answer.String(), stats.promptTokens, compTokens, stats.ttftMs, dur)
				respondOK()
				return
			}
		}
	}
}

// StopJob gửi tín hiệu hủy khẩn cấp jobID qua Redis Pub/Sub để Worker giải phóng GPU ngay.
func (h *ChatHandler) StopJob(c *gin.Context) {
	jobID := c.Param("id")
	if err := h.chat.CancelJob(c.Request.Context(), jobID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "cancel_signal_sent", "job_id": jobID})
}

// GetHistory trả về tối đa 50 tin nhắn gần nhất của một phiên hội thoại.
func (h *ChatHandler) GetHistory(c *gin.Context) {
	convID := c.Param("conversation_id")
	msgs, err := h.chat.GetHistory(c.Request.Context(), convID, 50)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"conversation_id": convID, "messages": msgs})
}

// ListConversations liệt kê các cuộc hội thoại gần đây để hiển thị trên thanh bên UI.
func (h *ChatHandler) ListConversations(c *gin.Context) {
	userID := c.Query("user_id")
	convs, err := h.chat.ListConversations(c.Request.Context(), userID, 30)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"conversations": convs})
}
