package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"go-distributed-llm/internal/metrics"
	"go-distributed-llm/internal/services"
	"go-distributed-llm/shared/models"

	"github.com/gin-gonic/gin"
)

// OpenAIHandler cung cấp endpoint chuẩn OpenAI (/v1/chat/completions, /v1/models)
// để mọi OpenAI SDK, LangChain, LlamaIndex, Continue.dev kết nối trực tiếp vào cụm Go LLM.
type OpenAIHandler struct {
	chat              *services.ChatService
	admin             *services.AdminService
	metrics           *metrics.GatewayMetrics
	firstTokenTimeout time.Duration
}

func NewOpenAIHandler(chat *services.ChatService, admin *services.AdminService, m *metrics.GatewayMetrics) *OpenAIHandler {
	return &OpenAIHandler{
		chat:              chat,
		admin:             admin,
		metrics:           m,
		firstTokenTimeout: defaultFirstTokenTimeout,
	}
}

type openAICompletionRequest struct {
	Model          string            `json:"model" binding:"required"`
	Messages       []models.ChatTurn `json:"messages" binding:"required,min=1"`
	Stream         bool              `json:"stream"`
	Temperature    *float64          `json:"temperature"`
	MaxTokens      *int              `json:"max_tokens"`
	User           string            `json:"user"`
	ConversationID string            `json:"conversation_id"`
	Priority       string            `json:"priority"`
}

func (h *OpenAIHandler) ListModels(c *gin.Context) {
	nodes, err := h.admin.ListOnlineNodes(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": gin.H{"message": err.Error()}})
		return
	}

	seen := make(map[string]bool)
	var data []gin.H
	now := time.Now().Unix()
	for _, n := range nodes {
		if n.Status == "DRAINING" || n.Status == "UNHEALTHY" {
			continue
		}
		for _, m := range n.SupportedModels {
			if seen[m] {
				continue
			}
			seen[m] = true
			data = append(data, gin.H{
				"id":       m,
				"object":   "model",
				"created":  now,
				"owned_by": "go-distributed-llm",
			})
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"object": "list",
		"data":   data,
	})
}

func (h *OpenAIHandler) ChatCompletions(c *gin.Context) {
	var req openAICompletionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		h.recordReq(http.StatusBadRequest)
		c.JSON(http.StatusBadRequest, gin.H{"error": gin.H{"message": err.Error(), "type": "invalid_request_error"}})
		return
	}

	enqueued, err := h.chat.EnqueueChat(c.Request.Context(), services.ChatInput{
		TraceID:        extractTraceID(c),
		UserID:         req.User,
		ConversationID: req.ConversationID,
		Model:          req.Model,
		Priority:       req.Priority,
		Messages:       req.Messages,
		Temperature:    req.Temperature,
		MaxTokens:      req.MaxTokens,
	})
	if err != nil {
		status, errType, retryAfter := classifyEnqueueError(err)
		h.recordReq(status)
		if retryAfter != "" {
			c.Header("Retry-After", retryAfter)
		}
		c.JSON(status, gin.H{"error": gin.H{"message": err.Error(), "type": errType}})
		return
	}
	defer h.chat.ReleaseJobStream(enqueued.JobID)

	completionID := "chatcmpl-" + enqueued.JobID
	createdUnix := enqueued.StartedAt.Unix()

	if req.Stream {
		h.handleOpenAIStream(c, req, enqueued, completionID, createdUnix)
		return
	}
	h.handleOpenAISync(c, req, enqueued, completionID, createdUnix)
}

