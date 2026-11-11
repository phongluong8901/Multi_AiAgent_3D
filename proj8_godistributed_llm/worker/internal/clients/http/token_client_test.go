package httpclient

import (
	"bufio"
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

func TestHTTPTokenClient_StreamTokens(t *testing.T) {
	var received []models.TokenChunk

	client := NewHTTPTokenClient(5 * time.Second)
	client.httpClient = &http.Client{
		Transport: roundTripFunc(func(r *http.Request) (*http.Response, error) {
			if r.URL.String() != "http://127.0.0.1:8088/internal/v1/tokens/stream" {
				t.Fatalf("unexpected url: %s", r.URL.String())
			}
			scanner := bufio.NewScanner(r.Body)
			for scanner.Scan() {
				var chunk models.TokenChunk
				if err := json.Unmarshal(scanner.Bytes(), &chunk); err != nil {
					t.Fatalf("unmarshal chunk failed: %v", err)
				}
				received = append(received, chunk)
			}
			return &http.Response{
				StatusCode: http.StatusOK,
				Body:       io.NopCloser(strings.NewReader(`{"acknowledged":true}`)),
				Header:     make(http.Header),
			}, nil
		}),
	}

	ch := make(chan models.TokenChunk, 2)
	ch <- models.TokenChunk{JobID: "j1", WorkerID: "w1", Token: "Hi "}
	ch <- models.TokenChunk{JobID: "j1", WorkerID: "w1", Token: "HTTP", Done: true}
	close(ch)

	if err := client.StreamTokens(context.Background(), "http://127.0.0.1:8088", ch); err != nil {
		t.Fatalf("StreamTokens failed: %v", err)
	}

	if len(received) != 2 || received[0].Token != "Hi " || !received[1].Done {
		t.Fatalf("unexpected received chunks: %+v", received)
	}
}

