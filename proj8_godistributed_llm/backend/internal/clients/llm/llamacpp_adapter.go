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

// LlamaCppAdapter giao tiếp với llama.cpp server qua endpoint /completion (SSE stream).
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
	Prompt string `json:"prompt"`
	Stream bool   `json:"stream"`
}

type llamaCppResponse struct {
	Content string `json:"content"`
	Stop    bool   `json:"stop"`
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

func (l *LlamaCppAdapter) GenerateStream(ctx context.Context, _ string, messages []models.ChatTurn) (<-chan models.TokenChunk, error) {
	bodyBytes, err := json.Marshal(llamaCppRequest{
		Prompt: formatChatTurnsForCompletion(messages),
		Stream: true,
	})
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, fmt.Sprintf("%s/completion", l.baseURL), bytes.NewReader(bodyBytes))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := l.httpClient.Do(req)
	if err != nil {
		return nil, err
	}

	if resp.StatusCode != http.StatusOK {
		errBody, _ := io.ReadAll(io.LimitReader(resp.Body, 1024))
		resp.Body.Close()
		detail := strings.TrimSpace(string(errBody))
		if detail != "" {
			return nil, fmt.Errorf("llama.cpp returned HTTP %d: %s", resp.StatusCode, detail)
		}
		return nil, fmt.Errorf("llama.cpp returned HTTP %d", resp.StatusCode)
	}

	outChan := make(chan models.TokenChunk, 32)

	go func() {
		defer resp.Body.Close()
		defer close(outChan)

		scanner := bufio.NewScanner(resp.Body)
		for scanner.Scan() {
			if ctx.Err() != nil {
				return
			}

			line := strings.TrimSpace(scanner.Text())
			if line == "" || strings.HasPrefix(line, ":") {
				continue
			}

			payload := strings.TrimPrefix(line, "data:")
			payload = strings.TrimSpace(payload)
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

			select {
			case outChan <- models.TokenChunk{Token: chunk.Content, Done: chunk.Stop}:
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
