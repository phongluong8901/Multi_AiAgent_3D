package worker

import (
	"sync"
	"time"
)

// BreakerState biểu thị trạng thái hiện tại của Circuit Breaker (CLOSED, OPEN, HALF_OPEN).
type BreakerState string

const (
	BreakerClosed   BreakerState = "CLOSED"
	BreakerOpen     BreakerState = "OPEN"
	BreakerHalfOpen BreakerState = "HALF_OPEN"
)

// CircuitBreaker bảo vệ Worker Node khỏi kéo job về làm sập dây chuyền khi Local LLM Engine đang chết.
// CLOSED -> sau failureThreshold lỗi liên tiếp -> OPEN trong cooldown -> HALF_OPEN thử 1 request hồi phục.
type CircuitBreaker struct {
	mu               sync.Mutex
	state            BreakerState
	failures         int
	failureThreshold int
	cooldown         time.Duration
	openedAt         time.Time
	halfOpenInFlight bool
}

// NewCircuitBreaker khởi tạo bộ ngắt mạch với ngưỡng lỗi failureThreshold (mặc định 3) và thời gian chờ cooldown (mặc định 15s).
func NewCircuitBreaker(failureThreshold int, cooldown time.Duration) *CircuitBreaker {
	if failureThreshold <= 0 {
		failureThreshold = 3
	}
	if cooldown <= 0 {
		cooldown = 15 * time.Second
	}
	return &CircuitBreaker{
		state:            BreakerClosed,
		failureThreshold: failureThreshold,
		cooldown:         cooldown,
	}
}

// Allow quyết định Worker có được phép kéo/xử lý job hay không (tự chuyển OPEN -> HALF_OPEN khi hết cooldown).
func (cb *CircuitBreaker) Allow() bool {
	cb.mu.Lock()
	defer cb.mu.Unlock()

	switch cb.state {
	case BreakerClosed:
		return true
	case BreakerOpen:
		if time.Since(cb.openedAt) >= cb.cooldown {
			cb.state = BreakerHalfOpen
			cb.halfOpenInFlight = true
			return true
		}
		return false
	case BreakerHalfOpen:
		if !cb.halfOpenInFlight {
			cb.halfOpenInFlight = true
			return true
		}
		return false
	default:
		return true
	}
}

// RecordSuccess đặt lại bộ đếm lỗi về 0 và đưa Circuit Breaker về CLOSED.
func (cb *CircuitBreaker) RecordSuccess() {
	cb.mu.Lock()
	defer cb.mu.Unlock()

	cb.failures = 0
	cb.state = BreakerClosed
	cb.halfOpenInFlight = false
}

// RecordFailure tăng biến đếm lỗi và mở mạch (OPEN) nếu đạt ngưỡng failureThreshold hoặc probe HALF_OPEN thất bại.
func (cb *CircuitBreaker) RecordFailure() BreakerState {
	cb.mu.Lock()
	defer cb.mu.Unlock()

	cb.halfOpenInFlight = false
	cb.failures++
	if cb.state == BreakerHalfOpen || cb.failures >= cb.failureThreshold {
		cb.state = BreakerOpen
		cb.openedAt = time.Now()
	}
	return cb.state
}

// Reset ép đưa Circuit Breaker về CLOSED (thường gọi thủ công từ Worker Console hoặc Desktop App).
func (cb *CircuitBreaker) Reset() {
	cb.mu.Lock()
	defer cb.mu.Unlock()

	cb.failures = 0
	cb.state = BreakerClosed
	cb.halfOpenInFlight = false
}

// State trả về trạng thái logic hiện tại (tính cả trường hợp đã hết cooldown để chuyển sang HALF_OPEN).
func (cb *CircuitBreaker) State() BreakerState {
	cb.mu.Lock()
	defer cb.mu.Unlock()

	if cb.state == BreakerOpen && time.Since(cb.openedAt) >= cb.cooldown {
		return BreakerHalfOpen
	}
	return cb.state
}

// Snapshot trả về bộ (trạng thái hiện tại, số lỗi liên tiếp, ngưỡng lỗi) để hiển thị UI.
func (cb *CircuitBreaker) Snapshot() (BreakerState, int, int) {
	cb.mu.Lock()
	defer cb.mu.Unlock()

	st := cb.state
	if st == BreakerOpen && time.Since(cb.openedAt) >= cb.cooldown {
		st = BreakerHalfOpen
	}
	return st, cb.failures, cb.failureThreshold
}

// IsHealthy trả về true nếu mạch chưa bị ngắt hoàn toàn (khác OPEN).
func (cb *CircuitBreaker) IsHealthy() bool {
	return cb.State() != BreakerOpen
}

