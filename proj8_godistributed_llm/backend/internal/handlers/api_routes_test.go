package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"go-distributed-llm/internal/models"
	"go-distributed-llm/internal/services"

	"github.com/gin-gonic/gin"
)

type mockQueue struct {
	pushed  chan models.JobPayload
	lengths map[string]int64
}

func (q *mockQueue) PushJob(_ context.Context, job models.JobPayload) error {
	q.pushed <- job
	return nil
}
func (q *mockQueue) PullJobFromModels(context.Context, string, string, []string, time.Duration) (*models.JobPayload, error) {
	return nil, nil
}
func (q *mockQueue) AckJob(context.Context, string, string, string) error { return nil }
func (q *mockQueue) AutoClaimJobs(context.Context, string, string, []string, time.Duration, int64) ([]models.JobPayload, error) {
	return nil, nil
}
func (q *mockQueue) GetQueueLength(_ context.Context, model string) (int64, error) {
	return q.lengths[model], nil
}

type mockBus struct {
	mu          sync.Mutex
	canceledIDs []string
}

func (b *mockBus) PublishCancel(_ context.Context, jobID string) error {
	b.mu.Lock()
	b.canceledIDs = append(b.canceledIDs, jobID)
	b.mu.Unlock()
	return nil
}
func (b *mockBus) SubscribeCancel(context.Context, string) <-chan struct{} {
	return make(chan struct{})
}

type mockRegistry struct {
	mu       sync.Mutex
	nodes    []models.WorkerNodeInfo
	draining map[string]bool
}

func (r *mockRegistry) UpdateHeartbeat(context.Context, models.WorkerNodeInfo, time.Duration) error {
	return nil
}
func (r *mockRegistry) GetOnlineNodes(context.Context) ([]models.WorkerNodeInfo, error) {
	return r.nodes, nil
}
func (r *mockRegistry) SetNodeDraining(_ context.Context, workerID string, draining bool) error {
	r.mu.Lock()
	if r.draining == nil {
		r.draining = make(map[string]bool)
	}
	r.draining[workerID] = draining
	r.mu.Unlock()
	return nil
}
func (r *mockRegistry) IsNodeDraining(_ context.Context, workerID string) (bool, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	return r.draining[workerID], nil
}

type mockRepo struct {
	mu       sync.Mutex
	messages []models.Message
	usages   []models.UsageLog
}

func (r *mockRepo) SaveMessage(_ context.Context, msg models.Message) error {
	r.mu.Lock()
	r.messages = append(r.messages, msg)
	r.mu.Unlock()
	return nil
}
func (r *mockRepo) GetHistory(_ context.Context, convID string, _ int) ([]models.Message, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	var out []models.Message
	for _, m := range r.messages {
		if m.ConversationID == convID {
			out = append(out, m)
		}
	}
	return out, nil
}
func (r *mockRepo) LogUsage(_ context.Context, u models.UsageLog) error {
	r.mu.Lock()
	r.usages = append(r.usages, u)
	r.mu.Unlock()
	return nil
}

func setupTestRouter(apiKey string) (*gin.Engine, *mockQueue, *mockBus, *mockRepo) {
	gin.SetMode(gin.TestMode)
	q := &mockQueue{
		pushed:  make(chan models.JobPayload, 4),
		lengths: map[string]int64{"qwen2.5:1.5b": 3, "llama3.2:3b": 1},
	}
	bus := &mockBus{}
	reg := &mockRegistry{
		nodes: []models.WorkerNodeInfo{
			{WorkerID: "worker-node-01", SupportedModels: []string{"qwen2.5:1.5b"}, MaxSlots: 2, ActiveJobs: 1, Status: "ONLINE"},
		},
	}
	repo := &mockRepo{}
	hub := services.NewSSEHub()
	log := slog.New(slog.NewTextHandler(io.Discard, nil))

	chatSvc := services.NewChatService(q, bus, reg, repo, hub, "127.0.0.1:50051", "http://127.0.0.1:8088", log)
	adminSvc := services.NewAdminService(q, reg)

	return NewRouter(GatewayRouterDeps{
		ChatService:  chatSvc,
		AdminService: adminSvc,
		APIKey:       apiKey,
	}), q, bus, repo
}

