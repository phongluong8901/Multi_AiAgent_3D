package llmclient

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"go-distributed-llm/internal/models"
)

// OpenAIAdapter giao tiếp với các Local LLM Engine hỗ trợ OpenAI-compatible SSE API
// như vLLM, SGLang, LM Studio, hoặc llama.cpp server (/v1/chat/completions).
type OpenAIAdapter struct {
	baseURL    string
	httpClient *http.Client
}

func NewOpenAIAdapter(baseURL string, timeout time.Duration) *OpenAIAdapter {
	return &OpenAIAdapter{
		baseURL: strings.TrimRight(baseURL, "/"),
		httpClient: &http.Client{
			Timeout: timeout,
		},
	}
}

type openAIChatRequest struct {
	Model    string            `json:"model"`
	Messages []models.ChatTurn `json:"messages"`
	Stream   bool              `json:"stream"`
}

type openAIStreamChunk struct {
	Choices []struct {
		Delta struct {
			Content string `json:"content"`
		} `json:"delta"`
		FinishReason *string `json:"finish_reason"`
	} `json:"choices"`
	Error *struct {
		Message string `json:"message"`
	} `json:"error,omitempty"`
}

func (a *OpenAIAdapter) GenerateStream(ctx context.Context, model string, messages []models.ChatTurn) (<-chan models.TokenChunk, error) {
	bodyBytes, err := json.Marshal(openAIChatRequest{
		Model:    model,
		Messages: messages,
		Stream:   true,
	})
	if err != nil {
		return nil, err
	}

	endpoint := fmt.Sprintf("%s/v1/chat/completions", a.baseURL)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(bodyBytes))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := a.httpClient.Do(req)
	if err != nil {
		return nil, err
	}

	if resp.StatusCode != http.StatusOK {
		errBody, _ := io.ReadAll(io.LimitReader(resp.Body, 1024))
		resp.Body.Close()
		detail := strings.TrimSpace(string(errBody))
		if detail != "" {
			return nil, fmt.Errorf("openai-compat engine returned HTTP %d: %s", resp.StatusCode, detail)
		}
		return nil, fmt.Errorf("openai-compat engine returned HTTP %d", resp.StatusCode)
	}

	outChan := make(chan models.TokenChunk, 32)

	go func() {
		defer resp.Body.Close()
		defer close(outChan)

		scanner := bufio.NewScanner(resp.Body)
		sentDone := false

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
				if !sentDone {
					select {
					case outChan <- models.TokenChunk{Done: true}:
					case <-ctx.Done():
					}
				}
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

			if len(chunk.Choices) == 0 {
				continue
			}

			choice := chunk.Choices[0]
			isFinal := choice.FinishReason != nil && *choice.FinishReason != ""
			if isFinal {
				sentDone = true
			}

			if choice.Delta.Content != "" || isFinal {
				select {
				case outChan <- models.TokenChunk{Token: choice.Delta.Content, Done: isFinal}:
				case <-ctx.Done():
					return
				}
			}
		}

		if err := scanner.Err(); err != nil && ctx.Err() == nil {
			select {
			case outChan <- models.TokenChunk{Error: fmt.Sprintf("openai-compat stream error: %v", err), Done: true}:
			case <-ctx.Done():
			}
		}
	}()

	return outChan, nil
}
