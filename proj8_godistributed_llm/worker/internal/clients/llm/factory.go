package llmclient

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"go-distributed-llm/shared/ports"
)

// NewLLMProvider là Factory khởi tạo adapter LLM dựa theo cấu hình:
// - "ollama": Ollama (/api/chat)
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

func doStreamPost(ctx context.Context, client *http.Client, endpoint string, providerLabel string, payload any) (*http.Response, error) {
	bodyBytes, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(bodyBytes))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode != http.StatusOK {
		errBody, _ := io.ReadAll(io.LimitReader(resp.Body, 1024))
		resp.Body.Close()
		detail := strings.TrimSpace(string(errBody))
		if detail != "" {
			return nil, fmt.Errorf("%s returned HTTP %d: %s", providerLabel, resp.StatusCode, detail)
		}
		return nil, fmt.Errorf("%s returned HTTP %d", providerLabel, resp.StatusCode)
	}
	return resp, nil
}

func doJSONGet(ctx context.Context, client *http.Client, endpoint string, providerLabel string, out any) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return err
	}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		errBody, _ := io.ReadAll(io.LimitReader(resp.Body, 512))
		detail := strings.TrimSpace(string(errBody))
		if detail != "" {
			return fmt.Errorf("%s health/discovery HTTP %d: %s", providerLabel, resp.StatusCode, detail)
		}
		return fmt.Errorf("%s health/discovery HTTP %d", providerLabel, resp.StatusCode)
	}
	if out == nil {
		return nil
	}
	return json.NewDecoder(io.LimitReader(resp.Body, 2*1024*1024)).Decode(out)
}

