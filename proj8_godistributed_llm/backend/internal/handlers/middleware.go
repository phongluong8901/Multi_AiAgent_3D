package handlers

import (
	"context"
	"crypto/subtle"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"go-distributed-llm/shared/pkg/auth"
	"go-distributed-llm/shared/ports"

	"github.com/gin-gonic/gin"
)

// --- Cụm Middleware xác thực (Internal Secret & Client API Key) ---

// internalTokenAuthMiddleware bảo vệ nhóm route /internal/v1/* bằng header X-Internal-Token.
func internalTokenAuthMiddleware(expectedToken string) gin.HandlerFunc {
	return func(c *gin.Context) {
		if !auth.VerifyInternalToken(expectedToken, c.GetHeader(auth.InternalTokenHeader)) {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "unauthorized: invalid or missing internal token"})
			return
		}
		c.Next()
	}
}

// apiKeyAuthMiddleware xác thực client qua header X-API-Key hoặc Authorization Bearer (so sánh constant-time).
// Nếu expectedKey rỗng, middleware tự động cho phép truy cập không cần key.
func apiKeyAuthMiddleware(expectedKey string) gin.HandlerFunc {
	trimmedExpected := strings.TrimSpace(expectedKey)
	return func(c *gin.Context) {
		if trimmedExpected == "" {
			c.Next()
			return
		}

		provided := strings.TrimSpace(c.GetHeader("X-API-Key"))
		if provided == "" {
			authHeader := c.GetHeader("Authorization")
			if strings.HasPrefix(strings.ToLower(authHeader), "bearer ") {
				provided = strings.TrimSpace(authHeader[7:])
			}
		}

		if subtle.ConstantTimeCompare([]byte(provided), []byte(trimmedExpected)) != 1 {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "unauthorized: invalid or missing API key"})
			return
		}
		c.Next()
	}
}

// --- Cụm Rate Limiter In-Memory fallback & Middleware giới hạn tốc độ (RPM) ---

// rateWindow lưu bộ đếm request và mốc reset của một client trong bộ nhớ cục bộ.
type rateWindow struct {
	count   int
	resetAt time.Time
}

// memoryRateLimiter là fallback của ports.RateLimiter dùng khi test đơn lẻ không có Redis.
type memoryRateLimiter struct {
	mu      sync.Mutex
	windows map[string]*rateWindow
}

// newMemoryRateLimiter khởi tạo rate limiter cục bộ theo sliding fixed window.
func newMemoryRateLimiter() *memoryRateLimiter {
	return &memoryRateLimiter{windows: make(map[string]*rateWindow)}
}

// Allow kiểm tra và tăng số lượt request của key trong khoảng window.
func (m *memoryRateLimiter) Allow(_ context.Context, key string, limit int, window time.Duration) (bool, int, error) {
	now := time.Now()
	m.mu.Lock()
	defer m.mu.Unlock()

	if len(m.windows) > 1024 {
		for k, w := range m.windows {
			if now.After(w.resetAt) {
				delete(m.windows, k)
			}
		}
	}

	win, exists := m.windows[key]
	if !exists || now.After(win.resetAt) {
		win = &rateWindow{count: 0, resetAt: now.Add(window)}
		m.windows[key] = win
	}

	win.count++
	if win.count > limit {
		retry := int(time.Until(win.resetAt).Seconds())
		if retry < 1 {
			retry = 1
		}
		return false, retry, nil
	}
	return true, 0, nil
}

// rateLimitMiddleware dùng ports.RateLimiter (Redis phân tán khi chạy cụm nhiều Gateway,
// fallback memoryRateLimiter khi test đơn lẻ).
func rateLimitMiddleware(rpm int, limiter ports.RateLimiter) gin.HandlerFunc {
	if rpm <= 0 {
		return func(c *gin.Context) { c.Next() }
	}
	if limiter == nil {
		limiter = newMemoryRateLimiter()
	}

	return func(c *gin.Context) {
		clientKey := strings.TrimSpace(c.GetHeader("X-API-Key"))
		if clientKey == "" {
			clientKey = c.ClientIP()
		}

		allowed, retryAfter, err := limiter.Allow(c.Request.Context(), clientKey, rpm, time.Minute)
		if err == nil && !allowed {
			c.Header("Retry-After", strconv.Itoa(retryAfter))
			c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{
				"error": "rate limit exceeded: too many requests per minute",
			})
			return
		}
		c.Next()
	}
}

// corsMiddleware cấu hình CORS headers và trả về 204 cho preflight OPTIONS requests.
func corsMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-API-Key, X-Trace-Id")
		c.Writer.Header().Set("Access-Control-Expose-Headers", "X-Job-Id, X-Conversation-Id, X-Trace-Id")
		if c.Request.Method == http.MethodOptions {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}
		c.Next()
	}
}
