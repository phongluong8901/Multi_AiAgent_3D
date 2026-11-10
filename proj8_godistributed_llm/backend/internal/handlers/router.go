package handlers

import (
	"net/http"

	"go-distributed-llm/internal/services"

	"github.com/gin-gonic/gin"
)

// GatewayRouterDeps gom các service và cấu hình bảo mật để dựng HTTP Router.
type GatewayRouterDeps struct {
	ChatService  *services.ChatService
	AdminService *services.AdminService
	APIKey       string
}

// NewRouter cấu hình toàn bộ route công khai (/api/v1/*) và route nội bộ (/internal/v1/*).
func NewRouter(deps GatewayRouterDeps) *gin.Engine {
	r := gin.New()
	r.Use(gin.Recovery(), gin.Logger(), corsMiddleware())

	r.GET("/healthz", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	chatH := NewChatHandler(deps.ChatService)
	adminH := NewAdminHandler(deps.AdminService)
	internalH := NewInternalHandler(deps.ChatService)

	api := r.Group("/api/v1", apiKeyAuthMiddleware(deps.APIKey))
	{
		api.POST("/chat", chatH.ChatSync)
		api.POST("/chat/stream", chatH.StreamChat)
		api.POST("/chat/:id/stop", chatH.StopJob)
		api.GET("/chat/:conversation_id/history", chatH.GetHistory)

		api.GET("/admin/nodes", adminH.ListNodes)
		api.GET("/admin/queues", adminH.GetQueueStats)
		api.POST("/admin/nodes/:id/drain", adminH.DrainNode)
		api.POST("/admin/nodes/:id/resume", adminH.ResumeNode)
	}

	internal := r.Group("/internal/v1")
	{
		internal.POST("/tokens/stream", internalH.PushTokensHTTP)
		internal.POST("/tokens/push", internalH.PushTokenHTTP)
	}

	return r
}

