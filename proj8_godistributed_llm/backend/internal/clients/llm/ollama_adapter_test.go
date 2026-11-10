package llmclient

import (
	"context"
	"io"
	"net/http"
	"strings"
	"testing"
	"time"

	"go-distributed-llm/internal/models"
)

type roundTripFunc func(*http.Request) (*http.Response, error)

func (f roundTripFunc) RoundTrip(r *http.Request) (*http.Response, error) {
	return f(r)
}

func TestOllamaAdapter_GenerateStream(t *testing.T) {
	adapter := NewOllamaAdapter("http://localhost:11434", 5*time.Second)
	adapter.httpClient = &http.Client{
		Transport: roundTripFunc(func(r *http.Request) (*http.Response, error) {
			if r.URL.Path != "/api/chat" {
				t.Fatalf("unexpected path: %s", r.URL.Path)
			}
			body := "{\"message\":{\"role\":\"assistant\",\"content\":\"Hello\"},\"done\":false}\n" +
				"{\"message\":{\"role\":\"assistant\",\"content\":\" Go\"},\"done\":false}\n" +
				"{\"message\":{\"role\":\"assistant\",\"content\":\"\"},\"done\":true}\n"
			return &http.Response{
				StatusCode: http.StatusOK,
				Body:       io.NopCloser(strings.NewReader(body)),
				Header:     make(http.Header),
			}, nil
		}),
	}

	ch, err := adapter.GenerateStream(context.Background(), "qwen2.5:1.5b", []models.ChatTurn{
		{Role: "user", Content: "hi"},
	})
	if err != nil {
		t.Fatalf("GenerateStream error: %v", err)
	}

	var gotTokens string
	var gotDone bool
	for chunk := range ch {
		if chunk.Error != "" {
			t.Fatalf("unexpected error chunk: %s", chunk.Error)
		}
		gotTokens += chunk.Token
		if chunk.Done {
			gotDone = true
		}
	}

	if gotTokens != "Hello Go" {
		t.Fatalf("expected 'Hello Go', got %q", gotTokens)
	}
	if !gotDone {
		t.Fatalf("expected final chunk with Done=true")
	}
}

func TestLlamaCppAdapter_GenerateStream(t *testing.T) {
	adapter := NewLlamaCppAdapter("http://localhost:8081", 5*time.Second)
	adapter.httpClient = &http.Client{
		Transport: roundTripFunc(func(r *http.Request) (*http.Response, error) {
			if r.URL.Path != "/completion" {
				t.Fatalf("unexpected path: %s", r.URL.Path)
			}
			body := "data: {\"content\":\"Xin\",\"stop\":false}\n\n" +
				"data: {\"content\":\" chao\",\"stop\":true}\n\n"
			return &http.Response{
				StatusCode: http.StatusOK,
				Body:       io.NopCloser(strings.NewReader(body)),
				Header:     make(http.Header),
			}, nil
		}),
	}

	ch, err := adapter.GenerateStream(context.Background(), "qwen2.5:1.5b", []models.ChatTurn{
		{Role: "user", Content: "hi"},
	})
	if err != nil {
		t.Fatalf("GenerateStream error: %v", err)
	}

	var gotTokens string
	var gotDone bool
	for chunk := range ch {
		gotTokens += chunk.Token
		if chunk.Done {
			gotDone = true
		}
	}

	if gotTokens != "Xin chao" || !gotDone {
		t.Fatalf("unexpected output tokens=%q done=%v", gotTokens, gotDone)
	}
}

func TestOllamaAdapter_Non200IncludesBody(t *testing.T) {
	adapter := NewOllamaAdapter("http://localhost:11434", 5*time.Second)
	adapter.httpClient = &http.Client{
		Transport: roundTripFunc(func(r *http.Request) (*http.Response, error) {
			return &http.Response{
				StatusCode: http.StatusNotFound,
				Body:       io.NopCloser(strings.NewReader(`{"error":"model 'qwen2.5:7b' not found"}`)),
				Header:     make(http.Header),
			}, nil
		}),
	}

	_, err := adapter.GenerateStream(context.Background(), "qwen2.5:7b", []models.ChatTurn{
		{Role: "user", Content: "hi"},
	})
	if err == nil || !strings.Contains(err.Error(), "not found") {
		t.Fatalf("expected error with body detail, got %v", err)
	}
}

func TestOpenAIAdapter_GenerateStream(t *testing.T) {
	adapter := NewOpenAIAdapter("http://localhost:8000", 5*time.Second)
	adapter.httpClient = &http.Client{
		Transport: roundTripFunc(func(r *http.Request) (*http.Response, error) {
			if r.URL.Path != "/v1/chat/completions" {
				t.Fatalf("unexpected path: %s", r.URL.Path)
			}
			body := "data: {\"choices\":[{\"delta\":{\"content\":\"Fast \"},\"finish_reason\":null}]}\n\n" +
				"data: {\"choices\":[{\"delta\":{\"content\":\"vLLM\"},\"finish_reason\":\"stop\"}]}\n\n" +
				"data: [DONE]\n\n"
			return &http.Response{
				StatusCode: http.StatusOK,
				Body:       io.NopCloser(strings.NewReader(body)),
				Header:     make(http.Header),
			}, nil
		}),
	}

	ch, err := adapter.GenerateStream(context.Background(), "qwen2.5:1.5b", []models.ChatTurn{
		{Role: "user", Content: "prev"},
		{Role: "assistant", Content: "ans"},
		{Role: "user", Content: "hi"},
	})
	if err != nil {
		t.Fatalf("GenerateStream error: %v", err)
	}

	var gotTokens string
	var doneCount int
	for chunk := range ch {
		if chunk.Error != "" {
			t.Fatalf("unexpected error chunk: %s", chunk.Error)
		}
		gotTokens += chunk.Token
		if chunk.Done {
			doneCount++
		}
	}

	if gotTokens != "Fast vLLM" || doneCount != 1 {
		t.Fatalf("unexpected output tokens=%q doneCount=%d", gotTokens, doneCount)
	}
}
