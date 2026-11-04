package handlers

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"

	"distributed-service/models"
	"distributed-service/service"
)

type AppHandler struct {
	distributor *service.AppDistributor
	registry    *service.NodeRegistry
}

func NewAppHandler(distributor *service.AppDistributor, registry *service.NodeRegistry) *AppHandler {
	return &AppHandler{
		distributor: distributor,
		registry:    registry,
	}
}

// HandleGetAppInfo trả về thông tin chi tiết gói phần mềm Electron Desktop Client
func (h *AppHandler) HandleGetAppInfo(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if r.Method != http.MethodGet {
		http.Error(w, `{"error":"Method not allowed, use GET"}`, http.StatusMethodNotAllowed)
		return
	}

	info := h.distributor.GetPackageInfo()
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"app":     info,
	})
}

// HandleDownloadApp gửi file cài đặt Electron App (Go + Python Worker + React Desktop) cho người dùng
func (h *AppHandler) HandleDownloadApp(w http.ResponseWriter, r *http.Request) {
	filePath, err := h.distributor.GetAppFilePath()
	if err != nil {
		// Nếu chưa build file .exe, trả về JSON hướng dẫn hoặc bundle kịch bản chạy
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"message": "File cài đặt chưa có sẵn ở thư mục release. Bạn có thể khởi động trực tiếp mã nguồn trong worker-client:",
			"quickStart": []string{
				"1. cd worker-client && npm start",
				"2. cd worker-client && python worker.py",
			},
		})
		return
	}

	file, err := os.Open(filePath)
	if err != nil {
		http.Error(w, fmt.Sprintf("Không thể đọc file cài đặt: %v", err), http.StatusInternalServerError)
		return
	}
	defer file.Close()

	fi, err := file.Stat()
	if err != nil {
		http.Error(w, fmt.Sprintf("Lỗi stat file: %v", err), http.StatusInternalServerError)
		return
	}

	filename := filepath.Base(filePath)
	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s\"", filename))
	w.Header().Set("Content-Type", "application/vnd.microsoft.portable-executable")
	w.Header().Set("Content-Length", fmt.Sprintf("%d", fi.Size()))

	// Streaming file cho client tải xuống
	io.Copy(w, file)
}

// HandleDownloadConfigFile tạo và tải file worker-config.json cá nhân hóa cho node
func (h *AppHandler) HandleDownloadConfigFile(w http.ResponseWriter, r *http.Request) {
	nodeID := r.URL.Query().Get("nodeId")
	token := r.URL.Query().Get("token")

	var targetNode *models.PartnerNode

	if nodeID != "" {
		if node, exists := h.registry.GetNodeByID(nodeID); exists {
			targetNode = node
		}
	} else if token != "" {
		if node, exists := h.registry.GetNodeByToken(token); exists {
			targetNode = node
		}
	}

	if targetNode == nil {
		// Tạo node tạm mặc định nếu chưa lưu
		targetNode = &models.PartnerNode{
			ID:        "node_default_worker",
			AuthToken: "tok_quickstart_worker",
			RentConfig: models.RentConfiguration{
				AllocatedCores:  4,
				AllocatedRAMGB:  8,
				EnableGPU:       true,
				GPUSharePercent: 50,
			},
			CompatibleModels: []string{"phi-3-mini", "whisper-large-v3"},
		}
	}

	configBytes, err := h.distributor.GenerateNodeConfigFile(targetNode)
	if err != nil {
		http.Error(w, "Lỗi tạo file cấu hình", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Disposition", "attachment; filename=\"worker-config.json\"")
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Content-Length", fmt.Sprintf("%d", len(configBytes)))
	w.WriteHeader(http.StatusOK)
	w.Write(configBytes)
}
