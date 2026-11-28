package bus

import (
	"context"
	"protocol-testbench/internal/core"
)

type MemoryBus struct {
	ch chan core.UnifiedPacket
}

func NewMemoryBus(bufferSize int) *MemoryBus {
	return &MemoryBus{ch: make(chan core.UnifiedPacket, bufferSize)}
}

func (m *MemoryBus) Publish(_ context.Context, pkt core.UnifiedPacket) error {
	select {
	case m.ch <- pkt:
	default: // Drop nếu đầy buffer khi stress test
	}
	return nil
}

func (m *MemoryBus) Subscribe(ctx context.Context, handler func(core.UnifiedPacket)) {
	go func() {
		for {
			select {
			case <-ctx.Done():
				return
			case pkt := <-m.ch:
				handler(pkt)
			}
		}
	}()
}
