package main

import (
	"context"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"go-distributed-llm/shared/pkg/config"
	"go-distributed-llm/shared/pkg/utils"
	"go-distributed-llm/worker/pkg/agent"

	"gopkg.in/yaml.v3"
)

// WorkerConfigDTO biểu diễn cấu hình YAML để React Settings form đọc/lưu trực tiếp.
type WorkerConfigDTO struct {
	WorkerID             string   `json:"worker_id"`
	UIAddr               string   `json:"ui_addr"`
	Transport            string   `json:"transport"`
	InternalToken        string   `json:"internal_token"`
	GRPCTLSCA            string   `json:"grpc_tls_ca"`
	MaxParallelJobs      int      `json:"max_parallel_jobs"`
	SupportedModels      []string `json:"supported_models"`
	HeartbeatIntervalSec int      `json:"heartbeat_interval_sec"`
	MaxJobDurationSec    int      `json:"max_job_duration_sec"`
	ShutdownGraceSec     int      `json:"shutdown_grace_sec"`
	BatchFlushMs         int      `json:"batch_flush_ms"`
	DynamicModelSync     bool     `json:"dynamic_model_sync"`
	LLMProvider          string   `json:"llm_provider"`
	LLMBaseURL           string   `json:"llm_base_url"`
	LLMTimeoutSec        int      `json:"llm_timeout_sec"`
	RedisAddr            string   `json:"redis_addr"`
	RedisMasterName      string   `json:"redis_master_name"`
	RedisPassword        string   `json:"redis_password"`
	RedisDB              int      `json:"redis_db"`
	ConsumerGroup        string   `json:"consumer_group"`
}

// EngineCheckResult chứa kết quả kiểm tra kết nối tới LLM Engine cục bộ từ màn hình Settings.
type EngineCheckResult struct {
	OK     bool     `json:"ok"`
	Models []string `json:"models"`
	Error  string   `json:"error,omitempty"`
}

// DesktopState là trạng thái tổng hợp trả về cho React UI sau mỗi lần poll hoặc thao tác điều khiển.
type DesktopState struct {
	Running    bool                 `json:"running"`
	ConfigPath string               `json:"config_path"`
	LastError  string               `json:"last_error,omitempty"`
	Config     WorkerConfigDTO      `json:"config"`
	Snapshot   agent.WorkerSnapshot `json:"snapshot"`
	Logs       []agent.LogEntry     `json:"logs"`
}

// App là Wails Service Controller làm cầu nối giữa giao diện React Desktop và agent.Runner ở tầng Go.
type App struct {
	ctx        context.Context
	mu         sync.Mutex
	runner     *agent.Runner
	configPath string
	cfg        *config.WorkerConfig
	lastError  string
}

// NewApp tìm đường dẫn file cấu hình worker.yaml mặc định, nạp cấu hình ban đầu và khởi tạo agent.Runner.
func NewApp() *App {
	cfgPath := resolveDefaultConfigPath()
	cfg, err := config.LoadWorkerConfig(cfgPath)
	if err != nil {
		cfg, _ = config.LoadWorkerConfig("")
	}
	return &App{
		runner:     agent.NewRunner(),
		configPath: cfgPath,
		cfg:        cfg,
	}
}

// --- Cụm Wails Lifecycle Hooks & Helpers chuyển đổi Config <-> DTO ---

// startup được Wails gọi lúc ứng dụng mở lên để lưu runtime context.
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
}

// shutdown tự động dừng Worker Node an toàn (kích hoạt Graceful Shutdown) khi user đóng cửa sổ app.
func (a *App) shutdown(_ context.Context) {
	a.runner.Stop()
}

// resolveDefaultConfigPath tự động dò file worker.yaml ở thư mục hiện tại, ./configs hoặc ../worker/configs.
func resolveDefaultConfigPath() string {
	candidates := []string{
		"worker.yaml",
		filepath.Join("configs", "worker.yaml"),
		filepath.Join("..", "worker", "configs", "worker.yaml"),
	}
	for _, p := range candidates {
		if _, err := os.Stat(p); err == nil {
			if abs, absErr := filepath.Abs(p); absErr == nil {
				return abs
			}
			return p
		}
	}
	abs, err := filepath.Abs(filepath.Join("..", "worker", "configs", "worker.yaml"))
	if err == nil {
		return abs
	}
	return "worker.yaml"
}

// effectiveCtx trả về Wails runtime context (hoặc Background khi chạy unit test không qua UI).
func (a *App) effectiveCtx() context.Context {
	if a.ctx != nil {
		return a.ctx
	}
	return context.Background()
}

