package services

import (
	"sync"
	"sync/atomic"
	"time"

	"go-distributed-llm/shared/models"
)

const (
	defaultSubscriberBuffer = 256
	normalPushWait          = 50 * time.Millisecond
	criticalPushWait        = 500 * time.Millisecond
)

// subscriber bọc channel của một job kèm RWMutex để tránh panic "send on closed channel"
// khi gRPC/HTTP server đẩy token đồng thời với lúc handler gọi Unregister.
type subscriber struct {
	mu     sync.RWMutex
	closed bool
	ch     chan models.TokenChunk
}

// SSEHub quản lý bản đồ jobID -> Go Channel cho toàn bộ kết nối đang chờ token trên Gateway,
// đồng thời truyền backpressure tự nhiên qua Go channel + timer trước khi ghi nhận drop.
type SSEHub struct {
	clients       sync.Map // map[string]*subscriber
	droppedTokens atomic.Uint64
	onDrop        func()
}

// NewSSEHub tạo trung tâm phân phối token stream cho các request đang mở.
func NewSSEHub() *SSEHub {
	return &SSEHub{}
}

// SetDropObserver gắn callback (VD: tăng Prometheus metric) mỗi khi có token bị drop do client quá chậm.
func (h *SSEHub) SetDropObserver(fn func()) {
	h.onDrop = fn
}

// DroppedCount trả về tổng số token từng bị drop tính từ lúc Gateway khởi động.
func (h *SSEHub) DroppedCount() uint64 {
	return h.droppedTokens.Load()
}

// Register tạo channel nhận token mới cho jobID trước khi đẩy job vào Redis Stream.
func (h *SSEHub) Register(jobID string) <-chan models.TokenChunk {
	sub := &subscriber{
		ch: make(chan models.TokenChunk, defaultSubscriberBuffer),
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
// Nếu buffer đầy, giữ RLock trong một khoảng ngắn để truyền backpressure thực thụ về Worker
// thay vì drop âm thầm; nếu quá thời gian vẫn kẹt mới tăng counter droppedTokens.
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

	select {
	case sub.ch <- chunk:
		return
	default:
	}

	wait := normalPushWait
	if chunk.Done || chunk.Error != "" {
		wait = criticalPushWait
	}
	timer := time.NewTimer(wait)
	defer timer.Stop()

	select {
	case sub.ch <- chunk:
	case <-timer.C:
		h.droppedTokens.Add(1)
		if h.onDrop != nil {
			h.onDrop()
		}
	}
}

