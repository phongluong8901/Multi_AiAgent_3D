package llmclient

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"go-distributed-llm/shared/models"
)

// OpenAIAdapter giao tiếp với các Local LLM Engine hỗ trợ OpenAI-compatible SSE API
// như vLLM, SGLang, LM Studio, hoặc llama.cpp server (/v1/chat/completions, /v1/models).
type OpenAIAdapter struct {
	baseURL    string
	httpClient *http.Client
}

// NewOpenAIAdapter khởi tạo adapter cho vLLM, SGLang, LM Studio hoặc các server tương thích OpenAI API.
func NewOpenAIAdapter(baseURL string, timeout time.Duration) *OpenAIAdapter {
	return &OpenAIAdapter{
		baseURL: strings.TrimRight(baseURL, "/"),
		httpClient: &http.Client{
			Timeout: timeout,
		},
	}
}

// openAIStreamOptions yêu cầu engine trả kèm thống kê usage trong SSE chunk cuối cùng.
type openAIStreamOptions struct {
	IncludeUsage bool `json:"include_usage"`
}

// openAIChatRequest ánh xạ JSON payload gửi tới POST /v1/chat/completions của LLM Engine.
type openAIChatRequest struct {
	Model         string               `json:"model"`
	Messages      []models.ChatTurn    `json:"messages"`
	Stream        bool                 `json:"stream"`
	StreamOptions *openAIStreamOptions `json:"stream_options,omitempty"`
	Temperature   *float64             `json:"temperature,omitempty"`
	MaxTokens     *int                 `json:"max_tokens,omitempty"`
}

// openAIUsage chứa số token prompt và token sinh ra do engine báo cáo.
type openAIUsage struct {
	PromptTokens     int `json:"prompt_tokens"`
	CompletionTokens int `json:"completion_tokens"`
}

// openAIStreamChunk ánh xạ từng SSE event `data: {...}` trả về từ /v1/chat/completions.
type openAIStreamChunk struct {
	Choices []struct {
		Delta struct {
			Content string `json:"content"`
		} `json:"delta"`
		FinishReason *string `json:"finish_reason"`
	} `json:"choices"`
	Usage *openAIUsage `json:"usage,omitempty"`
	Error *struct {
		Message string `json:"message"`
	} `json:"error,omitempty"`
}

// openAIModelsResponse ánh xạ phản hồi từ GET /v1/models để auto-discover model đang load.
type openAIModelsResponse struct {
	Data []struct {
		ID string `json:"id"`
	} `json:"data"`
}

// CheckHealth kiểm tra tình trạng sống của engine tương thích OpenAI qua GET /v1/models.
func (a *OpenAIAdapter) CheckHealth(ctx context.Context) error {
	return doJSONGet(ctx, a.httpClient, fmt.Sprintf("%s/v1/models", a.baseURL), "openai-compat", nil)
}

// ListModels đọc danh sách ID các model đang phục vụ tại /v1/models.
func (a *OpenAIAdapter) ListModels(ctx context.Context) ([]string, error) {
	var res openAIModelsResponse
	if err := doJSONGet(ctx, a.httpClient, fmt.Sprintf("%s/v1/models", a.baseURL), "openai-compat", &res); err != nil {
		return nil, err
	}
	out := make([]string, 0, len(res.Data))
	for _, m := range res.Data {
		if id := strings.TrimSpace(m.ID); id != "" {
			out = append(out, id)
		}
	}
	return out, nil
}

// GenerateStream mở SSE stream tới /v1/chat/completions, thu thập usage chunk cuối và đẩy TokenChunk về Worker.
func (a *OpenAIAdapter) GenerateStream(ctx context.Context, model string, messages []models.ChatTurn, opts models.GenerationOptions) (<-chan models.TokenChunk, error) {
	reqPayload := openAIChatRequest{
		Model:         model,
		Messages:      messages,
		Stream:        true,
		StreamOptions: &openAIStreamOptions{IncludeUsage: true},
		Temperature:   opts.Temperature,
		MaxTokens:     opts.MaxTokens,
	}

	resp, err := doStreamPost(ctx, a.httpClient, fmt.Sprintf("%s/v1/chat/completions", a.baseURL), "openai-compat engine", reqPayload)
	if err != nil {
		return nil, err
	}

	outChan := make(chan models.TokenChunk, 32)

	go func() {
		defer resp.Body.Close()
		defer close(outChan)

		scanner := bufio.NewScanner(resp.Body)
		scanner.Buffer(make([]byte, 0, 64*1024), 1024*1024)
		var sawFinish bool
		var sentDone bool
		var promptTokens int
		var completionTokens int

		emitDone := func() {
			if sentDone {
				return
			}
			sentDone = true
			select {
			case outChan <- models.TokenChunk{
				Done:             true,
				PromptTokens:     promptTokens,
				CompletionTokens: completionTokens,
			}:
			case <-ctx.Done():
			}
		}

		for scanner.Scan() {
			if ctx.Err() != nil {
				return
			}

			line := strings.TrimSpace(scanner.Text())
			if line == "" || strings.HasPrefix(line, ":") || !strings.HasPrefix(line, "data:") {
				continue
			}

			payload := strings.TrimSpace(strings.TrimPrefix(line, "data:"))
			if payload == "[DONE]" {
				emitDone()
				return
			}

			var chunk openAIStreamChunk
			if err := json.Unmarshal([]byte(payload), &chunk); err != nil {
				continue
			}

			if chunk.Error != nil && chunk.Error.Message != "" {
				select {
				case outChan <- models.TokenChunk{Error: chunk.Error.Message, Done: true}:
				case <-ctx.Done():
				}
				return
			}

			if chunk.Usage != nil {
				promptTokens = chunk.Usage.PromptTokens
				completionTokens = chunk.Usage.CompletionTokens
			}

			if len(chunk.Choices) > 0 {
				choice := chunk.Choices[0]
				if choice.Delta.Content != "" {
					select {
					case outChan <- models.TokenChunk{Token: choice.Delta.Content, TokenUnits: 1}:
					case <-ctx.Done():
						return
					}
				}
				if choice.FinishReason != nil && *choice.FinishReason != "" {
					sawFinish = true
					if chunk.Usage != nil {
						emitDone()
						return
					}
				}
			} else if sawFinish && chunk.Usage != nil {
				emitDone()
				return
			}
		}

		if err := scanner.Err(); err != nil && ctx.Err() == nil {
			select {
			case outChan <- models.TokenChunk{Error: fmt.Sprintf("openai-compat stream error: %v", err), Done: true}:
			case <-ctx.Done():
			}
			return
		}

		if sawFinish && !sentDone {
			emitDone()
		}
	}()

	return outChan, nil
}

