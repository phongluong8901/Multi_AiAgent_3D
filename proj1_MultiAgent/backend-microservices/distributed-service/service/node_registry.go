package service

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"log"
	"sync"
	"time"

	"distributed-service/models"
	"distributed-service/storage"
)

type NodeRegistry struct {
	mu       sync.RWMutex
	nodes    map[string]*models.PartnerNode // Key: NodeID
	postgres *storage.PostgresStorage
	redis    *storage.RedisStorage
}

func NewNodeRegistry(pg *storage.PostgresStorage, rdb *storage.RedisStorage) *NodeRegistry {
	nr := &NodeRegistry{
		nodes:    make(map[string]*models.PartnerNode),
		postgres: pg,
		redis:    rdb,
	}

	// 1. Nếu có PostgreSQL (Neon DB), nạp danh sách node đã lưu
	if pg != nil {
		dbNodes, err := pg.GetAllNodes()
		if err == nil && len(dbNodes) > 0 {
			log.Printf("[NODE REGISTRY] Đã nạp thành công %d node từ Neon PostgreSQL.\n", len(dbNodes))
			for _, n := range dbNodes {
				nr.nodes[n.ID] = n
			}
		} else {
			log.Println("[NODE REGISTRY] Chưa có dữ liệu trên Neon PostgreSQL, khởi tạo node mẫu...")
			nr.seedInitialNodes()
			for _, n := range nr.nodes {
				_ = pg.UpsertNode(n)
			}
		}
	} else {
		// Fallback in-memory nếu chưa kết nối được DB
		nr.seedInitialNodes()
	}

	return nr
}

func (nr *NodeRegistry) seedInitialNodes() {
	nr.nodes["node-hanoi-cluster"] = &models.PartnerNode{
		ID:       "node-hanoi-cluster",
		UserID:   "usr_hanoi_01",
		Username: "Hanoi_DeepSeek_Cluster",
		Email:    "hanoi.cluster@ai.vn",
		Status:   "IDLE",
		Hardware: models.HardwareReport{
			CPUCores:       32,
			DeviceMemoryGB: 64,
			HasWebGPU:      true,
			GPUName:        "NVIDIA RTX 4090 24GB",
			VRAMGB:         24,
			OS:             "Windows 11 Pro",
		},
		RentConfig: models.RentConfiguration{
			AllocatedCores:       24,
			AllocatedRAMGB:       48,
			EnableGPU:            true,
			GPUSharePercent:      90,
			AvailabilitySchedule: "24/7",
			MinPricePerHourCoin:  150,
		},
		CompatibleModels: []string{"deepseek-r1-7b", "llama-3.3-8b", "sdxl-turbo"},
		ActiveModel:      "deepseek-r1-7b",
		TotalCoinsEarned: 1420.5,
		UptimeSeconds:    86400 * 3,
		AuthToken:        "tok_hanoi_cluster_demo",
		CreatedAt:        time.Now().Add(-72 * time.Hour),
		UpdatedAt:        time.Now(),
	}

	nr.nodes["node-saigon-worker"] = &models.PartnerNode{
		ID:       "node-saigon-worker",
		UserID:   "usr_saigon_02",
		Username: "Saigon_Neural_Worker",
		Email:    "worker.sg@ai.vn",
		Status:   "BUSY",
		Hardware: models.HardwareReport{
			CPUCores:       16,
			DeviceMemoryGB: 32,
			HasWebGPU:      true,
			GPUName:        "NVIDIA RTX 3080 Ti",
			VRAMGB:         12,
			OS:             "Ubuntu 24.04 LTS",
		},
		RentConfig: models.RentConfiguration{
			AllocatedCores:       12,
			AllocatedRAMGB:       24,
			EnableGPU:            true,
			GPUSharePercent:      80,
			AvailabilitySchedule: "24/7",
			MinPricePerHourCoin:  100,
		},
		CompatibleModels: []string{"deepseek-r1-7b", "mistral-7b-v0.3"},
		ActiveModel:      "mistral-7b-v0.3",
		TotalCoinsEarned: 980.0,
		UptimeSeconds:    86400 * 2,
		AuthToken:        "tok_saigon_worker_demo",
		CreatedAt:        time.Now().Add(-48 * time.Hour),
		UpdatedAt:        time.Now(),
	}
}

// GenerateAuthToken tạo token xác thực duy nhất cho Client App
func GenerateAuthToken() string {
	b := make([]byte, 16)
	rand.Read(b)
	return "dist_" + hex.EncodeToString(b)
}

