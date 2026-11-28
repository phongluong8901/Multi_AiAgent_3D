package worker

import (
	"context"
	"log/slog"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"go-distributed-llm/shared/models"
	"go-distributed-llm/shared/ports"
)

// WorkerOptions chứa các cấu hình nâng cao cho ClusterWorker (Hard Timeout, Grace Period, Micro-Batching, Dynamic Sync).
type WorkerOptions struct {
	MaxJobDuration      time.Duration
	ShutdownGracePeriod time.Duration
	BatchFlushInterval  time.Duration
	DynamicModelSync    bool
	FailureThreshold    int
	BreakerCooldown     time.Duration
	LLMProviderName     string
	LLMBaseURL          string
	RedisAddr           string
}

// ClusterWorker là bộ não điều phối phía máy trạm Local LLM:
// - 1 kết nối Redis Pub/Sub duy nhất điều phối hủy job cho hàng nghìn job đồng thời.
// - Circuit Breaker chống nhận job khi engine cục bộ chết, Hard Job Timeout chống kẹt slot.
// - Graceful Shutdown chờ job đang sinh dở hoàn thành trong thời gian ân hạn trước khi ép hủy.
// - Semaphore bảo vệ GPU/VRAM, Heartbeat 5s, XAUTOCLAIM tự cứu job + Rebalance affinity mồ côi.
type ClusterWorker struct {
	id                  string
	transportMode       string
	consumerGroup       string
	modelsMu            sync.RWMutex
	supportedModels     []string
	maxSlots            int
	heartbeatInterval   time.Duration
	maxJobDuration      time.Duration
	shutdownGracePeriod time.Duration
	batchFlushInterval  time.Duration
	dynamicModelSync    bool
	llmProviderName     string
	llmBaseURL          string
	redisAddr           string
	startedAt           time.Time

	queue    ports.JobQueue
	eventBus ports.EventBus
	registry ports.NodeRegistry
	llm      ports.LLMProvider
	streamer ports.TokenStreamer
	breaker  *CircuitBreaker
	log      *slog.Logger

	sem             chan struct{}
	activeJobs      atomic.Int32
	jobsCompleted   atomic.Uint64
	jobsFailed      atomic.Uint64
	jobsCanceled    atomic.Uint64
	jobsTimedOut    atomic.Uint64
	totalTokensSent atomic.Uint64
	activeCancels   sync.Map // map[string]func()

	activeListMu sync.Mutex
	runningJobs  map[string]JobRecord
	jobsMu       sync.RWMutex
	recentJobs   []JobRecord

	jobsWg sync.WaitGroup
	wg     sync.WaitGroup
}

// NewClusterWorker khởi tạo Worker Node với các tham số bảo vệ GPU mặc định (Hard Timeout 5m, Grace 15s, Batch 20ms).
func NewClusterWorker(
	id string,
	transportMode string,
	consumerGroup string,
	supportedModels []string,
	maxParallelJobs int,
	heartbeatInterval time.Duration,
	queue ports.JobQueue,
	eventBus ports.EventBus,
	registry ports.NodeRegistry,
	llm ports.LLMProvider,
	streamer ports.TokenStreamer,
	log *slog.Logger,
) *ClusterWorker {
	if maxParallelJobs <= 0 {
		maxParallelJobs = 1
	}
	if heartbeatInterval <= 0 {
		heartbeatInterval = 5 * time.Second
	}
	if consumerGroup == "" {
		consumerGroup = "llm_cluster_group"
	}
	mode := strings.ToLower(strings.TrimSpace(transportMode))
	if mode != "http" {
		mode = "grpc"
	}

	modelsCopy := make([]string, len(supportedModels))
	copy(modelsCopy, supportedModels)

	return &ClusterWorker{
		id:                  id,
		transportMode:       mode,
		consumerGroup:       consumerGroup,
		supportedModels:     modelsCopy,
		maxSlots:            maxParallelJobs,
		heartbeatInterval:   heartbeatInterval,
		maxJobDuration:      5 * time.Minute,
		shutdownGracePeriod: 15 * time.Second,
		batchFlushInterval:  20 * time.Millisecond,
		startedAt:           time.Now(),
		queue:               queue,
		eventBus:            eventBus,
		registry:            registry,
		llm:                 llm,
		streamer:            streamer,
		breaker:             NewCircuitBreaker(3, 15*time.Second),
		log:                 log,
		sem:                 make(chan struct{}, maxParallelJobs),
		runningJobs:         make(map[string]JobRecord),
	}
}

