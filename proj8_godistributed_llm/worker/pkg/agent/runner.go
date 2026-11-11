package agent

import (
	"context"
	"fmt"
	"log/slog"
	"strings"
	"sync"
	"time"

	"go-distributed-llm/shared/pkg/config"
	"go-distributed-llm/shared/ports"
	redisrepo "go-distributed-llm/shared/repositories/redis"
	grpcclient "go-distributed-llm/worker/internal/clients/grpc"
	httpclient "go-distributed-llm/worker/internal/clients/http"
	llmclient "go-distributed-llm/worker/internal/clients/llm"
	"go-distributed-llm/worker/internal/webui"
	workerengine "go-distributed-llm/worker/internal/worker"
)

type JobRecord = workerengine.JobRecord
type WorkerSnapshot = workerengine.WorkerSnapshot

// Runner quản lý vòng đời đầy đủ của một Worker Node (Redis + LLM Engine + Token Streamer + Local Web UI),
// được dùng chung bởi cả CLI worker/cmd/worker lẫn ứng dụng PC Wails frontend-worker.
type Runner struct {
	mu      sync.Mutex
	running bool
	cancel  context.CancelFunc
	done    chan struct{}
	worker  *workerengine.ClusterWorker
	logBuf  *LogBuffer
	log     *slog.Logger
}

func NewRunner() *Runner {
	buf := NewLogBuffer()
	return &Runner{
		logBuf: buf,
		log:    NewTeeLogger("worker", buf),
	}
}

func (r *Runner) Start(parentCtx context.Context, cfg *config.WorkerConfig) error {
	r.mu.Lock()
	if r.running {
		r.mu.Unlock()
		return fmt.Errorf("worker is already running")
	}

	rdb, err := redisrepo.NewRedisClient(cfg.Redis.Addr, cfg.Redis.MasterName, cfg.Redis.Password, cfg.Redis.DB)
	if err != nil {
		r.mu.Unlock()
		return err
	}

	llmTimeout := time.Duration(cfg.LLM.TimeoutSec) * time.Second
	llmProvider, err := llmclient.NewLLMProvider(cfg.LLM.Provider, cfg.LLM.BaseURL, llmTimeout)
	if err != nil {
		_ = rdb.Close()
		r.mu.Unlock()
		return err
	}

	var streamer ports.TokenStreamer
	var closeStreamer func()
	transportMode := strings.ToLower(strings.TrimSpace(cfg.Worker.Transport))
	if transportMode == "http" {
		streamer = httpclient.NewHTTPTokenClient(llmTimeout + 30*time.Second)
		closeStreamer = func() {}
	} else {
		transportMode = "grpc"
		grpcPool, grpcErr := grpcclient.NewGrpcClientPool(cfg.Worker.GRPCTLSCA)
		if grpcErr != nil {
			_ = rdb.Close()
			r.mu.Unlock()
			return grpcErr
		}
		streamer = grpcPool
		closeStreamer = grpcPool.Close
	}

	queue := redisrepo.NewRedisStreamQueue(rdb)
	pubsub := redisrepo.NewRedisEventBus(rdb)
	registry := redisrepo.NewRedisNodeRegistry(rdb)

	hbInterval := time.Duration(cfg.Worker.HeartbeatIntervalSec) * time.Second
	cw := workerengine.NewClusterWorker(
		cfg.Worker.ID,
		transportMode,
		cfg.Redis.ConsumerGroup,
		cfg.Worker.SupportedModels,
		cfg.Worker.MaxParallelJobs,
		hbInterval,
		queue,
		pubsub,
		registry,
		llmProvider,
		streamer,
		r.log,
	)
	cw.Configure(workerengine.WorkerOptions{
		MaxJobDuration:     time.Duration(cfg.Worker.MaxJobDurationSec) * time.Second,
		BatchFlushInterval: time.Duration(cfg.Worker.BatchFlushMs) * time.Millisecond,
		DynamicModelSync:   cfg.Worker.DynamicModelSync,
		LLMProviderName:    cfg.LLM.Provider,
		LLMBaseURL:         cfg.LLM.BaseURL,
		RedisAddr:          cfg.Redis.Addr,
	})

	runCtx, cancel := context.WithCancel(parentCtx)
	doneCh := make(chan struct{})

	r.worker = cw
	r.cancel = cancel
	r.done = doneCh
	r.running = true
	r.mu.Unlock()

	uiServer := webui.NewServer(cfg.Worker.UIAddr, cw, r.log)
	uiServer.Start(runCtx)

	r.log.Info("starting worker node",
		"worker_id", cfg.Worker.ID,
		"ui_addr", cfg.Worker.UIAddr,
		"transport", transportMode,
		"provider", cfg.LLM.Provider,
		"llm_url", cfg.LLM.BaseURL,
		"models", cfg.Worker.SupportedModels,
		"max_slots", cfg.Worker.MaxParallelJobs,
	)

	go func() {
		defer close(doneCh)
		defer closeStreamer()
		defer func() { _ = rdb.Close() }()

		cw.Start(runCtx)
		r.log.Info("worker node stopped cleanly", "worker_id", cfg.Worker.ID)

		r.mu.Lock()
		r.running = false
		r.mu.Unlock()
	}()

	return nil
}

