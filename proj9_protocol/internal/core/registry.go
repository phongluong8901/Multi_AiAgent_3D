package core

import (
	"context"
	"fmt"
	"log"
	"sync"
	"time"
)

// Registry quản lý vòng đời các giao thức và kênh gom gói tin inbound.
type Registry struct {
	mu          sync.RWMutex
	plugins     map[string]ProtocolPlugin
	order       []string
	running     map[string]context.CancelFunc
	InboundChan chan UnifiedPacket
}

func NewRegistry() *Registry {
	return &Registry{
		plugins:     make(map[string]ProtocolPlugin),
		running:     make(map[string]context.CancelFunc),
		InboundChan: make(chan UnifiedPacket, 10000),
	}
}

func (r *Registry) Register(p ProtocolPlugin) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if _, exists := r.plugins[p.Name()]; !exists {
		r.order = append(r.order, p.Name())
	}
	r.plugins[p.Name()] = p
}

// Names trả về danh sách giao thức theo thứ tự đăng ký.
func (r *Registry) Names() []string {
	r.mu.RLock()
	defer r.mu.RUnlock()
	out := make([]string, len(r.order))
	copy(out, r.order)
	return out
}

func (r *Registry) Get(name string) (ProtocolPlugin, bool) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	p, ok := r.plugins[name]
	return p, ok
}

func (r *Registry) IsRunning(name string) bool {
	r.mu.RLock()
	defer r.mu.RUnlock()
	_, ok := r.running[name]
	return ok
}

// Enable bật 1 giao thức. Trả lỗi thật nếu không bind được cổng.
func (r *Registry) Enable(name string) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	p, ok := r.plugins[name]
	if !ok {
		return fmt.Errorf("giao thức %q chưa được đăng ký", name)
	}
	if _, running := r.running[name]; running {
		return nil
	}

	ctx, cancel := context.WithCancel(context.Background())
	if err := p.Start(ctx, r.InboundChan); err != nil {
		cancel()
		log.Printf("[ERROR] [%s] start failed: %v", name, err)
		return fmt.Errorf("không bật được %s (%s): %w", name, p.Stats().Port, err)
	}
	r.running[name] = cancel
	log.Printf("[INFO] [%s] enabled on %s", name, p.Stats().Port)
	return nil
}

// Disable tắt nóng 1 giao thức (đóng cổng, ngắt mọi kết nối).
func (r *Registry) Disable(name string) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	p, ok := r.plugins[name]
	if !ok {
		return fmt.Errorf("giao thức %q chưa được đăng ký", name)
	}
	cancel, running := r.running[name]
	if !running {
		return nil
	}
	delete(r.running, name)
	cancel()

	ctx, done := context.WithTimeout(context.Background(), 2*time.Second)
	defer done()
	if err := p.Stop(ctx); err != nil {
		log.Printf("[WARN] [%s] stop: %v", name, err)
	}
	log.Printf("[INFO] [%s] disabled", name)
	return nil
}

func (r *Registry) StopAll() {
	for _, name := range r.Names() {
		_ = r.Disable(name)
	}
}

// RouteToTarget gửi gói tin tới đúng 1 giao thức đích.
func (r *Registry) RouteToTarget(pkt UnifiedPacket) error {
	r.mu.RLock()
	p, ok := r.plugins[pkt.TargetProto]
	_, running := r.running[pkt.TargetProto]
	r.mu.RUnlock()

	if !ok {
		return fmt.Errorf("không có giao thức %q", pkt.TargetProto)
	}
	if !running {
		return fmt.Errorf("giao thức %q đang tắt", pkt.TargetProto)
	}
	return p.Send(pkt)
}

// Broadcast phát gói tin tới mọi giao thức đang chạy.
func (r *Registry) Broadcast(pkt UnifiedPacket) {
	r.mu.RLock()
	targets := make([]ProtocolPlugin, 0, len(r.running))
	for name := range r.running {
		targets = append(targets, r.plugins[name])
	}
	r.mu.RUnlock()

	for _, p := range targets {
		_ = p.Send(pkt)
	}
}

// SimulateInbound tiêm gói tin trực tiếp qua plugin đang chạy (nếu hỗ trợ InboundSimulator).
func (r *Registry) SimulateInbound(proto string, payload []byte) (UnifiedPacket, bool) {
	r.mu.RLock()
	p, ok := r.plugins[proto]
	_, running := r.running[proto]
	r.mu.RUnlock()
	if !ok || !running {
		return UnifiedPacket{}, false
	}
	if sim, ok := p.(InboundSimulator); ok {
		return sim.SimulateInbound(payload, r.InboundChan), true
	}
	return UnifiedPacket{}, false
}

// AllStats trả thông số theo thứ tự đăng ký; trạng thái chạy lấy từ Registry (nguồn sự thật).
func (r *Registry) AllStats() []ProtocolStats {
	names := r.Names()
	out := make([]ProtocolStats, 0, len(names))
	for _, name := range names {
		p, _ := r.Get(name)
		st := p.Stats()
		st.Key = name
		st.IsRunning = r.IsRunning(name)
		out = append(out, st)
	}
	return out
}

// ResetAllStats đặt lại bộ đếm thống kê của mọi giao thức đã đăng ký.
func (r *Registry) ResetAllStats() {
	for _, name := range r.Names() {
		if p, ok := r.Get(name); ok {
			if resetter, ok := p.(StatsResetter); ok {
				resetter.ResetStats()
			}
		}
	}
}