// toConfigDTO chuyển config.WorkerConfig nội bộ sang WorkerConfigDTO phẳng để React UI dễ bind form.
func toConfigDTO(cfg *config.WorkerConfig) WorkerConfigDTO {
	modelsCopy := make([]string, len(cfg.Worker.SupportedModels))
	copy(modelsCopy, cfg.Worker.SupportedModels)
	return WorkerConfigDTO{
		WorkerID:             cfg.Worker.ID,
		UIAddr:               cfg.Worker.UIAddr,
		Transport:            cfg.Worker.Transport,
		InternalToken:        cfg.Worker.InternalToken,
		GRPCTLSCA:            cfg.Worker.GRPCTLSCA,
		MaxParallelJobs:      cfg.Worker.MaxParallelJobs,
		SupportedModels:      modelsCopy,
		HeartbeatIntervalSec: cfg.Worker.HeartbeatIntervalSec,
		MaxJobDurationSec:    cfg.Worker.MaxJobDurationSec,
		ShutdownGraceSec:     cfg.Worker.ShutdownGraceSec,
		BatchFlushMs:         cfg.Worker.BatchFlushMs,
		DynamicModelSync:     cfg.Worker.DynamicModelSync,
		LLMProvider:          cfg.LLM.Provider,
		LLMBaseURL:           cfg.LLM.BaseURL,
		LLMTimeoutSec:        cfg.LLM.TimeoutSec,
		RedisAddr:            cfg.Redis.Addr,
		RedisMasterName:      cfg.Redis.MasterName,
		RedisPassword:        cfg.Redis.Password,
		RedisDB:              cfg.Redis.DB,
		ConsumerGroup:        cfg.Redis.ConsumerGroup,
	}
}

// applyDTO validate và ghi ngược các thay đổi từ React Settings form vào struct WorkerConfig.
func applyDTO(cfg *config.WorkerConfig, dto WorkerConfigDTO) {
	if id := strings.TrimSpace(dto.WorkerID); id != "" {
		cfg.Worker.ID = id
	}
	cfg.Worker.UIAddr = strings.TrimSpace(dto.UIAddr)
	if tr := strings.ToLower(strings.TrimSpace(dto.Transport)); tr == "http" || tr == "grpc" {
		cfg.Worker.Transport = tr
	}
	cfg.Worker.InternalToken = strings.TrimSpace(dto.InternalToken)
	cfg.Worker.GRPCTLSCA = strings.TrimSpace(dto.GRPCTLSCA)
	if dto.MaxParallelJobs > 0 {
		cfg.Worker.MaxParallelJobs = dto.MaxParallelJobs
	}
	var cleanedModels []string
	for _, m := range dto.SupportedModels {
		if t := strings.TrimSpace(m); t != "" {
			cleanedModels = append(cleanedModels, t)
		}
	}
	if len(cleanedModels) > 0 {
		cfg.Worker.SupportedModels = cleanedModels
	}
	if dto.HeartbeatIntervalSec > 0 {
		cfg.Worker.HeartbeatIntervalSec = dto.HeartbeatIntervalSec
	}
	if dto.MaxJobDurationSec >= 0 {
		cfg.Worker.MaxJobDurationSec = dto.MaxJobDurationSec
	}
	if dto.ShutdownGraceSec >= 0 {
		cfg.Worker.ShutdownGraceSec = dto.ShutdownGraceSec
	}
	if dto.BatchFlushMs >= 0 {
		cfg.Worker.BatchFlushMs = dto.BatchFlushMs
	}
	cfg.Worker.DynamicModelSync = dto.DynamicModelSync

	if p := strings.TrimSpace(dto.LLMProvider); p != "" {
		cfg.LLM.Provider = p
	}
	if u := strings.TrimSpace(dto.LLMBaseURL); u != "" {
		cfg.LLM.BaseURL = u
	}
	if dto.LLMTimeoutSec > 0 {
		cfg.LLM.TimeoutSec = dto.LLMTimeoutSec
	}
	if ra := strings.TrimSpace(dto.RedisAddr); ra != "" {
		cfg.Redis.Addr = ra
	}
	cfg.Redis.MasterName = strings.TrimSpace(dto.RedisMasterName)
	cfg.Redis.Password = dto.RedisPassword
	cfg.Redis.DB = dto.RedisDB
	if cg := strings.TrimSpace(dto.ConsumerGroup); cg != "" {
		cfg.Redis.ConsumerGroup = cg
	}
}

// --- Cụm RPC Methods expose ra Frontend Wails (Bindings) ---

// GetState thu thập Snapshot Worker (hoặc thông số host hiện tại nếu đang STOPPED), Config DTO và Logs mới nhất.
func (a *App) GetState() DesktopState {
	a.mu.Lock()
	cfgCopy := *a.cfg
	cfgPath := a.configPath
	lastErr := a.lastError
	a.mu.Unlock()

	snap, running := a.runner.Snapshot(a.effectiveCtx())
	if !running {
		host := utils.CollectHostMetrics()
		snap = agent.WorkerSnapshot{
			WorkerID:          cfgCopy.Worker.ID,
			Status:            "STOPPED",
			Transport:         cfgCopy.Worker.Transport,
			ConsumerGroup:     cfgCopy.Redis.ConsumerGroup,
			LLMProvider:       cfgCopy.LLM.Provider,
			LLMBaseURL:        cfgCopy.LLM.BaseURL,
			RedisAddr:         cfgCopy.Redis.Addr,
			MaxSlots:          cfgCopy.Worker.MaxParallelJobs,
			SupportedModels:   cfgCopy.Worker.SupportedModels,
			DynamicModelSync:  cfgCopy.Worker.DynamicModelSync,
			MaxJobDurationSec: cfgCopy.Worker.MaxJobDurationSec,
			BatchFlushMs:      cfgCopy.Worker.BatchFlushMs,
			BreakerState:      "CLOSED",
			BreakerThreshold:  3,
			CPUPercent:        host.CPUPercent,
			RAMPercent:        host.RAMPercent,
			GPUVRAMPercent:    host.GPUVRAMPercent,
		}
	}

	return DesktopState{
		Running:    running,
		ConfigPath: cfgPath,
		LastError:  lastErr,
		Config:     toConfigDTO(&cfgCopy),
		Snapshot:   snap,
		Logs:       a.runner.Logs(),
	}
}