func (r *Runner) Stop() {
	r.mu.Lock()
	if !r.running || r.cancel == nil {
		r.mu.Unlock()
		return
	}
	cancel := r.cancel
	done := r.done
	r.mu.Unlock()

	cancel()
	<-done
}

func (r *Runner) Wait() {
	r.mu.Lock()
	done := r.done
	r.mu.Unlock()
	if done != nil {
		<-done
	}
}

func (r *Runner) IsRunning() bool {
	r.mu.Lock()
	defer r.mu.Unlock()
	return r.running
}

func (r *Runner) Snapshot(ctx context.Context) (WorkerSnapshot, bool) {
	r.mu.Lock()
	cw := r.worker
	running := r.running
	r.mu.Unlock()

	if !running || cw == nil {
		return WorkerSnapshot{Status: "STOPPED"}, false
	}
	return cw.Snapshot(ctx), true
}

func (r *Runner) SetDraining(ctx context.Context, draining bool) error {
	r.mu.Lock()
	cw := r.worker
	running := r.running
	r.mu.Unlock()
	if !running || cw == nil {
		return fmt.Errorf("worker is not running")
	}
	return cw.SetDraining(ctx, draining)
}

func (r *Runner) SyncModels(ctx context.Context) ([]string, error) {
	r.mu.Lock()
	cw := r.worker
	running := r.running
	r.mu.Unlock()
	if !running || cw == nil {
		return nil, fmt.Errorf("worker is not running")
	}
	return cw.SyncNow(ctx), nil
}

func (r *Runner) ResetBreaker() error {
	r.mu.Lock()
	cw := r.worker
	running := r.running
	r.mu.Unlock()
	if !running || cw == nil {
		return fmt.Errorf("worker is not running")
	}
	cw.ResetBreaker()
	return nil
}

func (r *Runner) Logs() []LogEntry {
	return r.logBuf.List()
}

func (r *Runner) ClearLogs() {
	r.logBuf.Clear()
}

// CheckEngineHealth cho phép kiểm tra kết nối tới Ollama/vLLM/llama.cpp trực tiếp từ Desktop App.
func CheckEngineHealth(ctx context.Context, provider string, baseURL string) ([]string, error) {
	p, err := llmclient.NewLLMProvider(provider, baseURL, 4*time.Second)
	if err != nil {
		return nil, err
	}
	if hc, ok := p.(ports.HealthChecker); ok {
		if err := hc.CheckHealth(ctx); err != nil {
			return nil, err
		}
	}
	if md, ok := p.(ports.ModelDiscoverer); ok {
		if list, err := md.ListModels(ctx); err == nil {
			return list, nil
		}
	}
	return nil, nil
}

