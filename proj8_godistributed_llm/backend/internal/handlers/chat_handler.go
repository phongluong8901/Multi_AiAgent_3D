package handlers

import (
	"errors"
	"net/http"
	"strings"
	"time"

	"go-distributed-llm/internal/services"

	"github.com/gin-gonic/gin"
)

const defaultFirstTokenTimeout = 30 * time.Second

// ChatHandler là tầng HTTP mỏng chỉ lo bind request, gọi ChatService và ghi SSE/JSON response.
type ChatHandler struct {
	chat              *services.ChatService
	firstTokenTimeout time.Duration
}

func NewChatHandler(chat *services.ChatService) *ChatHandler {
	return &ChatHandler{
		chat:              chat,
		firstTokenTimeout: defaultFirstTokenTimeout,
	}
}

type chatRequest struct {
	UserID         string `json:"user_id"`
	ConversationID string `json:"conversation_id"`
	Model          string `json:"model" binding:"required"`
	Prompt         string `json:"prompt" binding:"required"`
}

func (h *ChatHandler) StreamChat(c *gin.Context) {
	var req chatRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	enqueued, err := h.chat.EnqueueChat(c.Request.Context(), services.ChatInput{
		UserID:         req.UserID,
		ConversationID: req.ConversationID,
		Model:          req.Model,
		Prompt:         req.Prompt,
	})
	if err != nil {
		if errors.Is(err, services.ErrModelUnavailable) {
			c.JSON(http.StatusServiceUnavailable, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to enqueue job: " + err.Error()})
		return
	}
	defer h.chat.ReleaseJobStream(enqueued.JobID)

	c.Writer.Header().Set("Content-Type", "text/event-stream")
	c.Writer.Header().Set("Cache-Control", "no-cache")
	c.Writer.Header().Set("Connection", "keep-alive")
	c.Writer.Header().Set("X-Job-Id", enqueued.JobID)
	c.Writer.Header().Set("X-Conversation-Id", enqueued.ConversationID)
	c.Writer.WriteHeader(http.StatusOK)
	c.Writer.Flush()

	clientGone := c.Request.Context().Done()
	firstTokenTimer := time.NewTimer(h.firstTokenTimeout)
	defer firstTokenTimer.Stop()
	gotFirstChunk := false

	var fullAnswer strings.Builder
	var tokenCount int
	var lastWorkerID string

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
			c.SSEvent("error", gin.H{
				"job_id": enqueued.JobID,
				"error":  "queue timeout waiting for worker response",
			})
			c.Writer.Flush()
			return

		case chunk, ok := <-enqueued.TokenChan:
			if !gotFirstChunk {
				gotFirstChunk = true
				firstTokenTimer.Stop()
			}
			if !ok {
				return
			}
			if chunk.Error != "" {
				c.SSEvent("error", gin.H{"job_id": enqueued.JobID, "error": chunk.Error})
				c.Writer.Flush()
				return
			}

			if chunk.Token != "" {
				fullAnswer.WriteString(chunk.Token)
				tokenCount++
			}
			if chunk.WorkerID != "" {
				lastWorkerID = chunk.WorkerID
			}

			c.SSEvent("message", gin.H{
				"job_id":          enqueued.JobID,
				"conversation_id": enqueued.ConversationID,
				"worker_id":       chunk.WorkerID,
				"token":           chunk.Token,
				"done":            chunk.Done,
			})
			c.Writer.Flush()

			if chunk.Done {
				h.chat.SaveAssistantResult(req.UserID, enqueued.ConversationID, enqueued.JobID, req.Model, lastWorkerID, fullAnswer.String(), tokenCount, enqueued.StartedAt)
				return
			}
		}
	}
}

func (h *ChatHandler) ChatSync(c *gin.Context) {
	var req chatRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	enqueued, err := h.chat.EnqueueChat(c.Request.Context(), services.ChatInput{
		UserID:         req.UserID,
		ConversationID: req.ConversationID,
		Model:          req.Model,
		Prompt:         req.Prompt,
	})
	if err != nil {
		if errors.Is(err, services.ErrModelUnavailable) {
			c.JSON(http.StatusServiceUnavailable, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to enqueue job: " + err.Error()})
		return
	}
	defer h.chat.ReleaseJobStream(enqueued.JobID)

	clientGone := c.Request.Context().Done()
	firstTokenTimer := time.NewTimer(h.firstTokenTimeout)
	defer firstTokenTimer.Stop()
	gotFirstChunk := false

	var fullAnswer strings.Builder
	var tokenCount int
	var lastWorkerID string

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
			c.JSON(http.StatusGatewayTimeout, gin.H{
				"job_id": enqueued.JobID,
				"error":  "queue timeout waiting for worker response",
			})
			return

		case chunk, ok := <-enqueued.TokenChan:
			if !gotFirstChunk {
				gotFirstChunk = true
				firstTokenTimer.Stop()
			}
			if !ok {
				c.JSON(http.StatusOK, gin.H{
					"job_id":          enqueued.JobID,
					"conversation_id": enqueued.ConversationID,
					"worker_id":       lastWorkerID,
					"model":           req.Model,
					"answer":          fullAnswer.String(),
					"token_count":     tokenCount,
					"duration_ms":     time.Since(enqueued.StartedAt).Milliseconds(),
				})
				return
			}
			if chunk.Error != "" {
				c.JSON(http.StatusBadGateway, gin.H{"job_id": enqueued.JobID, "error": chunk.Error})
				return
			}
			if chunk.Token != "" {
				fullAnswer.WriteString(chunk.Token)
				tokenCount++
			}
			if chunk.WorkerID != "" {
				lastWorkerID = chunk.WorkerID
			}
			if chunk.Done {
				h.chat.SaveAssistantResult(req.UserID, enqueued.ConversationID, enqueued.JobID, req.Model, lastWorkerID, fullAnswer.String(), tokenCount, enqueued.StartedAt)
				c.JSON(http.StatusOK, gin.H{
					"job_id":          enqueued.JobID,
					"conversation_id": enqueued.ConversationID,
					"worker_id":       lastWorkerID,
					"model":           req.Model,
					"answer":          fullAnswer.String(),
					"token_count":     tokenCount,
					"duration_ms":     time.Since(enqueued.StartedAt).Milliseconds(),
				})
				return
			}
		}
	}
}

func (h *ChatHandler) StopJob(c *gin.Context) {
	jobID := c.Param("id")
	if err := h.chat.CancelJob(c.Request.Context(), jobID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "cancel_signal_sent", "job_id": jobID})
}

func (h *ChatHandler) GetHistory(c *gin.Context) {
	convID := c.Param("conversation_id")
	msgs, err := h.chat.GetHistory(c.Request.Context(), convID, 50)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"conversation_id": convID, "messages": msgs})
}
