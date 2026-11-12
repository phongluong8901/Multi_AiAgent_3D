package handlers

import (
	"net/http"

	"go-distributed-llm/internal/metrics"
	"go-distributed-llm/internal/services"
	"go-distributed-llm/shared/ports"

	"github.com/gin-gonic/gin"
)

// GatewayRouterDeps gom các service, metrics, rate limiter và cấu hình bảo mật để dựng HTTP Router.
type GatewayRouterDeps struct {
	ChatService   *services.ChatService
	AdminService  *services.AdminService
	Metrics       *metrics.GatewayMetrics
	RateLimiter   ports.RateLimiter
	APIKey        string
	InternalToken string
	RateLimitRPM  int
}

// NewRouter cấu hình route công khai (/api/v1/*), chuẩn OpenAI (/v1/*), Prometheus (/metrics), và internal (/internal/v1/*).
func NewRouter(deps GatewayRouterDeps) *gin.Engine {
	r := gin.New()
	r.Use(gin.Recovery(), gin.Logger(), corsMiddleware())

	r.GET("/healthz", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	if deps.Metrics != nil {
		r.GET("/metrics", func(c *gin.Context) {
			c.Data(http.StatusOK, "text/plain; version=0.0.4; charset=utf-8", []byte(deps.Metrics.RenderPrometheus()))
		})
	}

	chatH := NewChatHandler(deps.ChatService, deps.Metrics)
	adminH := NewAdminHandler(deps.AdminService)
	openAIH := NewOpenAIHandler(deps.ChatService, deps.AdminService, deps.Metrics)

	authMW := apiKeyAuthMiddleware(deps.APIKey)
	rateMW := rateLimitMiddleware(deps.RateLimitRPM, deps.RateLimiter)

	api := r.Group("/api/v1", authMW, rateMW)
	{
		api.POST("/chat", chatH.ChatSync)
		api.POST("/chat/stream", chatH.StreamChat)
		api.POST("/chat/:id/stop", chatH.StopJob)
		api.GET("/chat/conversations", chatH.ListConversations)
		api.GET("/chat/:conversation_id/history", chatH.GetHistory)

		api.GET("/admin/nodes", adminH.ListNodes)
		api.GET("/admin/queues", adminH.GetQueueStats)
		api.POST("/admin/nodes/:id/drain", adminH.DrainNode)
		api.POST("/admin/nodes/:id/resume", adminH.ResumeNode)
	}

	// Chuẩn OpenAI SDK (/v1/chat/completions, /v1/models)
	v1 := r.Group("/v1", authMW, rateMW)
	{
		v1.GET("/models", openAIH.ListModels)
		v1.POST("/chat/completions", openAIH.ChatCompletions)
	}

	internalH := NewInternalHandler(deps.ChatService)
	internalMW := internalTokenAuthMiddleware(deps.InternalToken)
	internal := r.Group("/internal/v1", internalMW)
	{
		internal.POST("/tokens/stream", internalH.PushTokensHTTP)
		internal.POST("/tokens/push", internalH.PushTokenHTTP)
	}

	return r
}
