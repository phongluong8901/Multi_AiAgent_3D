package handlers

import (
	"bufio"
	"encoding/json"
	"net/http"

	"go-distributed-llm/internal/services"
	"go-distributed-llm/shared/models"

	"github.com/gin-gonic/gin"
)

// InternalHandler nhận token từ Worker/service nội bộ qua HTTP (khi không dùng gRPC).
type InternalHandler struct {
	chat *services.ChatService
}

func NewInternalHandler(chat *services.ChatService) *InternalHandler {
	return &InternalHandler{chat: chat}
}

func (h *InternalHandler) PushTokensHTTP(c *gin.Context) {
	scanner := bufio.NewScanner(c.Request.Body)
	scanner.Buffer(make([]byte, 0, 64*1024), 1024*1024)

	for scanner.Scan() {
		if c.Request.Context().Err() != nil {
			return
		}
		line := scanner.Bytes()
		if len(line) == 0 {
			continue
		}

		var chunk models.TokenChunk
		if err := json.Unmarshal(line, &chunk); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid token chunk json: " + err.Error()})
			return
		}
		h.chat.PushToken(chunk)
	}

	if err := scanner.Err(); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "stream read error: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"acknowledged": true})
}

func (h *InternalHandler) PushTokenHTTP(c *gin.Context) {
	var chunk models.TokenChunk
	if err := c.ShouldBindJSON(&chunk); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if chunk.JobID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "job_id is required"})
		return
	}
	h.chat.PushToken(chunk)
	c.JSON(http.StatusOK, gin.H{"acknowledged": true})
}

