package services

import (
	"sync"

	"go-distributed-llm/internal/models"
)

// subscriber bọc channel của một job kèm RWMutex để tránh panic "send on closed channel"
// khi gRPC/HTTP server đẩy token đồng thời với lúc handler gọi Unregister.
type subscriber struct {
	mu     sync.RWMutex
	closed bool
	ch     chan models.TokenChunk
}

// SSEHub quản lý bản đồ jobID -> Go Channel cho toàn bộ kết nối đang chờ token trên Gateway.
type SSEHub struct {
	clients sync.Map // map[string]*subscriber
}

func NewSSEHub() *SSEHub {
	return &SSEHub{}
}

// Register tạo channel nhận token mới cho jobID trước khi đẩy job vào Redis Stream.
func (h *SSEHub) Register(jobID string) <-chan models.TokenChunk {
	sub := &subscriber{
		ch: make(chan models.TokenChunk, 64),
	}
	h.clients.Store(jobID, sub)
	return sub.ch
}

// Unregister đóng channel an toàn khi SSE/REST kết thúc hoặc Client ngắt kết nối.
func (h *SSEHub) Unregister(jobID string) {
	val, ok := h.clients.LoadAndDelete(jobID)
	if !ok {
		return
	}
	sub := val.(*subscriber)
	sub.mu.Lock()
	if !sub.closed {
		sub.closed = true
		close(sub.ch)
	}
	sub.mu.Unlock()
}

// PushToUser bơm token vào channel của đúng job đang chờ.
func (h *SSEHub) PushToUser(chunk models.TokenChunk) {
	val, ok := h.clients.Load(chunk.JobID)
	if !ok {
		return
	}
	sub := val.(*subscriber)
	sub.mu.RLock()
	defer sub.mu.RUnlock()

	if sub.closed {
		return
	}

	// Non-blocking send để tránh nghẽn gRPC/HTTP server nếu client đọc chậm.
	select {
	case sub.ch <- chunk:
	default:
	}
}

