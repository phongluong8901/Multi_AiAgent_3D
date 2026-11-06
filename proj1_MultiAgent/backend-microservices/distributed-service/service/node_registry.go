package service

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"log"
	"strings"
	"sync"
	"time"

	"distributed-service/models"
	"distributed-service/storage"
)

// NodeRegistry quản lý danh sách các Partner Node trong bộ nhớ (kết hợp đồng bộ xuống Neon PostgreSQL).
// Hỗ trợ cơ chế kiểm tra liveness tự động dựa trên nhịp tim telemetry từ Electron Worker.
type NodeRegistry struct {
	mu           sync.RWMutex
	nodes        map[string]*models.PartnerNode // Key: NodeID -> Thông tin chi tiết Partner Node
	manualPaused map[string]bool                // Key: NodeID -> true nếu người dùng chủ động bấm Tạm Dừng trên Web
	postgres     *storage.PostgresStorage       // Kết nối lưu trữ bền vững trên Neon PostgreSQL (có thể nil nếu chạy in-memory)
}

// NewNodeRegistry khởi tạo NodeRegistry và nạp danh sách các node đã đăng ký từ PostgreSQL.
func NewNodeRegistry(pg *storage.PostgresStorage) *NodeRegistry {
	nr := &NodeRegistry{
		nodes:        make(map[string]*models.PartnerNode),
		manualPaused: make(map[string]bool),
		postgres:     pg,
	}

	// Nạp danh sách node đã đăng ký từ Neon PostgreSQL (bỏ qua các node seed mẫu cũ và đặt trạng thái mặc định là OFFLINE cho tới khi Electron Worker thực sự kết nối)
	if pg != nil {
		dbNodes, err := pg.GetAllNodes()
		if err == nil && len(dbNodes) > 0 {
			loaded := 0
			for _, n := range dbNodes {
				if n.ID == "node-hanoi-cluster" || n.ID == "node-saigon-worker" || strings.HasPrefix(n.ID, "node_seller_") {
					continue
				}
				n.Status = "OFFLINE"
				n.LastTelemetry = nil
				nr.nodes[n.ID] = n
				loaded++
			}
			log.Printf("[NODE REGISTRY] Đã nạp %d node từ Neon PostgreSQL (chờ Electron Worker kết nối).\n", loaded)
		}
	}

	return nr
}

// GenerateAuthToken tạo token xác thực duy nhất cho Client App
func GenerateAuthToken() string {
	b := make([]byte, 16)
	rand.Read(b)
	return "dist_" + hex.EncodeToString(b)
}

// RegisterOrUpdateNode đăng ký cấu hình đối tác trên Web (mặc định OFFLINE cho đến khi chạy Electron Worker)
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

	// Nếu node đã tồn tại và đang có kết nối Worker thực tế thì giữ nguyên trạng thái & telemetry
	if existing, ok := nr.nodes[node.ID]; ok {
		if node.AuthToken == "" {
			node.AuthToken = existing.AuthToken
		}
		if existing.LastTelemetry != nil && time.Since(existing.LastTelemetry.Timestamp) <= 15*time.Second && !nr.manualPaused[node.ID] {
			node.Status = "IDLE"
			node.LastTelemetry = existing.LastTelemetry
		} else {
			node.Status = "OFFLINE"
		}
		node.TotalCoinsEarned = existing.TotalCoinsEarned
		node.UptimeSeconds = existing.UptimeSeconds
		node.CreatedAt = existing.CreatedAt
	} else {
		if node.AuthToken == "" {
			node.AuthToken = GenerateAuthToken()
		}
		// Khi mới đăng ký trên Web và chưa bật Electron Worker -> OFFLINE
		node.Status = "OFFLINE"
		node.CreatedAt = time.Now()
	}

	node.UpdatedAt = time.Now()
	nr.nodes[node.ID] = node

	if nr.postgres != nil {
		// Sao chép snapshot giá trị của Node trước khi đẩy sang goroutine ghi DB để tránh data race
		nodeSnapshot := *node
		go func(n models.PartnerNode) {
			if err := nr.postgres.UpsertNode(&n); err != nil {
				log.Printf("[ERROR] [POSTGRES] Lưu node %s thất bại: %v\n", n.ID, err)
			}
		}(nodeSnapshot)
	}

	return node
}

