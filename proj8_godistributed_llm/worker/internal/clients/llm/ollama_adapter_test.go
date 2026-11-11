package llmclient

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"strings"
	"testing"
	"time"

	"go-distributed-llm/shared/models"
)

type roundTripFunc func(*http.Request) (*http.Response, error)

func (f roundTripFunc) RoundTrip(r *http.Request) (*http.Response, error) {
	return f(r)
}

func TestOllamaAdapter_GenerateStream(t *testing.T) {
	temp := 0.2
	maxTok := 128
	var capturedReq ollamaChatRequest

	adapter := NewOllamaAdapter("http://localhost:11434", 5*time.Second)
	adapter.httpClient = &http.Client{
		Transport: roundTripFunc(func(r *http.Request) (*http.Response, error) {
			if r.URL.Path != "/api/chat" {
				t.Fatalf("unexpected path: %s", r.URL.Path)
			}
			_ = json.NewDecoder(r.Body).Decode(&capturedReq)
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
		{Role: "system", Content: "Be concise"},
		{Role: "user", Content: "hi"},
	}, models.GenerationOptions{Temperature: &temp, MaxTokens: &maxTok})
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

	if gotTokens != "Hello Go" || !gotDone {
		t.Fatalf("expected 'Hello Go' + done, got %q done=%v", gotTokens, gotDone)
	}
	if capturedReq.Options == nil || *capturedReq.Options.Temperature != 0.2 || *capturedReq.Options.NumPredict != 128 {
		t.Fatalf("expected options forwarded to Ollama, got %+v", capturedReq.Options)
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
	}, models.GenerationOptions{})
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
	}, models.GenerationOptions{})
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
	}, models.GenerationOptions{})
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

func TestAdapters_UsageAccountingAndDiscovery(t *testing.T) {
	ollama := NewOllamaAdapter("http://localhost:11434", 5*time.Second)
	ollama.httpClient = &http.Client{
		Transport: roundTripFunc(func(r *http.Request) (*http.Response, error) {
			if r.URL.Path == "/api/tags" {
				return &http.Response{
					StatusCode: http.StatusOK,
					Body:       io.NopCloser(strings.NewReader(`{"models":[{"name":"qwen2.5:1.5b"},{"name":"llama3.2:3b"}]}`)),
					Header:     make(http.Header),
				}, nil
			}
			body := "{\"message\":{\"role\":\"assistant\",\"content\":\"Hi\"},\"done\":false}\n" +
				"{\"message\":{\"role\":\"assistant\",\"content\":\"\"},\"done\":true,\"prompt_eval_count\":14,\"eval_count\":9}\n"
			return &http.Response{
				StatusCode: http.StatusOK,
				Body:       io.NopCloser(strings.NewReader(body)),
				Header:     make(http.Header),
			}, nil
		}),
	}

	modelsList, err := ollama.ListModels(context.Background())
	if err != nil || len(modelsList) != 2 || modelsList[0] != "qwen2.5:1.5b" {
		t.Fatalf("Ollama ListModels failed: list=%v err=%v", modelsList, err)
	}
	if err := ollama.CheckHealth(context.Background()); err != nil {
		t.Fatalf("Ollama CheckHealth failed: %v", err)
	}

	ch, err := ollama.GenerateStream(context.Background(), "qwen2.5:1.5b", []models.ChatTurn{{Role: "user", Content: "hi"}}, models.GenerationOptions{})
	if err != nil {
		t.Fatalf("Ollama stream error: %v", err)
	}
	var lastOllama models.TokenChunk
	for c := range ch {
		lastOllama = c
	}
	if !lastOllama.Done || lastOllama.PromptTokens != 14 || lastOllama.CompletionTokens != 9 {
		t.Fatalf("expected Ollama prompt/eval token counts on final chunk, got %+v", lastOllama)
	}

	openai := NewOpenAIAdapter("http://localhost:8000", 5*time.Second)
	openai.httpClient = &http.Client{
		Transport: roundTripFunc(func(r *http.Request) (*http.Response, error) {
			if r.URL.Path == "/v1/models" {
				return &http.Response{
					StatusCode: http.StatusOK,
					Body:       io.NopCloser(strings.NewReader(`{"data":[{"id":"Qwen/Qwen2.5-7B-Instruct"}]}`)),
					Header:     make(http.Header),
				}, nil
			}
			body := "data: {\"choices\":[{\"delta\":{\"content\":\"OK\"},\"finish_reason\":null}]}\n\n" +
				"data: {\"choices\":[{\"delta\":{},\"finish_reason\":\"stop\"}]}\n\n" +
				"data: {\"choices\":[],\"usage\":{\"prompt_tokens\":21,\"completion_tokens\":6}}\n\n" +
				"data: [DONE]\n\n"
			return &http.Response{
				StatusCode: http.StatusOK,
				Body:       io.NopCloser(strings.NewReader(body)),
				Header:     make(http.Header),
			}, nil
		}),
	}

	oModels, err := openai.ListModels(context.Background())
	if err != nil || len(oModels) != 1 || oModels[0] != "Qwen/Qwen2.5-7B-Instruct" {
		t.Fatalf("OpenAI ListModels failed: %v %v", oModels, err)
	}
	oCh, err := openai.GenerateStream(context.Background(), "Qwen/Qwen2.5-7B-Instruct", []models.ChatTurn{{Role: "user", Content: "hi"}}, models.GenerationOptions{})
	if err != nil {
		t.Fatalf("OpenAI stream error: %v", err)
	}
	var doneCount int
	var lastOAI models.TokenChunk
	for c := range oCh {
		if c.Done {
			doneCount++
			lastOAI = c
		}
	}
	if doneCount != 1 || lastOAI.PromptTokens != 21 || lastOAI.CompletionTokens != 6 {
		t.Fatalf("expected single done with trailing usage, got done=%d last=%+v", doneCount, lastOAI)
	}
}

