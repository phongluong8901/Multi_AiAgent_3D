package socketio

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"protocol-testbench/internal/core"
	"protocol-testbench/internal/netutil"
)

const (
	pingInterval = 25 * time.Second
	// "42[\"packet\"," + "]" ~ overhead của khung EVENT Socket.IO
	eventOverhead = 13
)

type sioConn struct {
	ws    *netutil.SafeWS
	ready atomic.Bool // đã kết nối namespace "/" (nhận "40")
}

// SocketIOPlugin cài đặt tối giản Engine.IO v4 / Socket.IO v4 qua transport websocket.
// Client JS: io("http://host:8083", { transports: ["websocket"] }).
type SocketIOPlugin struct {
	port     string
	server   netutil.HTTPServer
	running  atomic.Bool
	connsMu  sync.RWMutex
	conns    map[*sioConn]struct{}
	counters core.Counters
	seq      atomic.Uint64
}

func NewSocketIOPlugin(port string) *SocketIOPlugin {
	return &SocketIOPlugin{port: port, conns: make(map[*sioConn]struct{})}
}

func (s *SocketIOPlugin) Name() string { return "socketio" }

func (s *SocketIOPlugin) Start(ctx context.Context, inbound chan<- core.UnifiedPacket) error {
	mux := http.NewServeMux()
	mux.HandleFunc("/socket.io/", func(w http.ResponseWriter, r *http.Request) {
		s.handle(w, r, inbound)
	})
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

func (s *SocketIOPlugin) handle(w http.ResponseWriter, r *http.Request, inbound chan<- core.UnifiedPacket) {
	if r.Method == http.MethodOptions {
		netutil.AllowCORS(w)
		w.WriteHeader(http.StatusNoContent)
		return
	}

	transport := r.URL.Query().Get("transport")
	if transport == "polling" {
		netutil.AllowCORS(w)
		sid := r.URL.Query().Get("sid")
		if sid == "" {
			sid = fmt.Sprintf("sid_%d", s.seq.Add(1))
			w.Header().Set("Content-Type", "text/plain; charset=utf-8")
			_, _ = fmt.Fprintf(w, `0{"sid":%q,"upgrades":["websocket"],"pingInterval":%d,"pingTimeout":20000,"maxPayload":1000000}`,
				sid, pingInterval.Milliseconds())
			return
		}
		w.Header().Set("Content-Type", "text/plain; charset=utf-8")
		_, _ = w.Write([]byte("ok"))
		return
	}

	if transport != "websocket" {
		netutil.AllowCORS(w)
		http.Error(w, `chỉ hỗ trợ transport=websocket hoặc handshake EIO=4 transport=polling`, http.StatusBadRequest)
		return
	}
	conn, err := netutil.Upgrader.Upgrade(w, r, nil)
	if err != nil {
		return
	}
	sid := fmt.Sprintf("sid_%d", s.seq.Add(1))
	c := &sioConn{ws: netutil.NewSafeWS(conn)}
	s.connsMu.Lock()
	s.conns[c] = struct{}{}
	s.connsMu.Unlock()
	s.counters.Clients.Add(1)

	done := make(chan struct{})
	defer func() {
		close(done)
		s.connsMu.Lock()
		delete(s.conns, c)
		s.connsMu.Unlock()
		s.counters.Clients.Add(-1)
		_ = c.ws.Close()
	}()

	conn.SetReadLimit(1 << 20)
	open := fmt.Sprintf(`0{"sid":%q,"upgrades":[],"pingInterval":%d,"pingTimeout":20000,"maxPayload":1000000}`,
		sid, pingInterval.Milliseconds())
	if err := c.ws.WriteText([]byte(open)); err != nil {
		return
	}

	// Engine.IO v4: server chủ động ping, client trả "3".
	go func() {
		t := time.NewTicker(pingInterval)
		defer t.Stop()
		for {
			select {
			case <-done:
				return
			case <-t.C:
				if c.ws.WriteText([]byte("2")) != nil {
					return
				}
			}
		}
	}()

	for {
		_, raw, err := conn.ReadMessage()
		if err != nil {
			return
		}
		msg := string(raw)
		switch {
		case msg == "3": // pong
		case msg == "2": // ping từ client
			_ = c.ws.WriteText([]byte("3"))
		case strings.HasPrefix(msg, "40"):
			_ = c.ws.WriteText([]byte(fmt.Sprintf(`40{"sid":%q}`, sid)))
			c.ready.Store(true)
		case strings.HasPrefix(msg, "41"), msg == "1":
			return
		default:
			event, payload := parseEvent(msg)
			s.counters.In(len(raw))
			inbound <- core.UnifiedPacket{
				ID:            fmt.Sprintf("sio_%d", s.seq.Add(1)),
				SourceProto:   "socketio",
				ClientID:      r.RemoteAddr,
				TopicOrRoute:  "event:" + event,
				Payload:       payload,
				PayloadSize:   len(payload),
				OverheadBytes: len(raw) - len(payload),
				CreatedAtNano: time.Now().UnixNano(),
			}
		}
	}
}

// parseEvent tách khung `42["event", data]` (có thể kèm namespace/ack id). Text thô vẫn được nhận.
func parseEvent(msg string) (string, []byte) {
	if !strings.HasPrefix(msg, "42") {
		return "raw", []byte(msg)
	}
	idx := strings.Index(msg, "[")
	if idx < 0 {
		return "raw", []byte(msg)
	}
	var args []json.RawMessage
	if err := json.Unmarshal([]byte(msg[idx:]), &args); err != nil || len(args) == 0 {
		return "raw", []byte(msg)
	}
	var event string
	_ = json.Unmarshal(args[0], &event)
	if len(args) == 1 {
		return event, []byte("null")
	}
	return event, []byte(args[1])
}

func (s *SocketIOPlugin) Stop(context.Context) error {
	s.running.Store(false)
	err := s.server.Stop()
	s.connsMu.RLock()
	for c := range s.conns {
		_ = c.ws.Close()
	}
	s.connsMu.RUnlock()
	return err
}

// Send phát sự kiện "packet" tới mọi client đã kết nối namespace.
func (s *SocketIOPlugin) Send(pkt core.UnifiedPacket) error {
	if !s.running.Load() {
		return nil
	}
	s.counters.Latency.Observe(pkt.CalculateLatencyMs())
	frame := append(append([]byte(`42["packet",`), pkt.WireJSON()...), ']')
	wireBytes := len(frame) + netutil.WSFrameOverhead(len(frame))

	sent := 0
	s.connsMu.RLock()
	for c := range s.conns {
		if !c.ready.Load() {
			continue
		}
		if err := c.ws.WriteText(frame); err == nil {
			s.counters.Out(wireBytes)
			sent++
		}
	}
	s.connsMu.RUnlock()
	if sent == 0 {
		s.counters.Out(wireBytes)
	}
	return nil
}

func (s *SocketIOPlugin) SimulateInbound(payload []byte, inbound chan<- core.UnifiedPacket) core.UnifiedPacket {
	event := "telemetry"
	var meta struct {
		Event string `json:"event"`
	}
	if json.Unmarshal(payload, &meta) == nil && meta.Event != "" {
		event = meta.Event
	}

	cp := bytes.Clone(payload)
	s.counters.In(len(cp) + eventOverhead)
	pkt := core.UnifiedPacket{
		ID:            fmt.Sprintf("sio_%d", s.seq.Add(1)),
		SourceProto:   "socketio",
		ClientID:      "gateway_sim",
		TopicOrRoute:  "event:" + event,
		Payload:       cp,
		PayloadSize:   len(cp),
		OverheadBytes: eventOverhead,
		CreatedAtNano: time.Now().UnixNano(),
	}
	if inbound != nil {
		inbound <- pkt
	}
	return pkt
}

func (s *SocketIOPlugin) ResetStats() {
	s.counters.Reset()
}

func (s *SocketIOPlugin) Stats() core.ProtocolStats {
	st := core.ProtocolStats{
		ProtocolName:   "Socket.IO v4 (transport websocket)",
		Port:           s.port,
		Endpoint:       "/socket.io/?EIO=4&transport=websocket, event \"packet\"",
		Direction:      "2 chiều",
		IsRunning:      s.running.Load(),
		HeaderOverhead: eventOverhead,
	}
	s.counters.Fill(&st)
	return st
}