func TestGatewayAPI_HealthAdminStopHistoryAndSSE(t *testing.T) {
	router, q, bus, repo := setupTestRouter("")

	w := httptest.NewRecorder()
	router.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/healthz", nil))
	if w.Code != http.StatusOK {
		t.Fatalf("GET /healthz expected 200, got %d", w.Code)
	}

	w = httptest.NewRecorder()
	router.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/api/v1/admin/nodes", nil))
	if w.Code != http.StatusOK || !strings.Contains(w.Body.String(), "worker-node-01") {
		t.Fatalf("GET /admin/nodes failed: code=%d body=%s", w.Code, w.Body.String())
	}

	w = httptest.NewRecorder()
	router.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/api/v1/admin/queues?models=qwen2.5:1.5b,llama3.2:3b", nil))
	if w.Code != http.StatusOK || !strings.Contains(w.Body.String(), `"qwen2.5:1.5b":3`) {
		t.Fatalf("GET /admin/queues failed: code=%d body=%s", w.Code, w.Body.String())
	}

	go func() {
		job := <-q.pushed
		for _, chunk := range []models.TokenChunk{
			{JobID: job.ID, WorkerID: "worker-node-01", Token: "Go ", Done: false},
			{JobID: job.ID, WorkerID: "worker-node-01", Token: "rocks", Done: true},
		} {
			b, _ := json.Marshal(chunk)
			req := httptest.NewRequest(http.MethodPost, "/internal/v1/tokens/push", bytes.NewReader(b))
			req.Header.Set("Content-Type", "application/json")
			rec := httptest.NewRecorder()
			router.ServeHTTP(rec, req)
			if rec.Code != http.StatusOK {
				t.Errorf("POST /internal/v1/tokens/push expected 200, got %d", rec.Code)
			}
		}
	}()

	sseReq := httptest.NewRequest(http.MethodPost, "/api/v1/chat/stream", bytes.NewBufferString(`{"conversation_id":"c-1","model":"qwen2.5:1.5b","prompt":"hello"}`))
	sseReq.Header.Set("Content-Type", "application/json")
	sseRes := httptest.NewRecorder()
	router.ServeHTTP(sseRes, sseReq)

	if sseRes.Code != http.StatusOK || !strings.Contains(sseRes.Body.String(), "Go ") || !strings.Contains(sseRes.Body.String(), "rocks") {
		t.Fatalf("POST /chat/stream failed: code=%d body=%s", sseRes.Code, sseRes.Body.String())
	}

	if len(repo.messages) != 2 || len(repo.usages) != 1 {
		t.Fatalf("expected 2 saved messages and 1 usage log, got msgs=%d usages=%d", len(repo.messages), len(repo.usages))
	}

	w = httptest.NewRecorder()
	router.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/api/v1/chat/c-1/history", nil))
	if w.Code != http.StatusOK || !strings.Contains(w.Body.String(), "Go rocks") {
		t.Fatalf("GET /history failed: code=%d body=%s", w.Code, w.Body.String())
	}

	w = httptest.NewRecorder()
	router.ServeHTTP(w, httptest.NewRequest(http.MethodPost, "/api/v1/chat/job-xyz/stop", nil))
	if w.Code != http.StatusOK || len(bus.canceledIDs) != 1 || bus.canceledIDs[0] != "job-xyz" {
		t.Fatalf("POST /stop failed: code=%d canceled=%v", w.Code, bus.canceledIDs)
	}

	w = httptest.NewRecorder()
	router.ServeHTTP(w, httptest.NewRequest(http.MethodPost, "/api/v1/admin/nodes/worker-node-01/drain", nil))
	if w.Code != http.StatusOK || !strings.Contains(w.Body.String(), "DRAINING") {
		t.Fatalf("POST /drain failed: code=%d body=%s", w.Code, w.Body.String())
	}

	w = httptest.NewRecorder()
	router.ServeHTTP(w, httptest.NewRequest(http.MethodPost, "/api/v1/admin/nodes/worker-node-01/resume", nil))
	if w.Code != http.StatusOK || !strings.Contains(w.Body.String(), "ONLINE") {
		t.Fatalf("POST /resume failed: code=%d body=%s", w.Code, w.Body.String())
	}
}