// StartWorker khởi chạy Worker Node nền bằng cấu hình hiện tại.
func (a *App) StartWorker() DesktopState {
	a.mu.Lock()
	cfgCopy := *a.cfg
	a.lastError = ""
	a.mu.Unlock()

	if err := a.runner.Start(a.effectiveCtx(), &cfgCopy); err != nil {
		a.mu.Lock()
		a.lastError = err.Error()
		a.mu.Unlock()
	}
	return a.GetState()
}

// StopWorker dừng Worker Node (chờ drain job trong khoảng shutdown_grace_sec).
func (a *App) StopWorker() DesktopState {
	a.runner.Stop()
	a.mu.Lock()
	a.lastError = ""
	a.mu.Unlock()
	return a.GetState()
}

// RestartWorker khởi động lại Worker Node (thường dùng sau khi lưu cấu hình mới).
func (a *App) RestartWorker() DesktopState {
	a.runner.Stop()
	return a.StartWorker()
}

// DrainNode bật chế độ bảo trì DRAINING để Worker hoàn tất job đang chạy và ngừng nhận thêm job.
func (a *App) DrainNode() DesktopState {
	if err := a.runner.SetDraining(a.effectiveCtx(), true); err != nil {
		a.mu.Lock()
		a.lastError = err.Error()
		a.mu.Unlock()
	}
	return a.GetState()
}

// ResumeNode gỡ cờ DRAINING để Worker tiếp tục kéo job bình thường.
func (a *App) ResumeNode() DesktopState {
	if err := a.runner.SetDraining(a.effectiveCtx(), false); err != nil {
		a.mu.Lock()
		a.lastError = err.Error()
		a.mu.Unlock()
	}
	return a.GetState()
}

// SyncModels ép Worker đồng bộ ngay danh sách model mới từ LLM Engine cục bộ.
func (a *App) SyncModels() DesktopState {
	if _, err := a.runner.SyncModels(a.effectiveCtx()); err != nil {
		a.mu.Lock()
		a.lastError = err.Error()
		a.mu.Unlock()
	}
	return a.GetState()
}

// ResetBreaker đưa Circuit Breaker về CLOSED thủ công từ giao diện Desktop.
func (a *App) ResetBreaker() DesktopState {
	if err := a.runner.ResetBreaker(); err != nil {
		a.mu.Lock()
		a.lastError = err.Error()
		a.mu.Unlock()
	}
	return a.GetState()
}

// ClearLogs xóa bộ đệm log đang hiển thị ở tab Executions & Logs.
func (a *App) ClearLogs() DesktopState {
	a.runner.ClearLogs()
	return a.GetState()
}

// TestEngine kiểm tra kết nối trực tiếp tới Ollama/vLLM/llama.cpp và liệt kê các model tìm thấy.
func (a *App) TestEngine(provider string, baseURL string) EngineCheckResult {
	ctx, cancel := context.WithTimeout(a.effectiveCtx(), 4*time.Second)
	defer cancel()

	modelsList, err := agent.CheckEngineHealth(ctx, provider, baseURL)
	if err != nil {
		return EngineCheckResult{OK: false, Error: err.Error()}
	}
	return EngineCheckResult{OK: true, Models: modelsList}
}

// SaveConfig lưu cấu hình từ form xuống file worker.yaml và tùy chọn restart lại Worker ngay nếu đang chạy.
func (a *App) SaveConfig(dto WorkerConfigDTO, restart bool) DesktopState {
	a.mu.Lock()
	applyDTO(a.cfg, dto)
	cfgCopy := *a.cfg
	cfgPath := a.configPath
	a.lastError = ""
	a.mu.Unlock()

	if data, err := yaml.Marshal(&cfgCopy); err == nil {
		_ = os.MkdirAll(filepath.Dir(cfgPath), 0o755)
		if writeErr := os.WriteFile(cfgPath, data, 0o644); writeErr != nil {
			a.mu.Lock()
			a.lastError = "failed to write config file: " + writeErr.Error()
			a.mu.Unlock()
			return a.GetState()
		}
	} else {
		a.mu.Lock()
		a.lastError = err.Error()
		a.mu.Unlock()
		return a.GetState()
	}

	if restart && a.runner.IsRunning() {
		return a.RestartWorker()
	}
	return a.GetState()
}
