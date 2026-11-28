package ports

import (
	"context"

	"go-distributed-llm/shared/models"
)

// LLMProvider là cổng giao tiếp với Local LLM Engine (Ollama, llama.cpp, vLLM...).
// Nhận danh sách lượt hội thoại cùng tham số suy luận và trả về Go Channel stream token.
type LLMProvider interface {
	GenerateStream(ctx context.Context, model string, messages []models.ChatTurn, opts models.GenerationOptions) (<-chan models.TokenChunk, error)
}

// HealthChecker cho phép Worker kiểm tra sức khỏe Local LLM Engine (Circuit Breaker probe).
type HealthChecker interface {
	CheckHealth(ctx context.Context) error
}

// ModelDiscoverer cho phép Worker tự động đồng bộ danh sách model hiện có trên máy trạm.
type ModelDiscoverer interface {
	ListModels(ctx context.Context) ([]string, error)
}

