package repositories

import (
	"context"
	"io"
	"log/slog"
	"testing"
	"time"

	postgresrepo "go-distributed-llm/internal/repositories/postgres"
	"go-distributed-llm/shared/models"
)

func TestAsyncRepository_NonBlockingAndFlushOnClose(t *testing.T) {
	mem := postgresrepo.NewMemoryRepository()
	log := slog.New(slog.NewTextHandler(io.Discard, nil))
	asyncRepo := NewAsyncRepository(mem, 16, log)

	_ = asyncRepo.SaveMessage(context.Background(), models.Message{
		ID:             "m-async-1",
		ConversationID: "conv-async",
		JobID:          "j-async",
		Role:           "user",
		Model:          "qwen2.5:1.5b",
		Content:        "async hello",
		CreatedAt:      time.Now(),
	})
	_ = asyncRepo.LogUsage(context.Background(), models.UsageLog{
		JobID:      "j-async",
		UserID:     "u1",
		Model:      "qwen2.5:1.5b",
		TokenCount: 10,
	})

	// Close blocks until all queued async writes are flushed to underlying repo.
	asyncRepo.Close()

	msgs, err := mem.GetHistory(context.Background(), "conv-async", 10)
	if err != nil || len(msgs) != 1 || msgs[0].Content != "async hello" {
		t.Fatalf("expected flushed async message, got err=%v msgs=%+v", err, msgs)
	}
}

