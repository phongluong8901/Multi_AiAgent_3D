package webui

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	workerengine "go-distributed-llm/worker/internal/worker"
)

type mockController struct {
	draining     bool
	breakerState string
	synced       bool
}

func (m *mockController) Snapshot(context.Context) workerengine.WorkerSnapshot {
	st := "ONLINE"
	if m.draining {
		st = "DRAINING"
	}
	return workerengine.WorkerSnapshot{
		WorkerID:        "worker-ui-test",
		Status:          st,
		Draining:        m.draining,
		MaxSlots:        4,
		ActiveJobs:      1,
		SupportedModels: []string{"qwen2.5:1.5b"},
		BreakerState:    m.breakerState,
	}
}

func (m *mockController) GetRecentJobs() []workerengine.JobRecord {
	return []workerengine.JobRecord{
		{JobID: "j-1", Model: "qwen2.5:1.5b", Status: "COMPLETED", TokensSent: 42},
	}
}

func (m *mockController) SetDraining(_ context.Context, d bool) error {
	m.draining = d
	return nil
}

func (m *mockController) SyncNow(context.Context) []string {
	m.synced = true
	return []string{"qwen2.5:1.5b", "llama3.2:3b"}
}

func (m *mockController) ResetBreaker() {
	m.breakerState = "CLOSED"
}

func TestWorkerWebUI_EndpointsAndEmbeddedIndex(t *testing.T) {
	ctrl := &mockController{breakerState: "OPEN"}
	srv := NewServer(":0", ctrl, nil)
	handler := srv.routes()

	// 1. Embedded index HTML
	res := httptest.NewRecorder()
	handler.ServeHTTP(res, httptest.NewRequest(http.MethodGet, "/", nil))
	if res.Code != http.StatusOK || !strings.Contains(res.Body.String(), "Worker Node Console") {
		t.Fatalf("expected embedded HTML index, got code=%d len=%d", res.Code, res.Body.Len())
	}

	// 2. GET /api/status
	res = httptest.NewRecorder()
	handler.ServeHTTP(res, httptest.NewRequest(http.MethodGet, "/api/status", nil))
	if res.Code != http.StatusOK || !strings.Contains(res.Body.String(), "worker-ui-test") {
		t.Fatalf("GET /api/status failed: code=%d body=%s", res.Code, res.Body.String())
	}

	// 3. POST /api/drain & /api/resume
	res = httptest.NewRecorder()
	handler.ServeHTTP(res, httptest.NewRequest(http.MethodPost, "/api/drain", nil))
	if res.Code != http.StatusOK || !ctrl.draining {
		t.Fatalf("POST /api/drain failed: code=%d draining=%v", res.Code, ctrl.draining)
	}
	res = httptest.NewRecorder()
	handler.ServeHTTP(res, httptest.NewRequest(http.MethodPost, "/api/resume", nil))
	if res.Code != http.StatusOK || ctrl.draining {
		t.Fatalf("POST /api/resume failed: code=%d draining=%v", res.Code, ctrl.draining)
	}

	// 4. POST /api/models/sync & /api/breaker/reset
	res = httptest.NewRecorder()
	handler.ServeHTTP(res, httptest.NewRequest(http.MethodPost, "/api/models/sync", nil))
	if res.Code != http.StatusOK || !ctrl.synced || !strings.Contains(res.Body.String(), "llama3.2:3b") {
		t.Fatalf("POST /api/models/sync failed: %s", res.Body.String())
	}
	res = httptest.NewRecorder()
	handler.ServeHTTP(res, httptest.NewRequest(http.MethodPost, "/api/breaker/reset", nil))
	if res.Code != http.StatusOK || ctrl.breakerState != "CLOSED" {
		t.Fatalf("POST /api/breaker/reset failed: %s", res.Body.String())
	}
}

