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

// LlamaCppAdapter giao tiếp với llama.cpp server qua endpoint /completion (SSE stream) và /health.
type LlamaCppAdapter struct {
	baseURL    string
	httpClient *http.Client
}

func NewLlamaCppAdapter(baseURL string, timeout time.Duration) *LlamaCppAdapter {
	return &LlamaCppAdapter{
		baseURL: strings.TrimRight(baseURL, "/"),
		httpClient: &http.Client{
			Timeout: timeout,
		},
	}
}

type llamaCppRequest struct {
	Prompt      string   `json:"prompt"`
	Stream      bool     `json:"stream"`
	Temperature *float64 `json:"temperature,omitempty"`
	NPredict    *int     `json:"n_predict,omitempty"`
}

type llamaCppResponse struct {
	Content         string `json:"content"`
	Stop            bool   `json:"stop"`
	TokensEvaluated int    `json:"tokens_evaluated,omitempty"`
	TokensPredicted int    `json:"tokens_predicted,omitempty"`
}

func (l *LlamaCppAdapter) CheckHealth(ctx context.Context) error {
	return doJSONGet(ctx, l.httpClient, fmt.Sprintf("%s/health", l.baseURL), "llama.cpp", nil)
}

func formatChatTurnsForCompletion(messages []models.ChatTurn) string {
	if len(messages) == 1 && messages[0].Role == "user" {
		return messages[0].Content
	}
	var b strings.Builder
	for _, m := range messages {
		b.WriteString(strings.ToUpper(m.Role))
		b.WriteString(": ")
		b.WriteString(m.Content)
		b.WriteString("\n")
	}
	b.WriteString("ASSISTANT: ")
	return b.String()
}

func (l *LlamaCppAdapter) GenerateStream(ctx context.Context, _ string, messages []models.ChatTurn, opts models.GenerationOptions) (<-chan models.TokenChunk, error) {
	resp, err := doStreamPost(ctx, l.httpClient, fmt.Sprintf("%s/completion", l.baseURL), "llama.cpp", llamaCppRequest{
		Prompt:      formatChatTurnsForCompletion(messages),
		Stream:      true,
		Temperature: opts.Temperature,
		NPredict:    opts.MaxTokens,
	})
	if err != nil {
		return nil, err
	}

	outChan := make(chan models.TokenChunk, 32)

	go func() {
		defer resp.Body.Close()
		defer close(outChan)

		scanner := bufio.NewScanner(resp.Body)
		scanner.Buffer(make([]byte, 0, 64*1024), 1024*1024)
		for scanner.Scan() {
			if ctx.Err() != nil {
				return
			}

			line := strings.TrimSpace(scanner.Text())
			if line == "" || strings.HasPrefix(line, ":") {
				continue
			}

			payload := strings.TrimSpace(strings.TrimPrefix(line, "data:"))
			if payload == "[DONE]" {
				select {
				case outChan <- models.TokenChunk{Done: true}:
				case <-ctx.Done():
				}
				return
			}

			var chunk llamaCppResponse
			if err := json.Unmarshal([]byte(payload), &chunk); err != nil {
				continue
			}

			outChunk := models.TokenChunk{
				Token: chunk.Content,
				Done:  chunk.Stop,
			}
			if chunk.Content != "" {
				outChunk.TokenUnits = 1
			}
			if chunk.Stop {
				outChunk.PromptTokens = chunk.TokensEvaluated
				outChunk.CompletionTokens = chunk.TokensPredicted
			}

			select {
			case outChan <- outChunk:
			case <-ctx.Done():
				return
			}

			if chunk.Stop {
				return
			}
		}

		if err := scanner.Err(); err != nil && ctx.Err() == nil {
			select {
			case outChan <- models.TokenChunk{Error: fmt.Sprintf("llamacpp stream error: %v", err), Done: true}:
			case <-ctx.Done():
			}
		}
	}()

	return outChan, nil
}