// Configure áp dụng tùy chọn nâng cao từ file YAML / Desktop App vào ClusterWorker trước khi Start.
func (w *ClusterWorker) Configure(opts WorkerOptions) {
	if opts.MaxJobDuration > 0 {
		w.maxJobDuration = opts.MaxJobDuration
	}
	if opts.ShutdownGracePeriod >= 0 {
		w.shutdownGracePeriod = opts.ShutdownGracePeriod
	}
	if opts.BatchFlushInterval >= 0 {
		w.batchFlushInterval = opts.BatchFlushInterval
	}
	w.dynamicModelSync = opts.DynamicModelSync
	if opts.FailureThreshold > 0 || opts.BreakerCooldown > 0 {
		w.breaker = NewCircuitBreaker(opts.FailureThreshold, opts.BreakerCooldown)
	}
	if opts.LLMProviderName != "" {
		w.llmProviderName = opts.LLMProviderName
	}
	if opts.LLMBaseURL != "" {
		w.llmBaseURL = opts.LLMBaseURL
	}
	if opts.RedisAddr != "" {
		w.redisAddr = opts.RedisAddr
	}
}

// --- Cụm quản lý danh sách model (Thread-safe cho DynamicModelSync) ---

// getSupportedModels trả về bản sao danh sách model hiện Worker đang phục vụ.
func (w *ClusterWorker) getSupportedModels() []string {
	w.modelsMu.RLock()
	defer w.modelsMu.RUnlock()
	out := make([]string, len(w.supportedModels))
	copy(out, w.supportedModels)
	return out
}

// setSupportedModels cập nhật danh sách model mới phát hiện từ engine cục bộ (Ollama/vLLM).
func (w *ClusterWorker) setSupportedModels(modelsList []string) {
	if len(modelsList) == 0 {
		return
	}
	w.modelsMu.Lock()
	w.supportedModels = make([]string, len(modelsList))
	copy(w.supportedModels, modelsList)
	w.modelsMu.Unlock()
}

// --- Cụm Vòng lặp Consumer Chính & Điều phối Graceful Shutdown ---

