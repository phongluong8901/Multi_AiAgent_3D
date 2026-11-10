package services

import (
	"context"
	"strings"

	"go-distributed-llm/internal/models"
	"go-distributed-llm/internal/ports"
)

// AdminService xử lý nghiệp vụ giám sát Worker Nodes, hàng đợi và điều phối Drain/Resume.
type AdminService struct {
	queue    ports.JobQueue
	registry ports.NodeRegistry
}

func NewAdminService(queue ports.JobQueue, registry ports.NodeRegistry) *AdminService {
	return &AdminService{
		queue:    queue,
		registry: registry,
	}
}

func (s *AdminService) ListOnlineNodes(ctx context.Context) ([]models.WorkerNodeInfo, error) {
	return s.registry.GetOnlineNodes(ctx)
}

func (s *AdminService) GetQueueStats(ctx context.Context, rawModels string) (map[string]int64, error) {
	if rawModels == "" {
		rawModels = "qwen2.5:1.5b,qwen2.5:7b,llama3.2:3b"
	}
	stats := make(map[string]int64)
	for _, m := range strings.Split(rawModels, ",") {
		model := strings.TrimSpace(m)
		if model == "" {
			continue
		}
		length, err := s.queue.GetQueueLength(ctx, model)
		if err != nil {
			return nil, err
		}
		stats[model] = length
	}
	return stats, nil
}

func (s *AdminService) SetNodeDraining(ctx context.Context, workerID string, draining bool) error {
	return s.registry.SetNodeDraining(ctx, workerID, draining)
}

