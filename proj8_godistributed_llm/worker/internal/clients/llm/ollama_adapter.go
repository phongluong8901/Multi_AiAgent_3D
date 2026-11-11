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

// OllamaAdapter giao tiếp với Ollama REST API (/api/chat, /api/tags) hỗ trợ Multi-turn Context,
// temperature/num_predict, thống kê prompt/completion tokens, health check và auto-discovery model.
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

type ollamaOptions struct {
	Temperature *float64 `json:"temperature,omitempty"`
	NumPredict  *int     `json:"num_predict,omitempty"`
}

type ollamaChatRequest struct {
	Model    string            `json:"model"`
	Messages []models.ChatTurn `json:"messages"`
	Stream   bool              `json:"stream"`
	Options  *ollamaOptions    `json:"options,omitempty"`
}

type ollamaChatResponse struct {
	Message struct {
		Role    string `json:"role"`
		Content string `json:"content"`
	} `json:"message"`
	Response        string `json:"response"`
	Done            bool   `json:"done"`
	Error           string `json:"error,omitempty"`
	PromptEvalCount int    `json:"prompt_eval_count,omitempty"`
	EvalCount       int    `json:"eval_count,omitempty"`
}

type ollamaTagsResponse struct {
	Models []struct {
		Name string `json:"name"`
	} `json:"models"`
}

func (o *OllamaAdapter) CheckHealth(ctx context.Context) error {
	return doJSONGet(ctx, o.httpClient, fmt.Sprintf("%s/api/tags", o.baseURL), "ollama", nil)
}

func (o *OllamaAdapter) ListModels(ctx context.Context) ([]string, error) {
	var res ollamaTagsResponse
	if err := doJSONGet(ctx, o.httpClient, fmt.Sprintf("%s/api/tags", o.baseURL), "ollama", &res); err != nil {
		return nil, err
	}
	out := make([]string, 0, len(res.Models))
	for _, m := range res.Models {
		if name := strings.TrimSpace(m.Name); name != "" {
			out = append(out, name)
		}
	}
	return out, nil
}

func (o *OllamaAdapter) GenerateStream(ctx context.Context, model string, messages []models.ChatTurn, opts models.GenerationOptions) (<-chan models.TokenChunk, error) {
	reqPayload := ollamaChatRequest{
		Model:    model,
		Messages: messages,
		Stream:   true,
	}
	if opts.Temperature != nil || opts.MaxTokens != nil {
		reqPayload.Options = &ollamaOptions{
			Temperature: opts.Temperature,
			NumPredict:  opts.MaxTokens,
		}
	}

	resp, err := doStreamPost(ctx, o.httpClient, fmt.Sprintf("%s/api/chat", o.baseURL), "ollama", reqPayload)
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

			outChunk := models.TokenChunk{
				Token: tok,
				Done:  chunk.Done,
			}
			if tok != "" {
				outChunk.TokenUnits = 1
			}
			if chunk.Done {
				outChunk.PromptTokens = chunk.PromptEvalCount
				outChunk.CompletionTokens = chunk.EvalCount
			}

			select {
			case outChan <- outChunk:
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