// Start khởi động các goroutine nền (Heartbeat, Cancel Dispatcher, AutoClaim, Health Probe)
// rồi chạy vòng lặp chính kéo job từ Redis Stream khi còn slot Semaphore và không ở trạng thái DRAINING/OPEN.
func (w *ClusterWorker) Start(ctx context.Context) {
	w.syncModelsAndHealth(ctx)

	// jobsCtx tách khỏi ctx để các job đang sinh token dở có thời gian ân hạn hoàn tất khi Worker dừng.
	jobsCtx, cancelJobs := context.WithCancel(context.Background())

	w.wg.Add(1)
	go func() {
		defer w.wg.Done()
		w.runHeartbeat(ctx)
	}()

	w.wg.Add(1)
	go func() {
		defer w.wg.Done()
		w.runCancelDispatcher(jobsCtx)
	}()

	w.wg.Add(1)
	go func() {
		defer w.wg.Done()
		w.runAutoClaimLoop(ctx, jobsCtx)
	}()

	w.wg.Add(1)
	go func() {
		defer w.wg.Done()
		w.runHealthAndDiscoveryLoop(ctx)
	}()

	w.log.Info("worker consumer loop started",
		"worker_id", w.id,
		"transport", w.transportMode,
		"models", w.getSupportedModels(),
		"max_slots", w.maxSlots,
		"max_job_duration", w.maxJobDuration.String(),
		"shutdown_grace", w.shutdownGracePeriod.String(),
		"batch_flush", w.batchFlushInterval.String(),
		"dynamic_model_sync", w.dynamicModelSync,
	)

	for {
		if !w.breaker.Allow() {
			w.log.Warn("circuit breaker OPEN, pausing job pull until engine recovers", "worker_id", w.id)
			select {
			case <-ctx.Done():
				w.shutdownAndDrain(cancelJobs)
				return
			case <-time.After(2 * time.Second):
			}
			continue
		}

		select {
		case <-ctx.Done():
			w.shutdownAndDrain(cancelJobs)
			return
		case w.sem <- struct{}{}:
		}

		drainCtx, cancelDrain := context.WithTimeout(ctx, 2*time.Second)
		draining, drainErr := w.registry.IsNodeDraining(drainCtx, w.id)
		cancelDrain()
		if drainErr == nil && draining {
			<-w.sem
			select {
			case <-ctx.Done():
				w.shutdownAndDrain(cancelJobs)
				return
			case <-time.After(2 * time.Second):
			}
			continue
		}

		currentModels := w.getSupportedModels()
		job, err := w.queue.PullJobFromModels(ctx, w.consumerGroup, w.id, currentModels, 2*time.Second)
		if err != nil {
			<-w.sem
			if ctx.Err() != nil {
				w.shutdownAndDrain(cancelJobs)
				return
			}
			w.log.Error("pull job from redis stream failed", "err", err)
			time.Sleep(1 * time.Second)
			continue
		}

		if job == nil {
			<-w.sem
			continue
		}

		w.spawnJob(jobsCtx, *job)
	}
}

// spawnJob chạy processJob trên goroutine mới gắn jobsWg và tự động nhả slot Semaphore khi hoàn tất.
func (w *ClusterWorker) spawnJob(jobsCtx context.Context, j models.JobPayload) {
	w.jobsWg.Add(1)
	go func() {
		defer w.jobsWg.Done()
		defer func() { <-w.sem }()
		w.processJob(jobsCtx, j)
	}()
}

// shutdownAndDrain ngừng kéo job mới nhưng giữ context các job đang chạy trong khoảng shutdownGracePeriod
// để stream nốt phần trả lời dở trước khi ép hủy và chờ toàn bộ goroutine nền kết thúc.
func (w *ClusterWorker) shutdownAndDrain(cancelJobs context.CancelFunc) {
	w.log.Info("worker shutting down, draining active jobs",
		"active_jobs", w.activeJobs.Load(),
		"grace_period", w.shutdownGracePeriod.String(),
	)

	drained := make(chan struct{})
	go func() {
		w.jobsWg.Wait()
		close(drained)
	}()

	if w.shutdownGracePeriod <= 0 {
		cancelJobs()
		<-drained
	} else {
		timer := time.NewTimer(w.shutdownGracePeriod)
		select {
		case <-drained:
			timer.Stop()
		case <-timer.C:
			w.log.Warn("shutdown grace period exceeded, canceling remaining jobs", "active_jobs", w.activeJobs.Load())
			cancelJobs()
			<-drained
		}
	}

	cancelJobs()
	w.wg.Wait()
}

// --- Cụm Background Loops: Health/Model Sync, Cancel Pub/Sub & Tự cứu Job (XAUTOCLAIM) ---

// syncModelsAndHealth thăm dò sức khỏe engine cục bộ (cập nhật Circuit Breaker) và đồng bộ danh sách model thực tế.
func (w *ClusterWorker) syncModelsAndHealth(ctx context.Context) {
	probeCtx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	if hc, ok := w.llm.(ports.HealthChecker); ok {
		if err := hc.CheckHealth(probeCtx); err != nil {
			if st := w.breaker.RecordFailure(); st == BreakerOpen {
				w.log.Warn("engine health check failed, circuit breaker OPEN", "err", err)
			}
		} else if w.breaker.State() != BreakerClosed {
			w.breaker.RecordSuccess()
			w.log.Info("engine health check recovered, circuit breaker CLOSED")
		}
	}

	if w.dynamicModelSync {
		if md, ok := w.llm.(ports.ModelDiscoverer); ok {
			if discovered, err := md.ListModels(probeCtx); err == nil && len(discovered) > 0 {
				w.setSupportedModels(discovered)
			}
		}
	}
}

