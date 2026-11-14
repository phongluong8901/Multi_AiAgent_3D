package websocket

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

// Overhead khung client -> server: 2 byte header + 4 byte mask key.
const clientFrameOverhead = 6

// WSPlugin: WebSocket thuần, full-duplex 2 chiều (ws://host:port/ws).
type WSPlugin struct {
	port     string
	server   netutil.HTTPServer
	running  atomic.Bool
	connsMu  sync.RWMutex
	conns    map[*netutil.SafeWS]struct{}
	counters core.Counters
	seq      atomic.Uint64
}

func NewWSPlugin(port string) *WSPlugin {
	return &WSPlugin{port: port, conns: make(map[*netutil.SafeWS]struct{})}
}

func (w *WSPlugin) Name() string { return "websocket" }

func (w *WSPlugin) Start(ctx context.Context, inbound chan<- core.UnifiedPacket) error {
	mux := http.NewServeMux()
	mux.HandleFunc("/ws", func(rw http.ResponseWriter, r *http.Request) {
		w.handle(rw, r, inbound)
	})
	if err := w.server.Start(w.port, mux); err != nil {
		return err
	}
	w.running.Store(true)
	go func() {
		<-ctx.Done()
		_ = w.Stop(context.Background())
	}()
	return nil
}

func (w *WSPlugin) handle(rw http.ResponseWriter, r *http.Request, inbound chan<- core.UnifiedPacket) {
	conn, err := netutil.Upgrader.Upgrade(rw, r, nil)
	if err != nil {
		return // Upgrade đã tự trả lỗi HTTP cho client
	}
	sc := netutil.NewSafeWS(conn)
	w.connsMu.Lock()
	w.conns[sc] = struct{}{}
	w.connsMu.Unlock()
	w.counters.Clients.Add(1)
	defer func() {
		w.connsMu.Lock()
		delete(w.conns, sc)
		w.connsMu.Unlock()
		w.counters.Clients.Add(-1)
		_ = sc.Close()
	}()

	conn.SetReadLimit(1 << 20)
	_ = sc.WriteText([]byte(`{"type":"hello","protocol":"websocket"}`))

	for {
		_, msg, err := conn.ReadMessage()
		if err != nil {
			return
		}
		w.counters.In(len(msg) + clientFrameOverhead)
		inbound <- core.UnifiedPacket{
			ID:            fmt.Sprintf("ws_%d", w.seq.Add(1)),
			SourceProto:   "websocket",
			ClientID:      r.RemoteAddr,
			TopicOrRoute:  "/ws",
			Payload:       msg,
			PayloadSize:   len(msg),
			OverheadBytes: clientFrameOverhead,
			CreatedAtNano: time.Now().UnixNano(),
		}
	}
}

// Stop đóng listener và cả các kết nối WebSocket đã hijack (http.Server.Close không tự đóng).
func (w *WSPlugin) Stop(context.Context) error {
	w.running.Store(false)
	err := w.server.Stop()
	w.connsMu.RLock()
	for sc := range w.conns {
		_ = sc.Close()
	}
	w.connsMu.RUnlock()
	return err
}

func (w *WSPlugin) Send(pkt core.UnifiedPacket) error {
	if !w.running.Load() {
		return nil
	}
	w.counters.Latency.Observe(pkt.CalculateLatencyMs())
	data := pkt.WireJSON()
	wireBytes := len(data) + netutil.WSFrameOverhead(len(data))

	sent := 0
	w.connsMu.RLock()
	for sc := range w.conns {
		if err := sc.WriteText(data); err == nil {
			w.counters.Out(wireBytes)
			sent++
		}
	}
	w.connsMu.RUnlock()
	if sent == 0 {
		w.counters.Out(wireBytes)
	}
	return nil
}

func (w *WSPlugin) SimulateInbound(payload []byte, inbound chan<- core.UnifiedPacket) core.UnifiedPacket {
	cp := bytes.Clone(payload)
	w.counters.In(len(cp) + clientFrameOverhead)
	pkt := core.UnifiedPacket{
		ID:            fmt.Sprintf("ws_%d", w.seq.Add(1)),
		SourceProto:   "websocket",
		ClientID:      "gateway_sim",
		TopicOrRoute:  "/ws",
		Payload:       cp,
		PayloadSize:   len(cp),
		OverheadBytes: clientFrameOverhead,
		CreatedAtNano: time.Now().UnixNano(),
	}
	if inbound != nil {
		inbound <- pkt
	}
	return pkt
}

func (w *WSPlugin) ResetStats() {
	w.counters.Reset()
}

func (w *WSPlugin) Stats() core.ProtocolStats {
	st := core.ProtocolStats{
		ProtocolName:   "WebSocket (Full-Duplex)",
		Port:           w.port,
		Endpoint:       "ws://<host>" + w.port + "/ws",
		Direction:      "2 chiều",
		IsRunning:      w.running.Load(),
		HeaderOverhead: 2,
	}
	w.counters.Fill(&st)
	return st
}
