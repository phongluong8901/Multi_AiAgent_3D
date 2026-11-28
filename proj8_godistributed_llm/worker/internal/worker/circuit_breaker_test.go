package worker

import (
	"context"
	"io"
	"log/slog"
	"testing"
	"time"

	"go-distributed-llm/shared/models"
)

func TestCircuitBreaker_StateTransitions(t *testing.T) {
	cb := NewCircuitBreaker(2, 60*time.Millisecond)

	if !cb.Allow() || cb.State() != BreakerClosed {
		t.Fatalf("expected initial state CLOSED")
	}

	if st := cb.RecordFailure(); st != BreakerClosed {
		t.Fatalf("1st failure should keep CLOSED, got %s", st)
	}
	if st := cb.RecordFailure(); st != BreakerOpen || cb.IsHealthy() {
		t.Fatalf("2nd failure should trip OPEN, got %s", st)
	}
	if cb.Allow() {
		t.Fatalf("OPEN breaker should reject immediate Allow()")
	}

	time.Sleep(75 * time.Millisecond)
	if !cb.Allow() || cb.State() != BreakerHalfOpen {
		t.Fatalf("after cooldown breaker should transition to HALF_OPEN and allow 1 probe")
	}
	if cb.Allow() {
		t.Fatalf("HALF_OPEN breaker should reject concurrent 2nd probe while 1st is in-flight")
	}

	cb.RecordSuccess()
	if !cb.IsHealthy() || cb.State() != BreakerClosed {
		t.Fatalf("success probe should close circuit breaker")
	}
}

type burstyLLM struct{}

func (b *burstyLLM) GenerateStream(_ context.Context, _ string, _ []models.ChatTurn, _ models.GenerationOptions) (<-chan models.TokenChunk, error) {
	ch := make(chan models.TokenChunk, 8)
	go func() {
		defer close(ch)
		ch <- models.TokenChunk{Token: "First", TokenUnits: 1}
		ch <- models.TokenChunk{Token: " a", TokenUnits: 1}
		ch <- models.TokenChunk{Token: " b", TokenUnits: 1}
		ch <- models.TokenChunk{Token: " c", TokenUnits: 1}
		ch <- models.TokenChunk{Token: "!", Done: true, TokenUnits: 1, PromptTokens: 10, CompletionTokens: 5}
	}()
	return ch, nil
}

func TestWorker_MicroBatchingPreservesFirstTokenAndTokenUnits(t *testing.T) {
	q := &mockQueue{}
	bus := &mockBus{cancelAllCh: make(chan string)}
	streamer := &mockStreamer{}
	log := slog.New(slog.NewTextHandler(io.Discard, nil))

	w := NewClusterWorker("w-batch", "http", "g", []string{"qwen2.5:1.5b"}, 1, 5*time.Second, q, bus, &mockRegistry{}, &burstyLLM{}, streamer, log)
	w.Configure(WorkerOptions{
		MaxJobDuration:     5 * time.Second,
		BatchFlushInterval: 50 * time.Millisecond,
	})

	w.processJob(context.Background(), models.JobPayload{
		ID:              "job-batch-1",
		StreamName:      "jobs:model:qwen2.5:1.5b",
		StreamMessageID: "1-0",
		Model:           "qwen2.5:1.5b",
		Prompt:          "hi",
		ReplyToHTTPAddr: "http://127.0.0.1:8088",
	})

	if len(streamer.received) < 2 || len(streamer.received) >= 5 {
		t.Fatalf("expected coalesced batches (2 or 3 chunks instead of 5), got %d: %+v", len(streamer.received), streamer.received)
	}
	if streamer.received[0].Token != "First" {
		t.Fatalf("expected first token flushed immediately without delay, got %q", streamer.received[0].Token)
	}
	var assembled string
	var totalUnits int
	var last models.TokenChunk
	for _, c := range streamer.received {
		assembled += c.Token
		totalUnits += c.TokenUnits
		last = c
	}
	if assembled != "First a b c!" || totalUnits != 5 || !last.Done || last.PromptTokens != 10 || last.CompletionTokens != 5 {
		t.Fatalf("batching corrupted content or usage: text=%q units=%d last=%+v", assembled, totalUnits, last)
	}
}

