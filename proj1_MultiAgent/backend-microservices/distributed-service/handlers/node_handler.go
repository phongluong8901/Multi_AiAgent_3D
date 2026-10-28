package handlers

import (
	"encoding/json"
	"net/http"
	"strings"

	"distributed-service/models"
	"distributed-service/service"
)

type NodeHandler struct {
	registry        *service.NodeRegistry
	benchmarkEngine *service.BenchmarkEngine
	distributor     *service.AppDistributor
}

func NewNodeHandler(registry *service.NodeRegistry, benchmarkEngine *service.BenchmarkEngine, distributor *service.AppDistributor) *NodeHandler {
	return &NodeHandler{
		registry:        registry,
		benchmarkEngine: benchmarkEngine,
		distributor:     distributor,
	}
}

// HandleRegisterNode đăng ký đối tác mô hình và cấu hình cho thuê phần cứng
func (h *NodeHandler) HandleRegisterNode(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	if r.Method != http.MethodPost {
		http.Error(w, `{"error":"Method not allowed, use POST"}`, http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		UserID     string                   `json:"userId"`
		Username   string                   `json:"username"`
		Email      string                   `json:"email"`
		Hardware   models.HardwareReport    `json:"hardware"`
		RentConfig models.RentConfiguration `json:"rentConfig"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"Invalid request payload"}`, http.StatusBadRequest)
		return
	}

	// Đánh giá các model tương thích dựa trên cấu hình cho thuê
	evalHW := req.Hardware
	if req.RentConfig.AllocatedCores > 0 {
		evalHW.CPUCores = req.RentConfig.AllocatedCores
	}
	if req.RentConfig.AllocatedRAMGB > 0 {
		evalHW.DeviceMemoryGB = req.RentConfig.AllocatedRAMGB
	}
	if !req.RentConfig.EnableGPU {
		evalHW.HasWebGPU = false
		evalHW.GPUName = ""
		evalHW.VRAMGB = 0
	}

	benchResult := h.benchmarkEngine.EvaluateHardware(evalHW)
	var compatibleModels []string
	for _, m := range benchResult.EligibleModels {
		if m.IsEligible {
			compatibleModels = append(compatibleModels, m.ModelID)
		}
	}

	node := &models.PartnerNode{
		UserID:           req.UserID,
		Username:         req.Username,
		Email:            req.Email,
		Hardware:         req.Hardware,
		RentConfig:       req.RentConfig,
		CompatibleModels: compatibleModels,
		Status:           "IDLE",
	}

	registeredNode := h.registry.RegisterOrUpdateNode(node)
	packageInfo := h.distributor.GetPackageInfo()

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success":         true,
		"message":         "Chúc mừng! Bạn đã đăng ký Đối tác Mô hình thành công.",
		"node":            registeredNode,
		"benchmark":       benchResult,
		"clientApp":       packageInfo,
		"configFileUrl":   "/api/v1/distributed/app/config-file?nodeId=" + registeredNode.ID,
		"directSetupUrl":  "/api/v1/distributed/app/download",
	})
}

// HandleGetMyNode lấy thông tin chi tiết node hiện tại của người dùng
func (h *NodeHandler) HandleGetMyNode(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	token := r.URL.Query().Get("token")
	nodeID := r.URL.Query().Get("nodeId")
	userID := r.URL.Query().Get("userId")

	if auth := r.Header.Get("Authorization"); auth != "" && token == "" {
		token = strings.TrimPrefix(auth, "Bearer ")
	}

	var node *models.PartnerNode
	var found bool

	if token != "" {
		node, found = h.registry.GetNodeByToken(token)
	} else if nodeID != "" {
		node, found = h.registry.GetNodeByID(nodeID)
	} else if userID != "" {
		node, found = h.registry.GetNodeByID("node_" + userID)
	}

	if !found || node == nil {
		// Trả về fallback hoặc thông báo chưa đăng ký
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success":    false,
			"isPartner":  false,
			"message":    "Chưa có cấu hình Đối tác Mô hình cho tài khoản này.",
		})
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success":   true,
		"isPartner": true,
		"node":      node,
	})
}

// HandleListNodes liệt kê danh sách các node đối tác đang tham gia cụm phân tán
func (h *NodeHandler) HandleListNodes(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	nodes := h.registry.GetAllNodes()
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"count":   len(nodes),
		"nodes":   nodes,
	})
}

// HandleToggleNodeStatus cho phép người dùng bật/tắt chia sẻ tài nguyên trực tiếp trên Web hoặc Desktop
func (h *NodeHandler) HandleToggleNodeStatus(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	if r.Method != http.MethodPost {
		http.Error(w, `{"error":"Method not allowed, use POST"}`, http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		NodeID string `json:"nodeId"`
		Status string `json:"status"` // "IDLE", "ONLINE", "OFFLINE", "PAUSED"
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"Invalid request payload"}`, http.StatusBadRequest)
		return
	}

	if req.NodeID == "" {
		http.Error(w, `{"error":"nodeId is required"}`, http.StatusBadRequest)
		return
	}

	if req.Status == "OFFLINE" || req.Status == "PAUSED" {
		h.registry.MarkNodeOffline(req.NodeID)
	} else {
		h.registry.MarkNodeOnline(req.NodeID)
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"nodeId":  req.NodeID,
		"status":  req.Status,
		"message": "Đã cập nhật trạng thái kết nối thành công.",
	})
}

