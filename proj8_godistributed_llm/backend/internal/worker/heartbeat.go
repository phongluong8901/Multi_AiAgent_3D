package worker

import (
	"context"
	"time"

	"go-distributed-llm/internal/models"
	"go-distributed-llm/pkg/utils"
)

func (w *ClusterWorker) runHeartbeat(ctx context.Context) {
	const heartbeatTTL = 12 * time.Second

	sendOnce := func() {
		hbCtx, cancel := context.WithTimeout(ctx, 3*time.Second)
		defer cancel()

		status := "ONLINE"
		if draining, err := w.registry.IsNodeDraining(hbCtx, w.id); err == nil && draining {
			status = "DRAINING"
		}

		metrics := utils.CollectHostMetrics()
		info := models.WorkerNodeInfo{
			WorkerID:        w.id,
			SupportedModels: w.supportedModels,
			MaxSlots:        w.maxSlots,
			ActiveJobs:      int(w.activeJobs.Load()),
			CPUUsagePercent: metrics.CPUPercent,
			RAMUsagePercent: metrics.RAMPercent,
			Status:          status,
			LastHeartbeat:   time.Now().Unix(),
		}

		if err := w.registry.UpdateHeartbeat(hbCtx, info, heartbeatTTL); err != nil && ctx.Err() == nil {
			w.log.Warn("update heartbeat failed", "err", err)
		}
	}

	sendOnce()

	ticker := time.NewTicker(w.heartbeatInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			sendOnce()
		}
	}
}