// GetNodeByID lấy thông tin node theo ID và tự động làm mới trạng thái liveness của Electron Worker.
func (nr *NodeRegistry) GetNodeByID(nodeID string) (*models.PartnerNode, bool) {
	nr.mu.Lock()
	defer nr.mu.Unlock()

	node, exists := nr.nodes[nodeID]
	if !exists {
		return nil, false
	}
	nr.refreshNodeLivenessLocked(node)
	return node, true
}

// GetNodeByToken tìm kiếm node dựa trên mã xác thực AuthToken.
func (nr *NodeRegistry) GetNodeByToken(token string) (*models.PartnerNode, bool) {
	nr.mu.Lock()
	defer nr.mu.Unlock()

	for _, n := range nr.nodes {
		if n.AuthToken == token {
			nr.refreshNodeLivenessLocked(n)
			return n, true
		}
	}
	return nil, false
}

// refreshNodeLivenessLocked kiểm tra thời gian gửi telemetry gần nhất để tự động chuyển node sang OFFLINE nếu quá hạn 15 giây.
// Hàm này yêu cầu caller đã giữ khóa nr.mu.Lock().
func (nr *NodeRegistry) refreshNodeLivenessLocked(n *models.PartnerNode) {
	if nr.manualPaused[n.ID] {
		n.Status = "OFFLINE"
		return
	}
	if n.LastTelemetry == nil || time.Since(n.LastTelemetry.Timestamp) > 15*time.Second {
		n.Status = "OFFLINE"
	} else if n.Status == "OFFLINE" || n.Status == "REGISTERED" || n.Status == "" {
		n.Status = "IDLE"
	}
}

// GetAllNodes trả về danh sách tất cả các node, chỉ những node đang chạy Electron Worker mới có Status = IDLE/BUSY
func (nr *NodeRegistry) GetAllNodes() []*models.PartnerNode {
	nr.mu.Lock()
	defer nr.mu.Unlock()

	list := make([]*models.PartnerNode, 0, len(nr.nodes))
	for _, n := range nr.nodes {
		if n.ID == "node-hanoi-cluster" || n.ID == "node-saigon-worker" || strings.HasPrefix(n.ID, "node_seller_") {
			continue
		}
		nr.refreshNodeLivenessLocked(n)
		list = append(list, n)
	}
	return list
}