func TestWorker_HardJobTimeoutCancelsAndUnblocksSlot(t *testing.T) {
	q := &mockQueue{}
	bus := &mockBus{cancelAllCh: make(chan string)}
	llm := &slowBlockingLLM{}
	streamer := &mockStreamer{}
	log := slog.New(slog.NewTextHandler(io.Discard, nil))

	w := NewClusterWorker("w-timeout", "http", "g", []string{"qwen2.5:1.5b"}, 1, 5*time.Second, q, bus, &mockRegistry{}, llm, streamer, log)
	w.Configure(WorkerOptions{
		MaxJobDuration: 60 * time.Millisecond,
	})

	w.processJob(context.Background(), models.JobPayload{
		ID:              "job-timeout-1",
		StreamName:      "jobs:model:qwen2.5:1.5b",
		StreamMessageID: "1-2",
		Model:           "qwen2.5:1.5b",
		Prompt:          "hang forever",
		ReplyToHTTPAddr: "http://127.0.0.1:8088",
	})

	if !llm.canceled.Load() || !q.acked.Load() {
		t.Fatalf("expected slow engine to be canceled and job acked on hard timeout")
	}
	if len(streamer.received) == 0 || streamer.received[len(streamer.received)-1].Error == "" {
		t.Fatalf("expected timeout error chunk streamed to gateway, got %+v", streamer.received)
	}
}

type gracefulQueue struct {
	mockQueue
	jobCh chan models.JobPayload
}

func (q *gracefulQueue) PullJobFromModels(ctx context.Context, _ string, _ string, _ []string, _ time.Duration) (*models.JobPayload, error) {
	select {
	case <-ctx.Done():
		return nil, ctx.Err()
	case j := <-q.jobCh:
		return &j, nil
	}
}

type stagedLLM struct {
	started  chan struct{}
	finishIn time.Duration
}

func (s *stagedLLM) GenerateStream(ctx context.Context, _ string, _ []models.ChatTurn, _ models.GenerationOptions) (<-chan models.TokenChunk, error) {
	close(s.started)
	ch := make(chan models.TokenChunk, 2)
	go func() {
		defer close(ch)
		ch <- models.TokenChunk{Token: "Half-", TokenUnits: 1}
		select {
		case <-ctx.Done():
			return
		case <-time.After(s.finishIn):
		}
		ch <- models.TokenChunk{Token: "Done", Done: true, TokenUnits: 1}
	}()
	return ch, nil
}

func TestWorker_GracefulShutdownAllowsInFlightJobToFinish(t *testing.T) {
	q := &gracefulQueue{jobCh: make(chan models.JobPayload, 1)}
	bus := &mockBus{cancelAllCh: make(chan string)}
	llm := &stagedLLM{started: make(chan struct{}), finishIn: 80 * time.Millisecond}
	streamer := &mockStreamer{}
	log := slog.New(slog.NewTextHandler(io.Discard, nil))

	w := NewClusterWorker("w-grace", "http", "g", []string{"qwen2.5:1.5b"}, 1, 5*time.Second, q, bus, &mockRegistry{}, llm, streamer, log)
	w.Configure(WorkerOptions{
		MaxJobDuration:      5 * time.Second,
		ShutdownGracePeriod: 500 * time.Millisecond,
		BatchFlushInterval:  0,
	})

	q.jobCh <- models.JobPayload{
		ID:              "job-grace-1",
		StreamName:      "jobs:model:qwen2.5:1.5b",
		StreamMessageID: "1-9",
		Model:           "qwen2.5:1.5b",
		Prompt:          "finish me",
		ReplyToHTTPAddr: "http://127.0.0.1:8088",
	}

	ctx, cancel := context.WithCancel(context.Background())
	stopped := make(chan struct{})
	go func() {
		w.Start(ctx)
		close(stopped)
	}()

	// Wait until job actually enters GenerateStream, then immediately request shutdown.
	<-llm.started
	cancel()

	select {
	case <-stopped:
	case <-time.After(2 * time.Second):
		t.Fatalf("worker did not finish graceful shutdown in time")
	}

	if !q.acked.Load() || len(streamer.received) != 2 || streamer.received[1].Token != "Done" {
		t.Fatalf("expected in-flight job to complete and ack cleanly during grace period, acked=%v chunks=%+v", q.acked.Load(), streamer.received)
	}
}

