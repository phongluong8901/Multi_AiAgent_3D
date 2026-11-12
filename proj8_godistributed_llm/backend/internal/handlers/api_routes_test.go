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

	"go-distributed-llm/internal/metrics"
	"go-distributed-llm/internal/services"
	"go-distributed-llm/shared/models"

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
func (q *mockQueue) GetDLQLength(context.Context) (int64, error) { return 2, nil }

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
func (b *mockBus) SubscribeCancelAll(context.Context) (<-chan string, error) {
	return make(chan string), nil
}

type mockRegistry struct {
	mu          sync.Mutex
	nodes       []models.WorkerNodeInfo
	draining    map[string]bool
	getCalls    int
}

func (r *mockRegistry) UpdateHeartbeat(context.Context, models.WorkerNodeInfo, time.Duration) error {
	return nil
}
func (r *mockRegistry) GetOnlineNodes(context.Context) ([]models.WorkerNodeInfo, error) {
	r.mu.Lock()
	r.getCalls++
	r.mu.Unlock()
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
func (r *mockRepo) ListConversations(_ context.Context, _ string, _ int) ([]models.Conversation, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	seen := make(map[string]bool)
	var out []models.Conversation
	for _, m := range r.messages {
		if seen[m.ConversationID] {
			continue
		}
		seen[m.ConversationID] = true
		out = append(out, models.Conversation{ID: m.ConversationID, Title: m.Content, CreatedAt: m.CreatedAt})
	}
	return out, nil
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
	m := metrics.NewGatewayMetrics()
	log := slog.New(slog.NewTextHandler(io.Discard, nil))

	chatSvc := services.NewChatService(q, bus, reg, repo, hub, m, "127.0.0.1:50051", "http://127.0.0.1:8088", 0, log)
	adminSvc := services.NewAdminService(q, reg)

	return NewRouter(GatewayRouterDeps{
		ChatService:  chatSvc,
		AdminService: adminSvc,
		Metrics:      m,
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
	router.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/api/v1/chat/conversations", nil))
	if w.Code != http.StatusOK || !strings.Contains(w.Body.String(), `"c-1"`) {
		t.Fatalf("GET /conversations failed: code=%d body=%s", w.Code, w.Body.String())
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

func TestGatewayAPI_RateLimit(t *testing.T) {
	gin.SetMode(gin.TestMode)
	q := &mockQueue{pushed: make(chan models.JobPayload, 1), lengths: map[string]int64{}}
	reg := &mockRegistry{}
	log := slog.New(slog.NewTextHandler(io.Discard, nil))

	chatSvc := services.NewChatService(q, &mockBus{}, reg, nil, services.NewSSEHub(), nil, "", "", 0, log)
	adminSvc := services.NewAdminService(q, reg)

	router := NewRouter(GatewayRouterDeps{
		ChatService:  chatSvc,
		AdminService: adminSvc,
		RateLimitRPM: 2,
	})

	for i := 0; i < 2; i++ {
		w := httptest.NewRecorder()
		router.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/api/v1/admin/nodes", nil))
		if w.Code != http.StatusOK {
			t.Fatalf("request %d expected 200, got %d", i+1, w.Code)
		}
	}

	// 3rd request within the same minute must hit 429 Too Many Requests
	w := httptest.NewRecorder()
	router.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/api/v1/admin/nodes", nil))
	if w.Code != http.StatusTooManyRequests {
		t.Fatalf("3rd request expected 429, got %d", w.Code)
	}
}

func TestGatewayAPI_OpenAICompatOptionsAndPrometheusMetrics(t *testing.T) {
	router, q, _, _ := setupTestRouter("")

	// 1. GET /v1/models
	w := httptest.NewRecorder()
	router.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/v1/models", nil))
	if w.Code != http.StatusOK || !strings.Contains(w.Body.String(), "qwen2.5:1.5b") {
		t.Fatalf("GET /v1/models failed: code=%d body=%s", w.Code, w.Body.String())
	}

	// 2. POST /v1/chat/completions (non-streaming) + system prompt + temperature + max_tokens
	var capturedJob models.JobPayload
	go func() {
		capturedJob = <-q.pushed
		for _, tok := range []models.TokenChunk{
			{JobID: capturedJob.ID, WorkerID: "worker-node-01", Token: "OpenAI ", Done: false},
			{JobID: capturedJob.ID, WorkerID: "worker-node-01", Token: "Compat", Done: true},
		} {
			b, _ := json.Marshal(tok)
			req := httptest.NewRequest(http.MethodPost, "/internal/v1/tokens/push", bytes.NewReader(b))
			req.Header.Set("Content-Type", "application/json")
			router.ServeHTTP(httptest.NewRecorder(), req)
		}
	}()

	reqBody := `{"model":"qwen2.5:1.5b","messages":[{"role":"system","content":"You are terse"},{"role":"user","content":"Say hi"}],"temperature":0.1,"max_tokens":64,"stream":false}`
	req := httptest.NewRequest(http.MethodPost, "/v1/chat/completions", bytes.NewBufferString(reqBody))
	req.Header.Set("Content-Type", "application/json")
	res := httptest.NewRecorder()
	router.ServeHTTP(res, req)

	if res.Code != http.StatusOK || !strings.Contains(res.Body.String(), "OpenAI Compat") || !strings.Contains(res.Body.String(), `"chat.completion"`) {
		t.Fatalf("POST /v1/chat/completions sync failed: code=%d body=%s", res.Code, res.Body.String())
	}
	if len(capturedJob.Messages) != 2 || capturedJob.Messages[0].Role != "system" || capturedJob.Options.Temperature == nil || *capturedJob.Options.Temperature != 0.1 || *capturedJob.Options.MaxTokens != 64 {
		t.Fatalf("expected system message and options forwarded, got %+v", capturedJob)
	}

	// 3. POST /v1/chat/completions (streaming SSE)
	go func() {
		job := <-q.pushed
		b, _ := json.Marshal(models.TokenChunk{JobID: job.ID, WorkerID: "worker-node-01", Token: "Chunk1", Done: true})
		r := httptest.NewRequest(http.MethodPost, "/internal/v1/tokens/push", bytes.NewReader(b))
		r.Header.Set("Content-Type", "application/json")
		router.ServeHTTP(httptest.NewRecorder(), r)
	}()

	sReq := httptest.NewRequest(http.MethodPost, "/v1/chat/completions", bytes.NewBufferString(`{"model":"qwen2.5:1.5b","messages":[{"role":"user","content":"stream"}],"stream":true}`))
	sReq.Header.Set("Content-Type", "application/json")
	sRes := httptest.NewRecorder()
	router.ServeHTTP(sRes, sReq)

	if sRes.Code != http.StatusOK || !strings.Contains(sRes.Body.String(), "chat.completion.chunk") || !strings.Contains(sRes.Body.String(), "data: [DONE]") {
		t.Fatalf("POST /v1/chat/completions stream failed: code=%d body=%s", sRes.Code, sRes.Body.String())
	}

	// 4. GET /metrics (Prometheus exposition)
	mRes := httptest.NewRecorder()
	router.ServeHTTP(mRes, httptest.NewRequest(http.MethodGet, "/metrics", nil))
	mBody := mRes.Body.String()
	if mRes.Code != http.StatusOK || !strings.Contains(mBody, "llm_gateway_requests_total") || !strings.Contains(mBody, "llm_gateway_tokens_total") || !strings.Contains(mBody, "llm_gateway_ttft_ms_sum") {
		t.Fatalf("GET /metrics missing expected series: code=%d body=%s", mRes.Code, mBody)
	}
}

func TestGatewayAPI_FailFastQueueFullAndNodeCache(t *testing.T) {
	gin.SetMode(gin.TestMode)
	q := &mockQueue{
		pushed:  make(chan models.JobPayload, 4),
		lengths: map[string]int64{"qwen2.5:1.5b": 5},
	}
	reg := &mockRegistry{
		nodes: []models.WorkerNodeInfo{
			{WorkerID: "worker-node-01", SupportedModels: []string{"qwen2.5:1.5b"}, MaxSlots: 2, Status: "ONLINE"},
		},
	}
	log := slog.New(slog.NewTextHandler(io.Discard, nil))

	chatSvc := services.NewChatService(q, &mockBus{}, reg, nil, services.NewSSEHub(), nil, "", "", 5, log)
	router := NewRouter(GatewayRouterDeps{
		ChatService:  chatSvc,
		AdminService: services.NewAdminService(q, reg),
	})

	// 1. Fail-fast 429 when queue depth >= max_queue_depth (5 >= 5)
	for i := 0; i < 3; i++ {
		req := httptest.NewRequest(http.MethodPost, "/api/v1/chat", bytes.NewBufferString(`{"model":"qwen2.5:1.5b","prompt":"hi"}`))
		req.Header.Set("Content-Type", "application/json")
		res := httptest.NewRecorder()
		router.ServeHTTP(res, req)
		if res.Code != http.StatusTooManyRequests {
			t.Fatalf("attempt %d expected 429 fail-fast, got %d: %s", i+1, res.Code, res.Body.String())
		}
	}

	// 2. Verify node cache served all 3 checks with only 1 GetOnlineNodes call to registry
	reg.mu.Lock()
	calls := reg.getCalls
	reg.mu.Unlock()
	if calls != 1 {
		t.Fatalf("expected 1 GetOnlineNodes call due to 2s RAM cache, got %d", calls)
	}
}

func TestGatewayAPI_AffinityPriorityTraceAndUnhealthySkip(t *testing.T) {
	gin.SetMode(gin.TestMode)
	q := &mockQueue{pushed: make(chan models.JobPayload, 4), lengths: map[string]int64{}}
	reg := &mockRegistry{
		nodes: []models.WorkerNodeInfo{
			{WorkerID: "worker-alpha", SupportedModels: []string{"qwen2.5:1.5b"}, MaxSlots: 4, ActiveJobs: 1, Status: "ONLINE"},
			{WorkerID: "worker-beta", SupportedModels: []string{"qwen2.5:1.5b"}, MaxSlots: 4, ActiveJobs: 1, Status: "ONLINE"},
			{WorkerID: "worker-down", SupportedModels: []string{"llama3.2:3b"}, MaxSlots: 2, ActiveJobs: 0, Status: "UNHEALTHY"},
		},
	}
	log := slog.New(slog.NewTextHandler(io.Discard, nil))
	m := metrics.NewGatewayMetrics()
	chatSvc := services.NewChatService(q, &mockBus{}, reg, nil, services.NewSSEHub(), m, "127.0.0.1:50051", "http://127.0.0.1:8088", 0, log)
	router := NewRouter(GatewayRouterDeps{
		ChatService:  chatSvc,
		AdminService: services.NewAdminService(q, reg),
		Metrics:      m,
	})

	// 1. Model only on UNHEALTHY worker -> 503
	badReq := httptest.NewRequest(http.MethodPost, "/api/v1/chat", bytes.NewBufferString(`{"model":"llama3.2:3b","prompt":"hi"}`))
	badReq.Header.Set("Content-Type", "application/json")
	badRes := httptest.NewRecorder()
	router.ServeHTTP(badRes, badReq)
	if badRes.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected 503 when only worker is UNHEALTHY, got %d", badRes.Code)
	}

	// 2. Sticky affinity & Priority & TraceID propagated end-to-end
	var firstCaptured models.JobPayload
	go func() {
		firstCaptured = <-q.pushed
		b, _ := json.Marshal(models.TokenChunk{JobID: firstCaptured.ID, WorkerID: firstCaptured.PreferredWorkerID, Token: "ok", Done: true, PromptTokens: 12, CompletionTokens: 8})
		req := httptest.NewRequest(http.MethodPost, "/internal/v1/tokens/push", bytes.NewReader(b))
		req.Header.Set("Content-Type", "application/json")
		router.ServeHTTP(httptest.NewRecorder(), req)
	}()

	req1 := httptest.NewRequest(http.MethodPost, "/api/v1/chat", bytes.NewBufferString(`{"conversation_id":"sticky-conv-42","model":"qwen2.5:1.5b","priority":"high","prompt":"turn1"}`))
	req1.Header.Set("Content-Type", "application/json")
	req1.Header.Set("X-Trace-Id", "trace-xyz-999")
	res1 := httptest.NewRecorder()
	router.ServeHTTP(res1, req1)

	if res1.Code != http.StatusOK || res1.Header().Get("X-Trace-Id") != "trace-xyz-999" {
		t.Fatalf("expected 200 with X-Trace-Id header, got %d header=%q body=%s", res1.Code, res1.Header().Get("X-Trace-Id"), res1.Body.String())
	}
	if firstCaptured.PreferredWorkerID == "" || firstCaptured.Priority != "high" || firstCaptured.TraceID != "trace-xyz-999" {
		t.Fatalf("expected affinity worker, high priority, and trace_id on JobPayload, got %+v", firstCaptured)
	}
	if !strings.Contains(res1.Body.String(), `"prompt_tokens":12`) || !strings.Contains(res1.Body.String(), `"completion_tokens":8`) {
		t.Fatalf("expected real engine token counts in response, got %s", res1.Body.String())
	}

	// 3. DLQ count exposed in /api/v1/admin/queues
	qRes := httptest.NewRecorder()
	router.ServeHTTP(qRes, httptest.NewRequest(http.MethodGet, "/api/v1/admin/queues?models=qwen2.5:1.5b", nil))
	if qRes.Code != http.StatusOK || !strings.Contains(qRes.Body.String(), `"dlq":2`) {
		t.Fatalf("expected dlq count in /admin/queues, got %s", qRes.Body.String())
	}
}

func TestGatewayAPI_InternalTokenAuth(t *testing.T) {
	gin.SetMode(gin.TestMode)
	q := &mockQueue{pushed: make(chan models.JobPayload, 1), lengths: map[string]int64{}}
	reg := &mockRegistry{}
	log := slog.New(slog.NewTextHandler(io.Discard, nil))
	chatSvc := services.NewChatService(q, &mockBus{}, reg, nil, services.NewSSEHub(), nil, "", "", 0, log)
	router := NewRouter(GatewayRouterDeps{
		ChatService:   chatSvc,
		AdminService:  services.NewAdminService(q, reg),
		InternalToken: "worker-shared-secret",
	})

	payload := `{"job_id":"j-1","worker_id":"w-1","token":"hi","done":true}`

	// 1. Missing X-Internal-Token -> 401
	req1 := httptest.NewRequest(http.MethodPost, "/internal/v1/tokens/push", bytes.NewBufferString(payload))
	req1.Header.Set("Content-Type", "application/json")
	w1 := httptest.NewRecorder()
	router.ServeHTTP(w1, req1)
	if w1.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 without internal token, got %d", w1.Code)
	}

	// 2. Valid X-Internal-Token -> 200
	req2 := httptest.NewRequest(http.MethodPost, "/internal/v1/tokens/push", bytes.NewBufferString(payload))
	req2.Header.Set("Content-Type", "application/json")
	req2.Header.Set("X-Internal-Token", "worker-shared-secret")
	w2 := httptest.NewRecorder()
	router.ServeHTTP(w2, req2)
	if w2.Code != http.StatusOK {
		t.Fatalf("expected 200 with valid internal token, got %d: %s", w2.Code, w2.Body.String())
	}
}