// UpsertWorkerTelemetry đồng bộ thông số thực tế từ Electron Worker (worker.exe / worker.py)
func (nr *NodeRegistry) UpsertWorkerTelemetry(
	rawNodeID string,
	hostname string,
	nodeName string,
	hw *models.HardwareReport,
	ollamaModels []string,
	stats models.TelemetryStats,
) *models.PartnerNode {
	nr.mu.Lock()
	defer nr.mu.Unlock()

	var target *models.PartnerNode

	// 1. Tìm đúng theo thiết bị định danh phần cứng duy nhất rawNodeID
	if rawNodeID != "" && !strings.HasPrefix(rawNodeID, "guest_worker_") {
		target = nr.nodes[rawNodeID]
	}

	// 2. Nếu chưa khớp ID, kiểm tra theo nodeName đã đăng ký
	if target == nil && nodeName != "" {
		for _, n := range nr.nodes {
			if n.NodeName == nodeName || n.Username == nodeName || n.ID == nodeName {
				target = n
				break
			}
		}
	}

	// 2. Nếu Worker chạy mặc định không truyền token (guest_worker_...), ưu tiên khớp với node đã đăng ký hoặc node theo hostname
	if target == nil && hostname != "" {
		hostNodeID := "worker_" + strings.ToLower(strings.ReplaceAll(hostname, " ", "_"))
		if existingHostNode, ok := nr.nodes[hostNodeID]; ok {
			target = existingHostNode
		}
	}

	// 3. Nếu chỉ có 1 node đối tác đã đăng ký trên hệ thống, gắn luồng Worker vào node đó
	if target == nil && len(nr.nodes) == 1 {
		for _, onlyNode := range nr.nodes {
			target = onlyNode
			break
		}
	}

	// 4. Nếu chưa có bản ghi nào, tự động khởi tạo Node thực tế từ Electron Worker
	if target == nil {
		cleanHost := hostname
		if cleanHost == "" {
			cleanHost = "Seller_PC"
		}
		displayName := nodeName
		if displayName == "" && rawNodeID != "" && !strings.HasPrefix(rawNodeID, "guest_worker_") && !strings.HasPrefix(rawNodeID, "node_seller_") {
			displayName = rawNodeID
		}
		if displayName == "" {
			displayName = cleanHost
		}
		newID := rawNodeID
		if newID == "" || strings.HasPrefix(newID, "guest_worker_") {
			if nodeName != "" {
				newID = nodeName
			} else {
				newID = "worker_" + strings.ToLower(strings.ReplaceAll(displayName, " ", "_"))
			}
		}
		target = &models.PartnerNode{
			ID:       newID,
			UserID:   "seller_worker",
			Username: displayName,
			NodeName: displayName,
			Email:    "",
			Status:   "IDLE",
			Hardware: models.HardwareReport{
				CPUCores:       8,
				DeviceMemoryGB: 16,
				HasWebGPU:      false,
				GPUName:        "CPU Mode",
			},
			RentConfig: models.RentConfiguration{
				AllocatedCores:       4,
				AllocatedRAMGB:       8,
				EnableGPU:            true,
				GPUSharePercent:      80,
				AvailabilitySchedule: "24/7",
				MinPricePerHourCoin:  35,
			},
			CompatibleModels: []string{"qwen2.5-coder:1.5b"},
			ActiveModel:      "qwen2.5-coder:1.5b",
			AuthToken:        GenerateAuthToken(),
			CreatedAt:        time.Now(),
		}
		nr.nodes[newID] = target
	}

	// Luôn cập nhật nodeName và Username theo tên máy từ Electron Worker
	if nodeName != "" {
		target.NodeName = nodeName
		target.Username = nodeName
	} else if rawNodeID != "" && !strings.HasPrefix(rawNodeID, "guest_worker_") && !strings.HasPrefix(rawNodeID, "node_seller_") {
		target.NodeName = rawNodeID
		target.Username = rawNodeID
	}

	// Cập nhật cấu hình phần cứng thực tế từ Electron Worker
	if hw != nil {
		if hw.CPUCores > 0 {
			target.Hardware.CPUCores = hw.CPUCores
		}
		if hw.DeviceMemoryGB > 0 {
			target.Hardware.DeviceMemoryGB = hw.DeviceMemoryGB
		}
		if hw.GPUName != "" {
			target.Hardware.GPUName = hw.GPUName
			target.Hardware.HasWebGPU = hw.HasWebGPU
			target.Hardware.VRAMGB = hw.VRAMGB
		}
		if hw.OS != "" {
			target.Hardware.OS = hw.OS
		}
	}

	if len(ollamaModels) > 0 {
		target.CompatibleModels = ollamaModels
		target.ActiveModel = ollamaModels[0]
	}

	// Cập nhật trạng thái GPU & LLM từ Telemetry
	target.HasGPU = stats.HasGPU || target.Hardware.HasWebGPU
	if stats.GPUName != "" {
		target.GPUName = stats.GPUName
		target.Hardware.GPUName = stats.GPUName
	}
	if stats.VRAMGB > 0 {
		target.VRAMGB = stats.VRAMGB
		target.Hardware.VRAMGB = stats.VRAMGB
	}
	target.IsLLMRunning = stats.IsLLMRunning || len(ollamaModels) > 0
	if stats.LLMProvider != "" {
		target.LLMProvider = stats.LLMProvider
	}

	// Nếu máy không có GPU rời, tự động khóa cờ EnableGPU của cấu hình cho thuê
	if !target.HasGPU {
		target.RentConfig.EnableGPU = false
	}

	target.LastTelemetry = &stats
	if stats.LLMStats != nil {
		target.LLMStats = stats.LLMStats
	}
	target.UpdatedAt = time.Now()

	if nr.manualPaused[target.ID] {
		target.Status = "OFFLINE"
	} else if stats.LLMStats != nil && stats.LLMStats.IsBusy {
		target.Status = "BUSY"
		target.TotalCoinsEarned += 0.05
		target.UptimeSeconds += 2
	} else {
		target.Status = "IDLE"
		target.TotalCoinsEarned += 0.02
		target.UptimeSeconds += 2
	}

	if nr.postgres != nil {
		// Tạo bản sao snapshot để ghi bất đồng bộ xuống PostgreSQL mà không gây xung đột bộ nhớ (data race)
		nodeSnapshot := *target
		go func(n models.PartnerNode, s models.TelemetryStats) {
			_ = nr.postgres.UpsertNode(&n)
			_ = nr.postgres.UpdateTelemetry(n.ID, s)
		}(nodeSnapshot, stats)
	}

	return target
}

