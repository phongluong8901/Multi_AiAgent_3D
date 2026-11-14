// Package netutil chứa các tiện ích mạng dùng chung cho các plugin giao thức.
package netutil

import (
	"errors"
	"log"
	"net"
	"net/http"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

// HTTPServer quản lý vòng đời 1 http.Server với bind cổng đồng bộ.
type HTTPServer struct {
	mu  sync.Mutex
	srv *http.Server
}

// Start bind cổng ngay (trả lỗi nếu cổng bị chiếm) rồi phục vụ ở goroutine nền.
func (h *HTTPServer) Start(addr string, handler http.Handler) error {
	ln, err := net.Listen("tcp", addr)
	if err != nil {
		return err
	}
	srv := &http.Server{Handler: handler, ReadHeaderTimeout: 10 * time.Second}
	h.mu.Lock()
	h.srv = srv
	h.mu.Unlock()

	go func() {
		if err := srv.Serve(ln); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Printf("[ERROR] http server %s: %v", addr, err)
		}
	}()
	return nil
}

// Stop đóng listener và mọi kết nối HTTP (kể cả stream SSE/MJPEG đang mở). Idempotent.
func (h *HTTPServer) Stop() error {
	h.mu.Lock()
	srv := h.srv
	h.srv = nil
	h.mu.Unlock()
	if srv == nil {
		return nil
	}
	return srv.Close()
}

// Upgrader dùng chung cho WebSocket / Socket.IO (cho phép mọi origin để test nội bộ).
var Upgrader = websocket.Upgrader{
	ReadBufferSize:  4096,
	WriteBufferSize: 4096,
	CheckOrigin:     func(*http.Request) bool { return true },
}

// SafeWS bọc kết nối gorilla để ghi an toàn từ nhiều goroutine
// (gorilla/websocket panic nếu 2 goroutine ghi đồng thời).
type SafeWS struct {
	conn *websocket.Conn
	mu   sync.Mutex
}

func NewSafeWS(c *websocket.Conn) *SafeWS { return &SafeWS{conn: c} }

func (s *SafeWS) Conn() *websocket.Conn { return s.conn }

func (s *SafeWS) WriteText(b []byte) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	_ = s.conn.SetWriteDeadline(time.Now().Add(2 * time.Second))
	return s.conn.WriteMessage(websocket.TextMessage, b)
}

func (s *SafeWS) Close() error { return s.conn.Close() }

// AllowCORS cho phép trình duyệt ở origin khác gọi trực tiếp vào cổng của plugin.
func AllowCORS(w http.ResponseWriter) {
	h := w.Header()
	h.Set("Access-Control-Allow-Origin", "*")
	h.Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
	h.Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
}

// WSFrameOverhead trả số byte header khung WebSocket server -> client (không mask).
func WSFrameOverhead(payloadLen int) int {
	switch {
	case payloadLen < 126:
		return 2
	case payloadLen < 65536:
		return 4
	default:
		return 10
	}
}

