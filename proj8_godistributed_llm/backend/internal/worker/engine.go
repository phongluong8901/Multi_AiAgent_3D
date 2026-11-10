package worker

import (
	"context"
	"log/slog"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"go-distributed-llm/internal/models"
	"go-distributed-llm/internal/ports"
)

// ClusterWorker là bộ não điều phối phía máy trạm Local LLM.
type ClusterWorker struct {
	id                string
	transportMode     string // "grpc" hoặc "http"
	consumerGroup     string
	supportedModels   []string
	maxSlots          int
	heartbeatInterval time.Duration

	queue    ports.JobQueue
	eventBus ports.EventBus
	registry ports.NodeRegistry
	llm      ports.LLMProvider
	streamer ports.TokenStreamer
	log      *slog.Logger

	sem        chan struct{}
	activeJobs atomic.Int32
	wg         sync.WaitGroup
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

	return &ClusterWorker{
		id:                id,
		transportMode:     mode,
		consumerGroup:     consumerGroup,
		supportedModels:   supportedModels,
		maxSlots:          maxParallelJobs,
		heartbeatInterval: heartbeatInterval,
		queue:             queue,
		eventBus:          eventBus,
		registry:          registry,
		llm:               llm,
		streamer:          streamer,
		log:               log,
		sem:               make(chan struct{}, maxParallelJobs),
	}
}

func (w *ClusterWorker) Start(ctx context.Context) {
	w.wg.Add(1)
	go func() {
		defer w.wg.Done()
		w.runHeartbeat(ctx)
	}()

	w.wg.Add(1)
	go func() {
		defer w.wg.Done()
		w.runAutoClaimLoop(ctx)
	}()

	w.log.Info("worker consumer loop started",
		"worker_id", w.id,
		"transport", w.transportMode,
		"models", w.supportedModels,
		"max_slots", w.maxSlots,
	)

	for {
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

		job, err := w.queue.PullJobFromModels(ctx, w.consumerGroup, w.id, w.supportedModels, 2*time.Second)
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

func (w *ClusterWorker) runAutoClaimLoop(ctx context.Context) {
	ticker := time.NewTicker(15 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
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

			claimed, err := w.queue.AutoClaimJobs(ctx, w.consumerGroup, w.id, w.supportedModels, 45*time.Second, 1)
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
