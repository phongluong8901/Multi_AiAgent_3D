package llmclient

import (
	"fmt"
	"strings"
	"time"

	"go-distributed-llm/internal/ports"
)

// NewLLMProvider là Factory khởi tạo adapter LLM dựa theo cấu hình:
// - "ollama": Ollama (/api/generate)
// - "llamacpp": llama.cpp server (/completion)
// - "vllm" | "openai" | "lmstudio" | "sglang": OpenAI-compatible (/v1/chat/completions)
func NewLLMProvider(provider string, baseURL string, timeout time.Duration) (ports.LLMProvider, error) {
	if timeout <= 0 {
		timeout = 120 * time.Second
	}

	switch strings.ToLower(strings.TrimSpace(provider)) {
	case "", "ollama":
		return NewOllamaAdapter(baseURL, timeout), nil
	case "llamacpp", "llama.cpp":
		return NewLlamaCppAdapter(baseURL, timeout), nil
	case "vllm", "openai", "lmstudio", "sglang":
		return NewOpenAIAdapter(baseURL, timeout), nil
	default:
		return nil, fmt.Errorf("unsupported llm provider: %s (expected 'ollama', 'llamacpp', or 'vllm')", provider)
	}
}
