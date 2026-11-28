package ports

import (
	"context"

	"go-distributed-llm/shared/models"
)

// TokenStreamer là cổng truyền token tốc độ cao từ Worker về đúng Gateway.
// Mặc định cài đặt bằng gRPC Client-side Streaming hoặc HTTP NDJSON.
type TokenStreamer interface {
	StreamTokens(ctx context.Context, targetAddr string, chunks <-chan models.TokenChunk) error
}

