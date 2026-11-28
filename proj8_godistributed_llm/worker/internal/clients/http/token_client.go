package httpclient

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"go-distributed-llm/shared/models"
	"go-distributed-llm/shared/pkg/auth"
)

// HTTPTokenClient cài đặt ports.TokenStreamer qua giao thức HTTP/1.1 Chunked NDJSON.
type HTTPTokenClient struct {
	httpClient    *http.Client
	internalToken string
}

// NewHTTPTokenClient tạo HTTP client truyền token stream về Gateway (dùng khi transport="http").
func NewHTTPTokenClient(timeout time.Duration) *HTTPTokenClient {
	if timeout <= 0 {
		timeout = 180 * time.Second
	}
	return &HTTPTokenClient{
		httpClient: &http.Client{Timeout: timeout},
	}
}

// SetInternalToken gán shared secret gửi kèm trong header X-Internal-Token.
func (c *HTTPTokenClient) SetInternalToken(token string) {
	c.internalToken = strings.TrimSpace(token)
}

// StreamTokens đọc chunks từ channel, encode từng dòng JSON (NDJSON) qua io.Pipe và POST streaming về /internal/v1/tokens/stream.
func (c *HTTPTokenClient) StreamTokens(ctx context.Context, targetHTTPAddr string, chunks <-chan models.TokenChunk) error {
	base := strings.TrimRight(strings.TrimSpace(targetHTTPAddr), "/")
	if base == "" {
		return fmt.Errorf("empty target HTTP address")
	}
	if !strings.HasPrefix(base, "http://") && !strings.HasPrefix(base, "https://") {
		base = "http://" + base
	}
	endpoint := base + "/internal/v1/tokens/stream"

	pr, pw := io.Pipe()

	writeErrCh := make(chan error, 1)
	go func() {
		enc := json.NewEncoder(pw)
		for {
			select {
			case <-ctx.Done():
				_ = pw.CloseWithError(ctx.Err())
				writeErrCh <- ctx.Err()
				return
			case chunk, ok := <-chunks:
				if !ok {
					_ = pw.Close()
					writeErrCh <- nil
					return
				}
				if err := enc.Encode(chunk); err != nil {
					_ = pw.CloseWithError(err)
					writeErrCh <- err
					return
				}
			}
		}
	}()

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, pr)
	if err != nil {
		_ = pw.CloseWithError(err)
		return err
	}
	req.Header.Set("Content-Type", "application/x-ndjson")
	if c.internalToken != "" {
		req.Header.Set(auth.InternalTokenHeader, c.internalToken)
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		_ = pr.CloseWithError(err)
		return fmt.Errorf("http token stream to %s failed: %w", endpoint, err)
	}
	defer resp.Body.Close()
	_, _ = io.Copy(io.Discard, resp.Body)

	if writeErr := <-writeErrCh; writeErr != nil {
		return writeErr
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("gateway HTTP token endpoint returned status %d", resp.StatusCode)
	}
	return nil
}

