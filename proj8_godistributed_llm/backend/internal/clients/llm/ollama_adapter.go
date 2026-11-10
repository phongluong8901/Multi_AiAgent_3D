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

// OllamaAdapter giao tiếp với Ollama REST API (/api/chat) hỗ trợ Multi-turn Context
// và đẩy từng token vào Go Channel.
type OllamaAdapter struct {
	baseURL    string
	httpClient *http.Client
}

func NewOllamaAdapter(baseURL string, timeout time.Duration) *OllamaAdapter {
	return &OllamaAdapter{
		baseURL: strings.TrimRight(baseURL, "/"),
		httpClient: &http.Client{
			Timeout: timeout,
		},
	}
}

type ollamaChatRequest struct {
	Model    string            `json:"model"`
	Messages []models.ChatTurn `json:"messages"`
	Stream   bool              `json:"stream"`
}

type ollamaChatResponse struct {
	Message struct {
		Role    string `json:"role"`
		Content string `json:"content"`
	} `json:"message"`
	Response string `json:"response"` // Fallback nếu bản Ollama cũ trả về field response
	Done     bool   `json:"done"`
	Error    string `json:"error,omitempty"`
}

func (o *OllamaAdapter) GenerateStream(ctx context.Context, model string, messages []models.ChatTurn) (<-chan models.TokenChunk, error) {
	bodyBytes, err := json.Marshal(ollamaChatRequest{
		Model:    model,
		Messages: messages,
		Stream:   true,
	})
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, fmt.Sprintf("%s/api/chat", o.baseURL), bytes.NewReader(bodyBytes))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := o.httpClient.Do(req)
	if err != nil {
		return nil, err
	}

	if resp.StatusCode != http.StatusOK {
		errBody, _ := io.ReadAll(io.LimitReader(resp.Body, 1024))
		resp.Body.Close()
		detail := strings.TrimSpace(string(errBody))
		if detail != "" {
			return nil, fmt.Errorf("ollama returned HTTP %d: %s", resp.StatusCode, detail)
		}
		return nil, fmt.Errorf("ollama returned HTTP %d", resp.StatusCode)
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

			var chunk ollamaChatResponse
			if err := json.Unmarshal(scanner.Bytes(), &chunk); err != nil {
				continue
			}

			if chunk.Error != "" {
				select {
				case outChan <- models.TokenChunk{Error: chunk.Error, Done: true}:
				case <-ctx.Done():
				}
				return
			}

			tok := chunk.Message.Content
			if tok == "" {
				tok = chunk.Response
			}

			select {
			case outChan <- models.TokenChunk{Token: tok, Done: chunk.Done}:
			case <-ctx.Done():
				return
			}

			if chunk.Done {
				return
			}
		}

		if err := scanner.Err(); err != nil && ctx.Err() == nil {
			select {
			case outChan <- models.TokenChunk{Error: fmt.Sprintf("ollama stream error: %v", err), Done: true}:
			case <-ctx.Done():
			}
		}
	}()

	return outChan, nil
}
