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

// WorkerOptions chứa các cấu hình nâng cao cho ClusterWorker (Hard Timeout, Micro-Batching, Dynamic Sync, Metadata).
type WorkerOptions struct {
	MaxJobDuration     time.Duration
	BatchFlushInterval time.Duration
	DynamicModelSync   bool
	FailureThreshold   int
	BreakerCooldown    time.Duration
	LLMProviderName    string
	LLMBaseURL         string
	RedisAddr          string
}

// ClusterWorker là bộ não điều phối phía máy trạm Local LLM:
// - 1 kết nối Redis Pub/Sub duy nhất điều phối hủy job cho hàng nghìn job đồng thời.
// - Circuit Breaker chống nhận job khi engine cục bộ chết, Hard Job Timeout chống kẹt slot.
// - Semaphore bảo vệ GPU/VRAM, Heartbeat 5s, XAUTOCLAIM tự cứu job + Rebalance affinity mồ côi.
type ClusterWorker struct {
	id                 string
	transportMode      string
	consumerGroup      string
	modelsMu           sync.RWMutex
	supportedModels    []string
	maxSlots           int
	heartbeatInterval  time.Duration
	maxJobDuration     time.Duration
	batchFlushInterval time.Duration
	dynamicModelSync   bool
	llmProviderName    string
	llmBaseURL         string
	redisAddr          string
	startedAt          time.Time

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

	wg sync.WaitGroup
}

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
		id:                 id,
		transportMode:      mode,
		consumerGroup:      consumerGroup,
		supportedModels:    modelsCopy,
		maxSlots:           maxParallelJobs,
		heartbeatInterval:  heartbeatInterval,
		maxJobDuration:     5 * time.Minute,
		batchFlushInterval: 20 * time.Millisecond,
		startedAt:          time.Now(),
		queue:              queue,
		eventBus:           eventBus,
		registry:           registry,
		llm:                llm,
		streamer:           streamer,
		breaker:            NewCircuitBreaker(3, 15*time.Second),
		log:                log,
		sem:                make(chan struct{}, maxParallelJobs),
		runningJobs:        make(map[string]JobRecord),
	}
}

func (w *ClusterWorker) Configure(opts WorkerOptions) {
	if opts.MaxJobDuration > 0 {
		w.maxJobDuration = opts.MaxJobDuration
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

func (w *ClusterWorker) getSupportedModels() []string {
	w.modelsMu.RLock()
	defer w.modelsMu.RUnlock()
	out := make([]string, len(w.supportedModels))
	copy(out, w.supportedModels)
	return out
}

func (w *ClusterWorker) setSupportedModels(modelsList []string) {
	if len(modelsList) == 0 {
		return
	}
	w.modelsMu.Lock()
	w.supportedModels = make([]string, len(modelsList))
	copy(w.supportedModels, modelsList)
	w.modelsMu.Unlock()
}

func (w *ClusterWorker) Start(ctx context.Context) {
	w.syncModelsAndHealth(ctx)

	w.wg.Add(1)
	go func() {
		defer w.wg.Done()
		w.runHeartbeat(ctx)
	}()

	w.wg.Add(1)
	go func() {
		defer w.wg.Done()
		w.runCancelDispatcher(ctx)
	}()

	w.wg.Add(1)
	go func() {
		defer w.wg.Done()
		w.runAutoClaimLoop(ctx)
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
		"batch_flush", w.batchFlushInterval.String(),
		"dynamic_model_sync", w.dynamicModelSync,
	)

	for {
		if !w.breaker.Allow() {
			w.log.Warn("circuit breaker OPEN, pausing job pull until engine recovers", "worker_id", w.id)
			select {
			case <-ctx.Done():
				w.wg.Wait()
				return
			case <-time.After(2 * time.Second):
			}
			continue
		}

		select {
		case <-ctx.Done():
			w.log.Info("worker shutting down, waiting for active jobs", "active_jobs", w.activeJobs.Load())
			w.wg.Wait()
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
				w.wg.Wait()
				return
			case <-time.After(2 * time.Second):
			}
			continue
		}

		currentModels := w.getSupportedModels()
		job, err := w.queue.PullJobFromModels(ctx, w.consumerGroup, w.id, currentModels, 2*time.Second)
		if err != nil {
			<-w.sem
			if ctx.Err() == nil {
				w.log.Error("pull job from redis stream failed", "err", err)
				time.Sleep(1 * time.Second)
			}
			continue
		}

		if job == nil {
			<-w.sem
			continue
		}

		w.wg.Add(1)
		go func(j models.JobPayload) {
			defer w.wg.Done()
			defer func() { <-w.sem }()
			w.processJob(ctx, j)
		}(*job)
	}
}

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

		for jobID := range cancelCh {
			if fn, ok := w.activeCancels.Load(jobID); ok {
				fn.(func())()
			}
		}
	}
}

func (w *ClusterWorker) runAutoClaimLoop(ctx context.Context) {
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
			w.wg.Add(1)
			go func(j models.JobPayload) {
				defer w.wg.Done()
				defer func() { <-w.sem }()
				w.processJob(ctx, j)
			}(claimed[0])
		}
	}
}

