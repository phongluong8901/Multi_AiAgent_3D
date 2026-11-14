package sse

import (
	"bytes"
	"context"
	"fmt"
	"net/http"
	"sync"
	"sync/atomic"
	"time"

	"protocol-testbench/internal/core"
	"protocol-testbench/internal/netutil"
)

// Overhead khung SSE: "data: " (6 byte) + "\n\n" (2 byte).
const frameOverhead = 8

// SSEPlugin: luồng 1 chiều Server -> Client qua HTTP (GET /events).
type SSEPlugin struct {
	port      string
	server    netutil.HTTPServer
	running   atomic.Bool
	clientsMu sync.RWMutex
	clients   map[chan []byte]struct{}
	counters  core.Counters
	seq       atomic.Uint64
}

func NewSSEPlugin(port string) *SSEPlugin {
	return &SSEPlugin{port: port, clients: make(map[chan []byte]struct{})}
}

func (s *SSEPlugin) Name() string { return "sse" }

func (s *SSEPlugin) Start(ctx context.Context, _ chan<- core.UnifiedPacket) error {
	mux := http.NewServeMux()
	mux.HandleFunc("/events", s.handleSSE)
	if err := s.server.Start(s.port, mux); err != nil {
		return err
	}
	s.running.Store(true)
	go func() {
		<-ctx.Done()
		_ = s.Stop(context.Background())
	}()
	return nil
}

func (s *SSEPlugin) Stop(context.Context) error {
	s.running.Store(false)
	return s.server.Stop()
}

func (s *SSEPlugin) Send(pkt core.UnifiedPacket) error {
	if !s.running.Load() {
		return nil
	}
	s.counters.Latency.Observe(pkt.CalculateLatencyMs())
	data := pkt.WireJSON()

	s.clientsMu.RLock()
	n := len(s.clients)
	for ch := range s.clients {
		select {
		case ch <- data:
		default: // client đọc chậm: bỏ qua để không nghẽn server
		}
	}
	s.clientsMu.RUnlock()
	if n == 0 {
		s.counters.Out(len(data) + frameOverhead)
	}
	return nil
}

func (s *SSEPlugin) SimulateInbound(payload []byte, inbound chan<- core.UnifiedPacket) core.UnifiedPacket {
	cp := bytes.Clone(payload)
	s.counters.In(len(cp) + frameOverhead)
	pkt := core.UnifiedPacket{
		ID:            fmt.Sprintf("sse_%d", s.seq.Add(1)),
		SourceProto:   "sse",
		ClientID:      "gateway_sim",
		TopicOrRoute:  "/events",
		Payload:       cp,
		PayloadSize:   len(cp),
		OverheadBytes: frameOverhead,
		CreatedAtNano: time.Now().UnixNano(),
	}
	if inbound != nil {
		inbound <- pkt
	}
	return pkt
}

func (s *SSEPlugin) ResetStats() {
	s.counters.Reset()
}

func (s *SSEPlugin) handleSSE(w http.ResponseWriter, r *http.Request) {
	netutil.AllowCORS(w)
	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "SSE not supported", http.StatusInternalServerError)
		return
	}
	h := w.Header()
	h.Set("Content-Type", "text/event-stream")
	h.Set("Cache-Control", "no-cache")
	h.Set("Connection", "keep-alive")
	h.Set("X-Accel-Buffering", "no")

	ch := make(chan []byte, 256)
	s.clientsMu.Lock()
	s.clients[ch] = struct{}{}
	s.clientsMu.Unlock()
	s.counters.Clients.Add(1)
	defer func() {
		s.clientsMu.Lock()
		delete(s.clients, ch)
		s.clientsMu.Unlock()
		s.counters.Clients.Add(-1)
	}()

	_, _ = fmt.Fprint(w, "data: {\"type\":\"hello\",\"protocol\":\"sse\"}\n\n")
	flusher.Flush()

	keepalive := time.NewTicker(15 * time.Second)
	defer keepalive.Stop()

	for {
		select {
		case <-r.Context().Done():
			return
		case <-keepalive.C:
			if _, err := fmt.Fprint(w, ": keepalive\n\n"); err != nil {
				return
			}
			flusher.Flush()
		case data := <-ch:
			if _, err := fmt.Fprintf(w, "data: %s\n\n", data); err != nil {
				return
			}
			flusher.Flush()
			s.counters.Out(len(data) + frameOverhead)
		}
	}
}

func (s *SSEPlugin) Stats() core.ProtocolStats {
	st := core.ProtocolStats{
		ProtocolName:   "SSE (Server-Sent Events)",
		Port:           s.port,
		Endpoint:       "GET /events",
		Direction:      "Server -> Client",
		IsRunning:      s.running.Load(),
		HeaderOverhead: frameOverhead,
	}
	s.counters.Fill(&st)
	return st
}