// RegisterOrUpdateNode đăng ký node mới hoặc cập nhật cấu hình cho thuê
func (nr *NodeRegistry) RegisterOrUpdateNode(node *models.PartnerNode) *models.PartnerNode {
	nr.mu.Lock()
	defer nr.mu.Unlock()

	if node.ID == "" {
		if node.UserID != "" {
			node.ID = "node_" + node.UserID
		} else {
			node.ID = fmt.Sprintf("node_%d", time.Now().UnixNano())
		}
	}

	if node.AuthToken == "" {
		node.AuthToken = GenerateAuthToken()
	}

	if node.Status == "" {
		node.Status = "IDLE"
	}

	node.UpdatedAt = time.Now()
	if node.CreatedAt.IsZero() {
		node.CreatedAt = time.Now()
	}

	nr.nodes[node.ID] = node

	// Đồng bộ xuống Neon PostgreSQL
	if nr.postgres != nil {
		go func(n *models.PartnerNode) {
			if err := nr.postgres.UpsertNode(n); err != nil {
				log.Printf("[POSTGRES ERROR] Lưu node %s thất bại: %v\n", n.ID, err)
			}
		}(node)
	}

	return node
}

// GetNodeByID lấy node theo ID
func (nr *NodeRegistry) GetNodeByID(nodeID string) (*models.PartnerNode, bool) {
	nr.mu.RLock()
	defer nr.mu.RUnlock()

	node, exists := nr.nodes[nodeID]
	return node, exists
}

// GetNodeByToken tìm node qua AuthToken
func (nr *NodeRegistry) GetNodeByToken(token string) (*models.PartnerNode, bool) {
	nr.mu.RLock()
	defer nr.mu.RUnlock()

	for _, n := range nr.nodes {
		if n.AuthToken == token {
			return n, true
		}
	}
	return nil, false
}

// GetAllNodes trả về danh sách tất cả các node trong mạng lưới, đối chiếu trạng thái từ Redis
func (nr *NodeRegistry) GetAllNodes() []*models.PartnerNode {
	nr.mu.RLock()
	defer nr.mu.RUnlock()

	ctx, cancel := context.WithTimeout(context.Background(), 1*time.Second)
	defer cancel()

	list := make([]*models.PartnerNode, 0, len(nr.nodes))
	for _, n := range nr.nodes {
		// Nếu có Redis, kiểm tra heartbeat thực tế để phản ánh trạng thái chuẩn xác
		if nr.redis != nil && nr.redis.IsNodeOnline(ctx, n.ID) {
			if n.Status == "OFFLINE" || n.Status == "REGISTERED" {
				n.Status = "IDLE"
			}
		}
		list = append(list, n)
	}
	return list
}

// UpdateTelemetry cập nhật dữ liệu tài nguyên thực từ Python Worker / Electron
func (nr *NodeRegistry) UpdateTelemetry(nodeID string, stats models.TelemetryStats) {
	nr.mu.Lock()
	defer nr.mu.Unlock()

	if node, exists := nr.nodes[nodeID]; exists {
		node.LastTelemetry = &stats
		node.UpdatedAt = time.Now()
		if node.Status == "OFFLINE" || node.Status == "REGISTERED" {
			node.Status = "IDLE"
		}
		// Tích lũy coin nhẹ nhàng khi node duy trì online (0.02 coin / 10s)
		node.TotalCoinsEarned += 0.02
		node.UptimeSeconds += 10

		// Cập nhật lên Redis (gia hạn heartbeat 60s và cache stats)
		if nr.redis != nil {
			go func(nid string, s models.TelemetryStats) {
				ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
				defer cancel()
				_ = nr.redis.SetNodeOnline(ctx, nid, 60*time.Second)
				_ = nr.redis.CacheTelemetry(ctx, nid, s)
			}(nodeID, stats)
		}

		// Cập nhật xuống Neon PostgreSQL
		if nr.postgres != nil {
			go func(nid string, s models.TelemetryStats) {
				if err := nr.postgres.UpdateTelemetry(nid, s); err != nil {
					log.Printf("[POSTGRES ERROR] UpdateTelemetry thất bại: %v\n", err)
				}
			}(nodeID, stats)
		}
	}
}

// MarkNodeOffline chuyển trạng thái sang OFFLINE khi mất kết nối WebSocket
func (nr *NodeRegistry) MarkNodeOffline(nodeID string) {
	nr.mu.Lock()
	defer nr.mu.Unlock()

	if node, exists := nr.nodes[nodeID]; exists {
		node.Status = "OFFLINE"
		node.UpdatedAt = time.Now()

		if nr.redis != nil {
			go func(nid string) {
				ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
				defer cancel()
				_ = nr.redis.SetNodeOffline(ctx, nid)
			}(nodeID)
		}

		if nr.postgres != nil {
			go func(nid string) {
				_ = nr.postgres.UpdateStatus(nid, "OFFLINE")
			}(nodeID)
		}
	}
}
