package worker

import (
	"context"
	"io"
	"log/slog"
	"sync/atomic"
	"testing"
	"time"

	"go-distributed-llm/shared/models"
)

type mockQueue struct {
	acked atomic.Bool
}

func (m *mockQueue) PushJob(context.Context, models.JobPayload) error { return nil }
func (m *mockQueue) PullJobFromModels(context.Context, string, string, []string, time.Duration) (*models.JobPayload, error) {
	return nil, nil
}
func (m *mockQueue) AckJob(context.Context, string, string, string) error {
	m.acked.Store(true)
	return nil
}
func (m *mockQueue) AutoClaimJobs(context.Context, string, string, []string, time.Duration, int64) ([]models.JobPayload, error) {
	return nil, nil
}
func (m *mockQueue) GetQueueLength(context.Context, string) (int64, error) { return 0, nil }
func (m *mockQueue) GetDLQLength(context.Context) (int64, error)         { return 0, nil }

type mockBus struct {
	cancelAllCh chan string
}

func (m *mockBus) PublishCancel(context.Context, string) error { return nil }
func (m *mockBus) SubscribeCancelAll(context.Context) (<-chan string, error) {
	return m.cancelAllCh, nil
}

type mockRegistry struct {
	draining atomic.Bool
}

func (m *mockRegistry) UpdateHeartbeat(context.Context, models.WorkerNodeInfo, time.Duration) error {
	return nil
}
func (m *mockRegistry) GetOnlineNodes(context.Context) ([]models.WorkerNodeInfo, error) {
	return nil, nil
}
func (m *mockRegistry) SetNodeDraining(_ context.Context, _ string, d bool) error {
	m.draining.Store(d)
	return nil
}
func (m *mockRegistry) IsNodeDraining(context.Context, string) (bool, error) {
	return m.draining.Load(), nil
}

type mockLLM struct{}

func (m *mockLLM) GenerateStream(_ context.Context, _ string, _ []models.ChatTurn, _ models.GenerationOptions) (<-chan models.TokenChunk, error) {
	ch := make(chan models.TokenChunk, 2)
	go func() {
		defer close(ch)
		ch <- models.TokenChunk{Token: "A"}
		ch <- models.TokenChunk{Token: "B", Done: true}
	}()
	return ch, nil
}

type slowBlockingLLM struct {
	canceled atomic.Bool
}

func (m *slowBlockingLLM) GenerateStream(ctx context.Context, _ string, _ []models.ChatTurn, _ models.GenerationOptions) (<-chan models.TokenChunk, error) {
	ch := make(chan models.TokenChunk, 1)
	go func() {
		defer close(ch)
		<-ctx.Done()
		m.canceled.Store(true)
	}()
	return ch, nil
}

type mockStreamer struct {
	lastTarget string
	received   []models.TokenChunk
}

func (m *mockStreamer) StreamTokens(_ context.Context, target string, chunks <-chan models.TokenChunk) error {
	m.lastTarget = target
	for c := range chunks {
		m.received = append(m.received, c)
	}
	return nil
}

func TestProcessJob_SuccessAndAck(t *testing.T) {
	q := &mockQueue{}
	bus := &mockBus{cancelAllCh: make(chan string)}
	streamer := &mockStreamer{}
	log := slog.New(slog.NewTextHandler(io.Discard, nil))

	w := NewClusterWorker(
		"worker-test",
		"http",
		"group-test",
		[]string{"qwen2.5:1.5b"},
		1,
		5*time.Second,
		q,
		bus,
		&mockRegistry{},
		&mockLLM{},
		streamer,
		log,
	)

	job := models.JobPayload{
		ID:              "job-1",
		StreamName:      "jobs:model:qwen2.5:1.5b",
		StreamMessageID: "1-0",
		Model:           "qwen2.5:1.5b",
		Prompt:          "hello",
		ReplyToGrpcAddr: "127.0.0.1:50051",
		ReplyToHTTPAddr: "http://127.0.0.1:8088",
	}

	w.processJob(context.Background(), job)

	if !q.acked.Load() {
		t.Fatalf("expected job to be Acked")
	}
	if streamer.lastTarget != "http://127.0.0.1:8088" {
		t.Fatalf("expected HTTP reply addr when transportMode=http, got %q", streamer.lastTarget)
	}
	if len(streamer.received) != 2 {
		t.Fatalf("expected 2 chunks streamed, got %d", len(streamer.received))
	}
	if streamer.received[0].WorkerID != "worker-test" || streamer.received[1].Done != true {
		t.Fatalf("unexpected streamed chunk metadata: %+v", streamer.received)
	}
}

func TestWorker_SingleChannelCancelDispatcher(t *testing.T) {
	q := &mockQueue{}
	bus := &mockBus{cancelAllCh: make(chan string, 4)}
	llm := &slowBlockingLLM{}
	streamer := &mockStreamer{}
	log := slog.New(slog.NewTextHandler(io.Discard, nil))

	w := NewClusterWorker(
		"worker-test",
		"http",
		"group-test",
		[]string{"qwen2.5:1.5b"},
		1,
		5*time.Second,
		q,
		bus,
		&mockRegistry{},
		llm,
		streamer,
		log,
	)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	go w.runCancelDispatcher(ctx)

	done := make(chan struct{})
	go func() {
		w.processJob(ctx, models.JobPayload{
			ID:              "job-cancel-1",
			StreamName:      "jobs:model:qwen2.5:1.5b",
			StreamMessageID: "1-1",
			Model:           "qwen2.5:1.5b",
			Prompt:          "long task",
			ReplyToHTTPAddr: "http://127.0.0.1:8088",
		})
		close(done)
	}()

	time.Sleep(30 * time.Millisecond)
	bus.cancelAllCh <- "job-cancel-1"

	select {
	case <-done:
	case <-time.After(2 * time.Second):
		t.Fatalf("job was not canceled by single-channel dispatcher")
	}

	if !llm.canceled.Load() || !q.acked.Load() {
		t.Fatalf("expected LLM context canceled (%v) and job acked (%v)", llm.canceled.Load(), q.acked.Load())
	}
}

