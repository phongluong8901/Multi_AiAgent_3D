package worker

import (
	"sync"
	"time"
)

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

func (cb *CircuitBreaker) RecordSuccess() {
	cb.mu.Lock()
	defer cb.mu.Unlock()

	cb.failures = 0
	cb.state = BreakerClosed
	cb.halfOpenInFlight = false
}

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

func (cb *CircuitBreaker) Reset() {
	cb.mu.Lock()
	defer cb.mu.Unlock()

	cb.failures = 0
	cb.state = BreakerClosed
	cb.halfOpenInFlight = false
}

func (cb *CircuitBreaker) State() BreakerState {
	cb.mu.Lock()
	defer cb.mu.Unlock()

	if cb.state == BreakerOpen && time.Since(cb.openedAt) >= cb.cooldown {
		return BreakerHalfOpen
	}
	return cb.state
}

func (cb *CircuitBreaker) Snapshot() (BreakerState, int, int) {
	cb.mu.Lock()
	defer cb.mu.Unlock()

	st := cb.state
	if st == BreakerOpen && time.Since(cb.openedAt) >= cb.cooldown {
		st = BreakerHalfOpen
	}
	return st, cb.failures, cb.failureThreshold
}

func (cb *CircuitBreaker) IsHealthy() bool {
	return cb.State() != BreakerOpen
}

