package handlers

import (
	"net/http"

	"go-distributed-llm/internal/services"

	"github.com/gin-gonic/gin"
)

// AdminHandler tiếp nhận các request giám sát cụm và điều khiển Worker Node.
type AdminHandler struct {
	admin *services.AdminService
}

// NewAdminHandler tạo HTTP handler cho các API quản trị (/api/v1/admin/*).
func NewAdminHandler(admin *services.AdminService) *AdminHandler {
	return &AdminHandler{admin: admin}
}

// ListNodes trả về danh sách các Worker Node đang hoạt động cùng thông số CPU/RAM/VRAM và slot.
func (h *AdminHandler) ListNodes(c *gin.Context) {
	nodes, err := h.admin.ListOnlineNodes(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"total_nodes": len(nodes),
		"nodes":       nodes,
	})
}

// GetQueueStats trả về độ dài hàng đợi hiện tại theo từng model và số job lỗi trong DLQ.
func (h *AdminHandler) GetQueueStats(c *gin.Context) {
	stats, err := h.admin.GetQueueStats(c.Request.Context(), c.Query("models"))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	dlqLen, dlqErr := h.admin.GetDLQLength(c.Request.Context())
	if dlqErr != nil {
		dlqLen = 0
	}
	c.JSON(http.StatusOK, gin.H{"queues": stats, "dlq": dlqLen})
}

// DrainNode đặt Worker Node vào trạng thái DRAINING (ngừng kéo job mới, chạy nốt job đang dở).
func (h *AdminHandler) DrainNode(c *gin.Context) {
	workerID := c.Param("id")
	if err := h.admin.SetNodeDraining(c.Request.Context(), workerID, true); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"worker_id": workerID, "status": "DRAINING"})
}

// ResumeNode đưa Worker Node thoát khỏi trạng thái DRAINING để quay lại nhận job bình thường.
func (h *AdminHandler) ResumeNode(c *gin.Context) {
	workerID := c.Param("id")
	if err := h.admin.SetNodeDraining(c.Request.Context(), workerID, false); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"worker_id": workerID, "status": "ONLINE"})
}

