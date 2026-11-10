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

func NewAdminHandler(admin *services.AdminService) *AdminHandler {
	return &AdminHandler{admin: admin}
}

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

func (h *AdminHandler) GetQueueStats(c *gin.Context) {
	stats, err := h.admin.GetQueueStats(c.Request.Context(), c.Query("models"))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"queues": stats})
}

func (h *AdminHandler) DrainNode(c *gin.Context) {
	workerID := c.Param("id")
	if err := h.admin.SetNodeDraining(c.Request.Context(), workerID, true); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"worker_id": workerID, "status": "DRAINING"})
}

func (h *AdminHandler) ResumeNode(c *gin.Context) {
	workerID := c.Param("id")
	if err := h.admin.SetNodeDraining(c.Request.Context(), workerID, false); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"worker_id": workerID, "status": "ONLINE"})
}