func TestGatewayAPI_ChatSyncWithHTTPInternalStream(t *testing.T) {
	router, q, _, _ := setupTestRouter("")

	go func() {
		job := <-q.pushed
		ndjson := `{"job_id":"` + job.ID + `","worker_id":"http-worker-1","token":"Hello ","done":false}` + "\n" +
			`{"job_id":"` + job.ID + `","worker_id":"http-worker-1","token":"HTTP","done":true}` + "\n"
		req := httptest.NewRequest(http.MethodPost, "/internal/v1/tokens/stream", bytes.NewBufferString(ndjson))
		req.Header.Set("Content-Type", "application/x-ndjson")
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)
		if rec.Code != http.StatusOK {
			t.Errorf("expected 200 from /internal/v1/tokens/stream, got %d", rec.Code)
		}
	}()

	req := httptest.NewRequest(http.MethodPost, "/api/v1/chat", bytes.NewBufferString(`{"model":"qwen2.5:1.5b","prompt":"hi"}`))
	req.Header.Set("Content-Type", "application/json")
	res := httptest.NewRecorder()
	router.ServeHTTP(res, req)

	if res.Code != http.StatusOK {
		t.Fatalf("expected 200 from /api/v1/chat, got %d: %s", res.Code, res.Body.String())
	}
	var payload map[string]any
	if err := json.Unmarshal(res.Body.Bytes(), &payload); err != nil {
		t.Fatalf("invalid json response: %v", err)
	}
	if payload["answer"] != "Hello HTTP" || payload["worker_id"] != "http-worker-1" {
		t.Fatalf("unexpected ChatSync response: %+v", payload)
	}
}

func TestGatewayAPI_OptionalAPIKeyAuth(t *testing.T) {
	router, _, _, _ := setupTestRouter("secret-token-123")

	w := httptest.NewRecorder()
	router.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/healthz", nil))
	if w.Code != http.StatusOK {
		t.Fatalf("expected /healthz 200 without auth, got %d", w.Code)
	}

	w = httptest.NewRecorder()
	router.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/api/v1/admin/nodes", nil))
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 without API key, got %d", w.Code)
	}

	req := httptest.NewRequest(http.MethodGet, "/api/v1/admin/nodes", nil)
	req.Header.Set("X-API-Key", "secret-token-123")
	w = httptest.NewRecorder()
	router.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200 with X-API-Key, got %d", w.Code)
	}

	req2 := httptest.NewRequest(http.MethodGet, "/api/v1/admin/nodes", nil)
	req2.Header.Set("Authorization", "Bearer secret-token-123")
	w = httptest.NewRecorder()
	router.ServeHTTP(w, req2)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200 with Bearer token, got %d", w.Code)
	}
}

func TestGatewayAPI_MultiTurnContextAndUnavailableModel(t *testing.T) {
	router, q, _, repo := setupTestRouter("")

	// Seed prior conversation history
	_ = repo.SaveMessage(context.Background(), models.Message{
		ID: "m1", ConversationID: "conv-mt", JobID: "j0", Role: "user", Model: "qwen2.5:1.5b", Content: "What is Go?",
	})
	_ = repo.SaveMessage(context.Background(), models.Message{
		ID: "m2", ConversationID: "conv-mt", JobID: "j0", Role: "assistant", Model: "qwen2.5:1.5b", Content: "A compiled language.",
	})

	// 1. Unsupported model returns 503 immediately without hanging
	badReq := httptest.NewRequest(http.MethodPost, "/api/v1/chat", bytes.NewBufferString(`{"model":"nonexistent:99b","prompt":"hi"}`))
	badReq.Header.Set("Content-Type", "application/json")
	badRes := httptest.NewRecorder()
	router.ServeHTTP(badRes, badReq)
	if badRes.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected 503 for unsupported model, got %d: %s", badRes.Code, badRes.Body.String())
	}

	// 2. Multi-turn conversation includes prior 2 messages + current prompt (3 turns total)
	var capturedJob models.JobPayload
	go func() {
		capturedJob = <-q.pushed
		b, _ := json.Marshal(models.TokenChunk{JobID: capturedJob.ID, WorkerID: "worker-node-01", Token: "Fast!", Done: true})
		req := httptest.NewRequest(http.MethodPost, "/internal/v1/tokens/push", bytes.NewReader(b))
		req.Header.Set("Content-Type", "application/json")
		router.ServeHTTP(httptest.NewRecorder(), req)
	}()

	okReq := httptest.NewRequest(http.MethodPost, "/api/v1/chat", bytes.NewBufferString(`{"conversation_id":"conv-mt","model":"qwen2.5:1.5b","prompt":"Why use it?"}`))
	okReq.Header.Set("Content-Type", "application/json")
	okRes := httptest.NewRecorder()
	router.ServeHTTP(okRes, okReq)

	if okRes.Code != http.StatusOK {
		t.Fatalf("expected 200 for multi-turn chat, got %d: %s", okRes.Code, okRes.Body.String())
	}
	if len(capturedJob.Messages) != 3 || capturedJob.Messages[0].Content != "What is Go?" || capturedJob.Messages[2].Content != "Why use it?" {
		t.Fatalf("expected 3 multi-turn messages in JobPayload, got %+v", capturedJob.Messages)
	}
}

