package core

import (
	"sync"
	"sync/atomic"
)

// LatencyMeter tính độ trễ trung bình trượt (EMA) thay vì chỉ lấy giá trị cuối.
type LatencyMeter struct {
	mu      sync.Mutex
	avg     float64
	samples uint64
}

func (l *LatencyMeter) Observe(ms float64) {
	if ms < 0 {
		ms = 0
	}
	l.mu.Lock()
	l.samples++
	if l.samples == 1 {
		l.avg = ms
	} else {
		l.avg = l.avg*0.9 + ms*0.1
	}
	l.mu.Unlock()
}

func (l *LatencyMeter) Value() float64 {
	l.mu.Lock()
	defer l.mu.Unlock()
	return l.avg
}

func (l *LatencyMeter) Reset() {
	l.mu.Lock()
	l.avg = 0
	l.samples = 0
	l.mu.Unlock()
}

// Counters gom các bộ đếm dùng chung cho mọi plugin.
type Counters struct {
	MsgIn    atomic.Uint64
	MsgOut   atomic.Uint64
	BytesIn  atomic.Uint64
	BytesOut atomic.Uint64
	Clients  atomic.Int64
	Latency  LatencyMeter
}

func (c *Counters) In(bytes int) {
	c.MsgIn.Add(1)
	c.BytesIn.Add(uint64(bytes))
}

func (c *Counters) Out(bytes int) {
	c.MsgOut.Add(1)
	c.BytesOut.Add(uint64(bytes))
}

func (c *Counters) Fill(s *ProtocolStats) {
	s.MsgInCount = c.MsgIn.Load()
	s.MsgOutCount = c.MsgOut.Load()
	s.BytesInTotal = c.BytesIn.Load()
	s.BytesOutTotal = c.BytesOut.Load()
	s.ActiveClients = c.Clients.Load()
	s.AvgLatencyMs = c.Latency.Value()
}

// Reset đặt lại số gói, tổng byte và độ trễ về 0 (giữ nguyên số client đang kết nối).
func (c *Counters) Reset() {
	c.MsgIn.Store(0)
	c.MsgOut.Store(0)
	c.BytesIn.Store(0)
	c.BytesOut.Store(0)
	c.Latency.Reset()
}

