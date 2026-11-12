package webui

import (
	"context"
	"encoding/json"
	"errors"
	"io/fs"
	"log/slog"
	"net/http"
	"strings"
	"time"

	workerengine "go-distributed-llm/worker/internal/worker"
)

// Controller định nghĩa interface tối thiểu từ ClusterWorker phục vụ Local Web UI (:9091).
type Controller interface {
	Snapshot(ctx context.Context) workerengine.WorkerSnapshot
	GetRecentJobs() []workerengine.JobRecord
	SetDraining(ctx context.Context, draining bool) error
	SyncNow(ctx context.Context) []string
	ResetBreaker()
}

// Server nhúng Frontend quản trị cục bộ (go:embed) ngay trong binary Worker.
type Server struct {
	addr       string
	controller Controller
	log        *slog.Logger
	httpServer *http.Server
}

// NewServer khởi tạo HTTP server quản trị cục bộ cho Worker Node (mặc định :9091).
func NewServer(addr string, controller Controller, log *slog.Logger) *Server {
	s := &Server{
		addr:       strings.TrimSpace(addr),
		controller: controller,
		log:        log,
	}
	s.httpServer = &http.Server{
		Addr:              s.addr,
		Handler:           s.routes(),
		ReadHeaderTimeout: 5 * time.Second,
	}
	return s
}

// routes đăng ký các API điều khiển cục bộ (/api/status, /api/jobs, /api/drain, /api/resume, /api/models/sync, /api/breaker/reset)
// cùng file tĩnh của Console UI nhúng qua go:embed.
func (s *Server) routes() http.Handler {
	mux := http.NewServeMux()

	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})

	mux.HandleFunc("GET /api/status", func(w http.ResponseWriter, r *http.Request) {
		snap := s.controller.Snapshot(r.Context())
		writeJSON(w, http.StatusOK, snap)
	})

	mux.HandleFunc("GET /api/jobs", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]any{"jobs": s.controller.GetRecentJobs()})
	})

	mux.HandleFunc("POST /api/drain", func(w http.ResponseWriter, r *http.Request) {
		if err := s.controller.SetDraining(r.Context(), true); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, map[string]string{"status": "DRAINING"})
	})

	mux.HandleFunc("POST /api/resume", func(w http.ResponseWriter, r *http.Request) {
		if err := s.controller.SetDraining(r.Context(), false); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, map[string]string{"status": "ONLINE"})
	})

	mux.HandleFunc("POST /api/models/sync", func(w http.ResponseWriter, r *http.Request) {
		modelsList := s.controller.SyncNow(r.Context())
		snap := s.controller.Snapshot(r.Context())
		writeJSON(w, http.StatusOK, map[string]any{
			"models": modelsList,
			"status": snap.Status,
		})
	})

	mux.HandleFunc("POST /api/breaker/reset", func(w http.ResponseWriter, r *http.Request) {
		s.controller.ResetBreaker()
		writeJSON(w, http.StatusOK, map[string]string{"breaker_state": "CLOSED"})
	})

	sub, err := fs.Sub(staticFS, "static")
	if err == nil {
		mux.Handle("GET /", http.FileServer(http.FS(sub)))
	}

	return mux
}

// Start chạy Local Web UI non-blocking và tự động graceful shutdown khi ctx bị hủy.
func (s *Server) Start(ctx context.Context) {
	if s.addr == "" || strings.EqualFold(s.addr, "disabled") {
		return
	}

	go func() {
		<-ctx.Done()
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
		defer cancel()
		_ = s.httpServer.Shutdown(shutdownCtx)
	}()

	go func() {
		if s.log != nil {
			s.log.Info("worker local Web UI listening", "addr", s.addr)
		}
		if err := s.httpServer.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			if s.log != nil {
				s.log.Warn("worker local Web UI stopped", "addr", s.addr, "err", err)
			}
		}
	}()
}

// writeJSON thiết lập Content-Type JSON và ghi HTTP response cho Local Web UI API.
func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}