// UpdateTelemetry cập nhật thông số telemetry cho một node theo ID (giữ tương thích ngược).
func (nr *NodeRegistry) UpdateTelemetry(nodeID string, stats models.TelemetryStats) {
	nr.UpsertWorkerTelemetry(nodeID, "", "", nil, nil, stats)
}

// MarkNodeOffline chuyển trạng thái của Node sang OFFLINE khi Electron Worker đóng kết nối hoặc người dùng bấm Tạm Dừng.
func (nr *NodeRegistry) MarkNodeOffline(nodeID string, isManualPause ...bool) {
	nodeID = strings.TrimSpace(nodeID)
	if nodeID == "" || strings.HasPrefix(nodeID, "web_listener_") {
		return
	}

	nr.mu.Lock()
	defer nr.mu.Unlock()

	manual := len(isManualPause) > 0 && isManualPause[0]

	for id, node := range nr.nodes {
		if id == nodeID || (len(nodeID) > 5 && (strings.Contains(id, nodeID) || strings.Contains(nodeID, id))) {
			node.Status = "OFFLINE"
			node.UpdatedAt = time.Now()
			if manual {
				nr.manualPaused[id] = true
			} else {
				node.LastTelemetry = nil
			}

			if nr.postgres != nil {
				go func(nid string) {
					_ = nr.postgres.UpdateStatus(nid, "OFFLINE")
				}(id)
			}
		}
	}
}

// MarkNodeOnline gỡ bỏ trạng thái Tạm Dừng để Node sẵn sàng nhận kết nối và tác vụ từ Electron Worker.
func (nr *NodeRegistry) MarkNodeOnline(nodeID string) {
	nodeID = strings.TrimSpace(nodeID)
	if nodeID == "" {
		return
	}

	nr.mu.Lock()
	defer nr.mu.Unlock()

	for id, node := range nr.nodes {
		if id == nodeID || (len(nodeID) > 5 && (strings.Contains(id, nodeID) || strings.Contains(nodeID, id))) {
			delete(nr.manualPaused, id)
			node.Status = "IDLE"
			node.UpdatedAt = time.Now()

			if nr.postgres != nil {
				go func(nid string) {
					_ = nr.postgres.UpdateStatus(nid, "IDLE")
				}(id)
			}
		}
	}
}

// MarkNodeBusy đặt trạng thái Node sang BUSY khi đang phục vụ phiên thuê hoặc suy luận P2P.
func (nr *NodeRegistry) MarkNodeBusy(nodeID string) {
	nodeID = strings.TrimSpace(nodeID)
	if nodeID == "" {
		return
	}

	nr.mu.Lock()
	defer nr.mu.Unlock()

	for id, node := range nr.nodes {
		if id == nodeID || (len(nodeID) > 5 && (strings.Contains(id, nodeID) || strings.Contains(nodeID, id))) {
			delete(nr.manualPaused, id)
			node.Status = "BUSY"
			node.UpdatedAt = time.Now()

			if nr.postgres != nil {
				go func(nid string) {
					_ = nr.postgres.UpdateStatus(nid, "BUSY")
				}(id)
			}
		}
	}
}