// runHealthAndDiscoveryLoop chạy định kỳ mỗi 10s để phát hiện engine chết/sống lại và cập nhật model mới pull.
func (w *ClusterWorker) runHealthAndDiscoveryLoop(ctx context.Context) {
	ticker := time.NewTicker(10 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			w.syncModelsAndHealth(ctx)
		}
	}
}

// runCancelDispatcher giữ kết nối subscribe tới kênh Pub/Sub ctrl:cancel:all và tự kết nối lại nếu đứt mạng.
func (w *ClusterWorker) runCancelDispatcher(ctx context.Context) {
	for {
		if ctx.Err() != nil {
			return
		}

		cancelCh, err := w.eventBus.SubscribeCancelAll(ctx)
		if err != nil {
			if ctx.Err() == nil {
				w.log.Warn("subscribe cancel channel failed, retrying", "err", err)
				select {
				case <-ctx.Done():
					return
				case <-time.After(2 * time.Second):
				}
			}
			continue
		}

		if !w.consumeCancelChannel(ctx, cancelCh) {
			return
		}
	}
}

// consumeCancelChannel đọc liên tục jobID cần hủy từ cancelCh và kích hoạt hàm cancel lưu trong activeCancels.
func (w *ClusterWorker) consumeCancelChannel(ctx context.Context, cancelCh <-chan string) bool {
	for {
		select {
		case <-ctx.Done():
			return false
		case jobID, ok := <-cancelCh:
			if !ok {
				return true
			}
			if fn, exists := w.activeCancels.Load(jobID); exists {
				fn.(func())()
			}
		}
	}
}

// runAutoClaimLoop chạy mỗi 15s để cân bằng lại job affinity mồ côi của node offline và claim lại job treo (> 45s) via XAUTOCLAIM.
func (w *ClusterWorker) runAutoClaimLoop(ctx context.Context, jobsCtx context.Context) {
	ticker := time.NewTicker(15 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			if rebalancer, ok := w.queue.(ports.AffinityRebalancer); ok {
				rebCtx, cancelReb := context.WithTimeout(ctx, 3*time.Second)
				if nodes, nErr := w.registry.GetOnlineNodes(rebCtx); nErr == nil {
					activeMap := make(map[string]bool, len(nodes))
					for _, n := range nodes {
						if n.Status == "ONLINE" {
							activeMap[n.WorkerID] = true
						}
					}
					if moved, mErr := rebalancer.ReclaimStaleAffinityJobs(rebCtx, w.consumerGroup, activeMap, 15*time.Second); mErr == nil && moved > 0 {
						w.log.Info("rebalanced orphaned affinity jobs to shared model streams", "moved", moved)
					}
				}
				cancelReb()
			}

			if !w.breaker.IsHealthy() {
				continue
			}

			drainCtx, cancelDrain := context.WithTimeout(ctx, 2*time.Second)
			draining, drainErr := w.registry.IsNodeDraining(drainCtx, w.id)
			cancelDrain()
			if drainErr == nil && draining {
				continue
			}

			select {
			case w.sem <- struct{}{}:
			default:
				continue
			}

			claimed, err := w.queue.AutoClaimJobs(ctx, w.consumerGroup, w.id, w.getSupportedModels(), 45*time.Second, 1)
			if err != nil || len(claimed) == 0 {
				<-w.sem
				continue
			}

			w.log.Warn("reclaimed stalled job via XAUTOCLAIM", "job_id", claimed[0].ID, "stream", claimed[0].StreamName)
			w.spawnJob(jobsCtx, claimed[0])
		}
	}
}

