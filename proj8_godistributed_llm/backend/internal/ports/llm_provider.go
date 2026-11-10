package ports

import (
	"context"

	"go-distributed-llm/internal/models"
)

// LLMProvider là cổng giao tiếp với Local LLM Engine (Ollama, llama.cpp, vLLM...).
// Nhận danh sách lượt hội thoại (Multi-turn) và trả về Go Channel chỉ đọc (<-chan) để stream token.
type LLMProvider interface {
	GenerateStream(ctx context.Context, model string, messages []models.ChatTurn) (<-chan models.TokenChunk, error)
}
