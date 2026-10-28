package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"

	"distributed-service/models"
	"distributed-service/service"
)

type BenchmarkHandler struct {
	engine *service.BenchmarkEngine
}

func NewBenchmarkHandler(engine *service.BenchmarkEngine) *BenchmarkHandler {
	return &BenchmarkHandler{
		engine: engine,
	}
}

// HandleBenchmark tiếp nhận thông số RAM, GPU, CPU và trả về đánh giá model phù hợp
func (h *BenchmarkHandler) HandleBenchmark(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	if r.Method != http.MethodPost {
		http.Error(w, `{"error":"Method not allowed, use POST"}`, http.StatusMethodNotAllowed)
		return
	}

	var hw models.HardwareReport
	if err := json.NewDecoder(r.Body).Decode(&hw); err != nil {
		http.Error(w, `{"error":"Invalid request payload"}`, http.StatusBadRequest)
		return
	}

	// Đảm bảo thông số tối thiểu
	if hw.CPUCores <= 0 {
		hw.CPUCores = 4
	}
	if hw.DeviceMemoryGB <= 0 {
		hw.DeviceMemoryGB = 8
	}

	result := h.engine.EvaluateHardware(hw)
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"data":    result,
	})
}

// HandleGetCatalog trả về danh mục toàn bộ mô hình AI có thể chạy phân tán kèm link tải và setup
func (h *BenchmarkHandler) HandleGetCatalog(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if r.Method != http.MethodGet {
		http.Error(w, `{"error":"Method not allowed, use GET"}`, http.StatusMethodNotAllowed)
		return
	}

	modelsList := h.engine.GetCatalog()
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"total":   len(modelsList),
		"models":  modelsList,
	})
}

// HandleGetDownloadInfo trả về chi tiết thông số tải về và hướng dẫn setup cho một model cụ thể
func (h *BenchmarkHandler) HandleGetDownloadInfo(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if r.Method != http.MethodGet {
		http.Error(w, `{"error":"Method not allowed, use GET"}`, http.StatusMethodNotAllowed)
		return
	}

	modelID := r.URL.Query().Get("id")
	if modelID == "" {
		http.Error(w, `{"error":"Missing model id parameter (e.g., ?id=qwen-2.5-coder-7b)"}`, http.StatusBadRequest)
		return
	}

	spec, found := h.engine.GetModelByID(modelID)
	if !found {
		http.Error(w, fmt.Sprintf(`{"error":"Model '%s' not found in catalog"}`, modelID), http.StatusNotFound)
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success":   true,
		"model":     spec,
		"scriptUrl": fmt.Sprintf("/api/v1/distributed/models/setup-script?id=%s", spec.ID),
	})
}

// HandleDownloadSetupScript sinh và stream file script cài đặt tự động (.bat hoặc .sh) cho người dùng
func (h *BenchmarkHandler) HandleDownloadSetupScript(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed, use GET", http.StatusMethodNotAllowed)
		return
	}

	modelID := r.URL.Query().Get("id")
	osType := r.URL.Query().Get("os")
	if modelID == "" {
		http.Error(w, "Thiếu tham số id của mô hình", http.StatusBadRequest)
		return
	}
	if osType == "" {
		osType = "windows"
	}

	filename, content, err := h.engine.GenerateSetupScript(modelID, osType)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s\"", filename))
	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	w.Header().Set("Content-Length", fmt.Sprintf("%d", len(content)))
	w.WriteHeader(http.StatusOK)
	w.Write([]byte(content))
}