func (h *OpenAIHandler) handleOpenAIStream(c *gin.Context, req openAICompletionRequest, enqueued *services.EnqueuedJob, completionID string, createdUnix int64) {
	if h.metrics != nil {
		h.metrics.IncActiveStreams()
		defer h.metrics.DecActiveStreams()
	}

	c.Writer.Header().Set("Content-Type", "text/event-stream")
	c.Writer.Header().Set("Cache-Control", "no-cache")
	c.Writer.Header().Set("Connection", "keep-alive")
	c.Writer.Header().Set("X-Job-Id", enqueued.JobID)
	c.Writer.Header().Set("X-Trace-Id", enqueued.TraceID)
	c.Writer.WriteHeader(http.StatusOK)
	c.Writer.Flush()
	h.recordReq(http.StatusOK)

	clientGone := c.Request.Context().Done()
	firstTokenTimer := time.NewTimer(h.firstTokenTimeout)
	defer firstTokenTimer.Stop()
	keepaliveTicker := time.NewTicker(defaultKeepaliveInterval)
	defer keepaliveTicker.Stop()
	gotFirstChunk := false

	var stats streamStats

	writeSSEJSON := func(v any) {
		b, _ := json.Marshal(v)
		_, _ = fmt.Fprintf(c.Writer, "data: %s\n\n", b)
		c.Writer.Flush()
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

		case <-keepaliveTicker.C:
			_, _ = fmt.Fprint(c.Writer, ": keepalive\n\n")
			c.Writer.Flush()

		case <-timeoutCh:
			h.chat.CancelJobDetached(enqueued.JobID)
			writeSSEJSON(gin.H{"error": gin.H{"message": "queue timeout waiting for worker response"}})
			_, _ = fmt.Fprint(c.Writer, "data: [DONE]\n\n")
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
				_, _ = fmt.Fprint(c.Writer, "data: [DONE]\n\n")
				c.Writer.Flush()
				return
			}
			if chunk.Error != "" {
				writeSSEJSON(gin.H{"error": gin.H{"message": chunk.Error}})
				_, _ = fmt.Fprint(c.Writer, "data: [DONE]\n\n")
				c.Writer.Flush()
				return
			}
			stats.consume(chunk)
			if chunk.Token != "" {
				writeSSEJSON(gin.H{
					"id":      completionID,
					"object":  "chat.completion.chunk",
					"created": createdUnix,
					"model":   req.Model,
					"choices": []gin.H{
						{
							"index":         0,
							"delta":         gin.H{"content": chunk.Token},
							"finish_reason": nil,
						},
					},
				})
			}

			if chunk.Done {
				dur := time.Since(enqueued.StartedAt).Milliseconds()
				compTokens := stats.effectiveCompletionTokens()
				h.chat.SaveAssistantResult(req.User, enqueued.ConversationID, enqueued.JobID, enqueued.TraceID, req.Model, stats.lastWorkerID, stats.answer.String(), stats.promptTokens, compTokens, stats.ttftMs, dur)
				writeSSEJSON(gin.H{
					"id":      completionID,
					"object":  "chat.completion.chunk",
					"created": createdUnix,
					"model":   req.Model,
					"choices": []gin.H{
						{
							"index":         0,
							"delta":         gin.H{},
							"finish_reason": "stop",
						},
					},
					"usage": gin.H{
						"prompt_tokens":     stats.promptTokens,
						"completion_tokens": compTokens,
						"total_tokens":      stats.promptTokens + compTokens,
					},
				})
				_, _ = fmt.Fprint(c.Writer, "data: [DONE]\n\n")
				c.Writer.Flush()
				return
			}
		}
	}
}

func (h *OpenAIHandler) handleOpenAISync(c *gin.Context, req openAICompletionRequest, enqueued *services.EnqueuedJob, completionID string, createdUnix int64) {
	c.Header("X-Trace-Id", enqueued.TraceID)
	clientGone := c.Request.Context().Done()
	firstTokenTimer := time.NewTimer(h.firstTokenTimeout)
	defer firstTokenTimer.Stop()
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

		case <-timeoutCh:
			h.chat.CancelJobDetached(enqueued.JobID)
			h.recordReq(http.StatusGatewayTimeout)
			c.JSON(http.StatusGatewayTimeout, gin.H{"error": gin.H{"message": "queue timeout waiting for worker response"}})
			return

		case chunk, ok := <-enqueued.TokenChan:
			if !gotFirstChunk {
				gotFirstChunk = true
				firstTokenTimer.Stop()
				stats.ttftMs = time.Since(enqueued.StartedAt).Milliseconds()
				h.chat.RecordQueueWait(req.Model, stats.ttftMs)
			}
			if !ok {
				h.respondOpenAISync(c, req.Model, completionID, createdUnix, stats.answer.String(), stats.promptTokens, stats.effectiveCompletionTokens())
				return
			}
			if chunk.Error != "" {
				h.recordReq(http.StatusBadGateway)
				c.JSON(http.StatusBadGateway, gin.H{"error": gin.H{"message": chunk.Error}})
				return
			}
			stats.consume(chunk)
			if chunk.Done {
				dur := time.Since(enqueued.StartedAt).Milliseconds()
				compTokens := stats.effectiveCompletionTokens()
				h.chat.SaveAssistantResult(req.User, enqueued.ConversationID, enqueued.JobID, enqueued.TraceID, req.Model, stats.lastWorkerID, stats.answer.String(), stats.promptTokens, compTokens, stats.ttftMs, dur)
				h.respondOpenAISync(c, req.Model, completionID, createdUnix, stats.answer.String(), stats.promptTokens, compTokens)
				return
			}
		}
	}
}

func (h *OpenAIHandler) respondOpenAISync(c *gin.Context, model, completionID string, createdUnix int64, answer string, promptTokens, compTokens int) {
	h.recordReq(http.StatusOK)
	c.JSON(http.StatusOK, gin.H{
		"id":      completionID,
		"object":  "chat.completion",
		"created": createdUnix,
		"model":   model,
		"choices": []gin.H{
			{
				"index": 0,
				"message": gin.H{
					"role":    "assistant",
					"content": answer,
				},
				"finish_reason": "stop",
			},
		},
		"usage": gin.H{
			"prompt_tokens":     promptTokens,
			"completion_tokens": compTokens,
			"total_tokens":      promptTokens + compTokens,
		},
	})
}

func (h *OpenAIHandler) recordReq(status int) {
	if h.metrics != nil {
		h.metrics.RecordRequest("/v1/chat/completions", status)
	}
}

