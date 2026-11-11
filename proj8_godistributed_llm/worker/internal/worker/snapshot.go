package worker

import (
	"context"
	"time"

	"go-distributed-llm/shared/models"
	"go-distributed-llm/shared/pkg/utils"
)

const maxRecentJobs = 30

// JobRecord lưu tóm tắt các job gần nhất chạy trên Worker để hiển thị trong Local Web UI.
type JobRecord struct {
	JobID       string `json:"job_id"`
	TraceID     string `json:"trace_id,omitempty"`
	Model       string `json:"model"`
	Priority    string `json:"priority"`
	Status      string `json:"status"` // RUNNING, COMPLETED, CANCELED, TIMED_OUT, FAILED
	DurationMs  int64  `json:"duration_ms"`
	QueueWaitMs int64  `json:"queue_wait_ms"`
	TokensSent  int    `json:"tokens_sent"`
	Error       string `json:"error,omitempty"`
	Timestamp   int64  `json:"timestamp"`
}

// WorkerSnapshot tổng hợp toàn bộ trạng thái telemetry và cấu hình runtime cho Worker UI (:9091).
type WorkerSnapshot struct {
	WorkerID           string      `json:"worker_id"`
	Status             string      `json:"status"`
	Draining           bool        `json:"draining"`
	Transport          string      `json:"transport"`
	ConsumerGroup      string      `json:"consumer_group"`
	LLMProvider        string      `json:"llm_provider"`
	LLMBaseURL         string      `json:"llm_base_url"`
	RedisAddr          string      `json:"redis_addr"`
	UptimeSec          int64       `json:"uptime_sec"`
	MaxSlots           int         `json:"max_slots"`
	ActiveJobs         int         `json:"active_jobs"`
	SupportedModels    []string    `json:"supported_models"`
	DynamicModelSync   bool        `json:"dynamic_model_sync"`
	MaxJobDurationSec  int         `json:"max_job_duration_sec"`
	BatchFlushMs       int         `json:"batch_flush_ms"`
	BreakerState       string      `json:"breaker_state"`
	BreakerFailures    int         `json:"breaker_failures"`
	BreakerThreshold   int         `json:"breaker_threshold"`
	CPUPercent         float64     `json:"cpu_percent"`
	RAMPercent         float64     `json:"ram_percent"`
	GPUVRAMPercent     float64     `json:"gpu_vram_percent"`
	JobsCompleted      uint64      `json:"jobs_completed"`
	JobsFailed         uint64      `json:"jobs_failed"`
	JobsCanceled       uint64      `json:"jobs_canceled"`
	JobsTimedOut       uint64      `json:"jobs_timed_out"`
	TotalTokensSent    uint64      `json:"total_tokens_sent"`
	RecentJobs         []JobRecord `json:"recent_jobs"`
}

func (w *ClusterWorker) recordActiveJob(job models.JobPayload, queueWaitMs int64) {
	w.activeListMu.Lock()
	defer w.activeListMu.Unlock()
	w.runningJobs[job.ID] = JobRecord{
		JobID:       job.ID,
		TraceID:     job.TraceID,
		Model:       job.Model,
		Priority:    job.Priority,
		Status:      "RUNNING",
		QueueWaitMs: queueWaitMs,
		Timestamp:   time.Now().Unix(),
	}
}

func (w *ClusterWorker) recordJobFinish(rec JobRecord) {
	w.activeListMu.Lock()
	delete(w.runningJobs, rec.JobID)
	w.activeListMu.Unlock()

	w.jobsMu.Lock()
	defer w.jobsMu.Unlock()
	w.recentJobs = append([]JobRecord{rec}, w.recentJobs...)
	if len(w.recentJobs) > maxRecentJobs {
		w.recentJobs = w.recentJobs[:maxRecentJobs]
	}
}

func (w *ClusterWorker) GetRecentJobs() []JobRecord {
	w.activeListMu.Lock()
	running := make([]JobRecord, 0, len(w.runningJobs))
	for _, r := range w.runningJobs {
		running = append(running, r)
	}
	w.activeListMu.Unlock()

	w.jobsMu.RLock()
	history := make([]JobRecord, len(w.recentJobs))
	copy(history, w.recentJobs)
	w.jobsMu.RUnlock()

	return append(running, history...)
}

func (w *ClusterWorker) Snapshot(ctx context.Context) WorkerSnapshot {
	draining := false
	if w.registry != nil {
		dCtx, cancel := context.WithTimeout(ctx, 1500*time.Millisecond)
		if d, err := w.registry.IsNodeDraining(dCtx, w.id); err == nil {
			draining = d
		}
		cancel()
	}

	bState, bFails, bThresh := w.breaker.Snapshot()
	status := "ONLINE"
	if draining {
		status = "DRAINING"
	} else if bState == BreakerOpen {
		status = "UNHEALTHY"
	}

	host := utils.CollectHostMetrics()
	return WorkerSnapshot{
		WorkerID:          w.id,
		Status:            status,
		Draining:          draining,
		Transport:         w.transportMode,
		ConsumerGroup:     w.consumerGroup,
		LLMProvider:       w.llmProviderName,
		LLMBaseURL:        w.llmBaseURL,
		RedisAddr:         w.redisAddr,
		UptimeSec:         int64(time.Since(w.startedAt).Seconds()),
		MaxSlots:          w.maxSlots,
		ActiveJobs:        int(w.activeJobs.Load()),
		SupportedModels:   w.getSupportedModels(),
		DynamicModelSync:  w.dynamicModelSync,
		MaxJobDurationSec: int(w.maxJobDuration.Seconds()),
		BatchFlushMs:      int(w.batchFlushInterval.Milliseconds()),
		BreakerState:      string(bState),
		BreakerFailures:   bFails,
		BreakerThreshold:  bThresh,
		CPUPercent:        host.CPUPercent,
		RAMPercent:        host.RAMPercent,
		GPUVRAMPercent:    host.GPUVRAMPercent,
		JobsCompleted:     w.jobsCompleted.Load(),
		JobsFailed:        w.jobsFailed.Load(),
		JobsCanceled:      w.jobsCanceled.Load(),
		JobsTimedOut:      w.jobsTimedOut.Load(),
		TotalTokensSent:   w.totalTokensSent.Load(),
		RecentJobs:        w.GetRecentJobs(),
	}
}

func (w *ClusterWorker) SetDraining(ctx context.Context, draining bool) error {
	if w.registry == nil {
		return nil
	}
	return w.registry.SetNodeDraining(ctx, w.id, draining)
}

func (w *ClusterWorker) SyncNow(ctx context.Context) []string {
	w.syncModelsAndHealth(ctx)
	return w.getSupportedModels()
}

func (w *ClusterWorker) ResetBreaker() {
	w.breaker.Reset()
	w.log.Info("circuit breaker manually reset via local UI", "worker_id", w.id)
}

