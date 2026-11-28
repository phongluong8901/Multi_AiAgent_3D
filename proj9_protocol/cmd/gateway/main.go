package main

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"sync"
	"sync/atomic"
	"syscall"
	"time"

	"protocol-testbench/internal/bus"
	"protocol-testbench/internal/core"
	"protocol-testbench/internal/netutil"
	"protocol-testbench/internal/protocols/grpc_stream"
	"protocol-testbench/internal/protocols/http_rest"
	"protocol-testbench/internal/protocols/mjpeg"
	"protocol-testbench/internal/protocols/mqtt"
	"protocol-testbench/internal/protocols/ndjson"
	"protocol-testbench/internal/protocols/rtp_udp"
	"protocol-testbench/internal/protocols/socketio"
	"protocol-testbench/internal/protocols/sse"
	"protocol-testbench/internal/protocols/tcp_raw"
	wsplugin "protocol-testbench/internal/protocols/websocket"

	"github.com/gorilla/websocket"
	mqttpackets "github.com/mochi-mqtt/server/v2/packets"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
)

const udpKeepaliveMarker = "__udp_peer_init__"

// WorkerPacketEvent đại diện cho một gói tin đã qua bộ xử lý Worker Monitor.
type WorkerPacketEvent struct {
	ID             string  `json:"id"`
	SourceProto    string  `json:"source_proto"`
	OriginalSize   int     `json:"original_size"`
	OriginalData   string  `json:"original_data"`
	ProcessedData  string  `json:"processed_data"`
	ReceivedAt     string  `json:"received_at"`
	TransitLatency float64 `json:"transit_latency_ms"`
}

// workerMonitor lưu trạng thái Worker Monitor tích hợp sẵn trên Gateway (:8080/worker.html).
type workerMonitor struct {
	totalReceived  atomic.Uint64
	totalProcessed atomic.Uint64
	latencyMeter   core.LatencyMeter
	redisConnected atomic.Bool

	recentMu     sync.RWMutex
	recentEvents []WorkerPacketEvent

	sseMu      sync.RWMutex
	sseClients map[chan string]bool
}

func newWorkerMonitor() *workerMonitor {
	return &workerMonitor{
		sseClients: make(map[chan string]bool),
	}
}

func (w *workerMonitor) Process(pkt core.UnifiedPacket) WorkerPacketEvent {
	w.totalReceived.Add(1)
	if pkt.ID == "" {
		pkt.ID = fmt.Sprintf("pkt_%d", time.Now().UnixNano()%100000)
	}
	if pkt.SourceProto == "" {
		pkt.SourceProto = "unknown"
	}
	if pkt.PayloadSize == 0 {
		pkt.PayloadSize = len(pkt.Payload)
	}

	latency := pkt.CalculateLatencyMs()
	if latency < 0 {
		latency = 0
	}
	w.latencyMeter.Observe(latency)

	processed := fmt.Sprintf(
		`{"worker_node":"worker_01","ai_tag":"annotated","model":"yolo_v8","source":%q,"content":%s}`,
		pkt.SourceProto,
		string(jsonOrQuote(pkt.Payload)),
	)

	event := WorkerPacketEvent{
		ID:             pkt.ID,
		SourceProto:    pkt.SourceProto,
		OriginalSize:   pkt.PayloadSize,
		OriginalData:   string(pkt.Payload),
		ProcessedData:  processed,
		ReceivedAt:     time.Now().Format("15:04:05.000"),
		TransitLatency: latency,
	}

	w.recentMu.Lock()
	w.recentEvents = append([]WorkerPacketEvent{event}, w.recentEvents...)
	if len(w.recentEvents) > 50 {
		w.recentEvents = w.recentEvents[:50]
	}
	w.recentMu.Unlock()

	w.totalProcessed.Add(1)

	if rawEvent, err := json.Marshal(event); err == nil {
		w.broadcastSSE(string(rawEvent))
	}
	return event
}

func (w *workerMonitor) broadcastSSE(msg string) {
	w.sseMu.RLock()
	targets := make([]chan string, 0, len(w.sseClients))
	for ch := range w.sseClients {
		targets = append(targets, ch)
	}
	w.sseMu.RUnlock()

	for _, ch := range targets {
		select {
		case ch <- msg:
		default:
		}
	}
}

func (w *workerMonitor) Snapshot() map[string]interface{} {
	w.recentMu.RLock()
	snapshot := make([]WorkerPacketEvent, len(w.recentEvents))
	copy(snapshot, w.recentEvents)
	w.recentMu.RUnlock()

	return map[string]interface{}{
		"worker_id":       "worker_01 (gateway)",
		"redis_connected": w.redisConnected.Load(),
		"total_received":  w.totalReceived.Load(),
		"total_processed": w.totalProcessed.Load(),
		"avg_latency_ms":  w.latencyMeter.Value(),
		"recent_events":   snapshot,
	}
}

func (w *workerMonitor) Clear() {
	w.recentMu.Lock()
	w.recentEvents = nil
	w.recentMu.Unlock()
}

func (w *workerMonitor) Reset() {
	w.totalReceived.Store(0)
	w.totalProcessed.Store(0)
	w.latencyMeter.Reset()
	w.Clear()
}

// gatewayApp đóng gói toàn bộ trạng thái Gateway để vừa chạy server vừa dễ kiểm thử bằng httptest.
type gatewayApp struct {
	reg                 *core.Registry
	worker              *workerMonitor
	targetProto         atomic.Value
	redisBus            *bus.RedisBus
	redisAvailable      atomic.Bool
	workerForwardCh     chan core.UnifiedPacket
	disableLoopbackDial bool

	connsMu    sync.RWMutex
	wsConns    map[*netutil.SafeWS]bool
	sseChans   map[chan string]bool
}

func newGatewayApp() *gatewayApp {
	app := &gatewayApp{
		reg:             core.NewRegistry(),
		worker:          newWorkerMonitor(),
		workerForwardCh: make(chan core.UnifiedPacket, 2048),
		wsConns:         make(map[*netutil.SafeWS]bool),
		sseChans:        make(map[chan string]bool),
	}
	app.targetProto.Store("all")

	app.reg.Register(sse.NewSSEPlugin(":8081"))
	app.reg.Register(wsplugin.NewWSPlugin(":8082"))
	app.reg.Register(socketio.NewSocketIOPlugin(":8083"))
	app.reg.Register(http_rest.NewHTTPRestPlugin(":8084"))
	app.reg.Register(mjpeg.NewMJPEGPlugin(":8085"))
	app.reg.Register(rtp_udp.NewRTPUDPPlugin(":8554"))
	app.reg.Register(mqtt.NewMQTTPlugin(":1883"))
	app.reg.Register(grpc_stream.NewGRPCPlugin(":50051"))
	app.reg.Register(tcp_raw.NewTCPRawPlugin(":8086"))
	app.reg.Register(ndjson.NewNDJSONPlugin(":8087"))
	return app
}

func (a *gatewayApp) registerAllProtocols() {
	for _, name := range a.reg.Names() {
		if err := a.reg.Enable(name); err != nil {
			log.Printf("[WARN] Cannot auto-enable [%s]: %v", name, err)
		}
	}
}

func (a *gatewayApp) processInboundPacket(ctx context.Context, pkt core.UnifiedPacket) {
	if pkt.SourceProto == "rtp_udp" && string(pkt.Payload) == udpKeepaliveMarker {
		return
	}

	if a.redisAvailable.Load() && a.redisBus != nil {
		_ = a.redisBus.PublishInbound(ctx, pkt)
	} else {
		select {
		case a.workerForwardCh <- pkt:
		default:
		}
	}

	a.worker.Process(pkt)
	target := a.routePacket(pkt)
	a.broadcastToDashboard(buildDashboardFrame(pkt, target))
}

func (a *gatewayApp) startInboundLoop(ctx context.Context) {
	go func() {
		for {
			select {
			case <-ctx.Done():
				return
			case pkt := <-a.reg.InboundChan:
				a.processInboundPacket(ctx, pkt)
			}
		}
	}()
}

func (a *gatewayApp) routePacket(pkt core.UnifiedPacket) string {
	target, _ := a.targetProto.Load().(string)
	if target == "" {
		target = "all"
	}
	if target == "all" {
		a.reg.Broadcast(pkt)
	} else {
		pkt.TargetProto = target
		_ = a.reg.RouteToTarget(pkt)
	}
	return target
}

func (a *gatewayApp) broadcastToDashboard(frame string) {
	a.connsMu.RLock()
	wsList := make([]*netutil.SafeWS, 0, len(a.wsConns))
	for ws := range a.wsConns {
		wsList = append(wsList, ws)
	}
	sseList := make([]chan string, 0, len(a.sseChans))
	for ch := range a.sseChans {
		sseList = append(sseList, ch)
	}
	a.connsMu.RUnlock()

	for _, ws := range wsList {
		_ = ws.WriteText([]byte(frame))
	}
	for _, ch := range sseList {
		select {
		case ch <- frame:
		default:
		}
	}
}

func jsonOrQuote(b []byte) []byte {
	var js json.RawMessage
	if json.Unmarshal(b, &js) == nil && json.Valid(b) {
		return b
	}
	q, _ := json.Marshal(string(b))
	return q
}

func buildDashboardFrame(pkt core.UnifiedPacket, target string) string {
	return fmt.Sprintf(
		`{"from":%q,"target":%q,"id":%q,"size":%d,"overhead":%d,"latency_ms":%.2f,"data":%s}`,
		pkt.SourceProto,
		target,
		pkt.ID,
		pkt.PayloadSize,
		pkt.OverheadBytes,
		pkt.CalculateLatencyMs(),
		string(jsonOrQuote(pkt.Payload)),
	)
}

type SendRequest struct {
	Proto   string `json:"proto"`
	Payload string `json:"payload"`
}

func (a *gatewayApp) handleSendPacket(w http.ResponseWriter, r *http.Request) {
	netutil.AllowCORS(w)
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}

	var req SendRequest
	body, _ := io.ReadAll(http.MaxBytesReader(w, r.Body, 1<<20))
	defer r.Body.Close()

	if len(body) > 0 {
		_ = json.Unmarshal(body, &req)
	}
	if req.Proto == "" {
		req.Proto = r.URL.Query().Get("proto")
	}
	if req.Proto == "" {
		req.Proto = "mock"
	}
	if req.Payload == "" {
		req.Payload = r.URL.Query().Get("payload")
	}
	if req.Payload == "" {
		req.Payload = fmt.Sprintf(`{"test_source":%q,"time":%q}`, req.Proto, time.Now().Format("15:04:05.000"))
	}

	payloadBytes := []byte(req.Payload)
	pkt := core.UnifiedPacket{
		ID:            fmt.Sprintf("test_%s_%d", req.Proto, time.Now().UnixNano()%100000),
		SourceProto:   req.Proto,
		TopicOrRoute:  "test/stream",
		Payload:       payloadBytes,
		PayloadSize:   len(payloadBytes),
		OverheadBytes: 8,
		CreatedAtNano: time.Now().UnixNano(),
	}

	// Thử gửi qua socket thật của giao thức trước; nếu không mở được socket loopback
	// (hoặc giao thức 1 chiều như sse/mjpeg), dùng SimulateInbound trên plugin để cập nhật đầy đủ bộ đếm.
	viaSocket := false
	if !a.disableLoopbackDial {
		var err error
		viaSocket, err = injectViaProtocol(a.reg, req.Proto, payloadBytes, pkt.ID)
		if err != nil {
			log.Printf("[WARN] injectViaProtocol(%s) fallback to plugin simulate: %v", req.Proto, err)
			viaSocket = false
		}
	}
	if !viaSocket {
		if simPkt, ok := a.reg.SimulateInbound(req.Proto, payloadBytes); ok {
			pkt = simPkt
		} else {
			a.reg.InboundChan <- pkt
		}
	}

	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"status":     "success",
		"via_socket": viaSocket,
		"packet":     pkt,
	})
}

func (a *gatewayApp) routes(ctx context.Context) http.Handler {
	mux := http.NewServeMux()

	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/", "/index.html":
			http.ServeFile(w, r, "web/index.html")
		case "/style.css":
			w.Header().Set("Content-Type", "text/css; charset=utf-8")
			http.ServeFile(w, r, "web/style.css")
		case "/app.js":
			w.Header().Set("Content-Type", "application/javascript; charset=utf-8")
			http.ServeFile(w, r, "web/app.js")
		case "/worker.html":
			http.ServeFile(w, r, "web/worker.html")
		default:
			w.Header().Set("Content-Type", "application/json; charset=utf-8")
			w.WriteHeader(http.StatusNotFound)
			_ = json.NewEncoder(w).Encode(map[string]string{
				"error": fmt.Sprintf("path %q not found", r.URL.Path),
			})
		}
	})

	// WebSocket cùng origin trên :8080/api/ws
	mux.HandleFunc("/api/ws", func(w http.ResponseWriter, r *http.Request) {
		conn, err := netutil.Upgrader.Upgrade(w, r, nil)
		if err != nil {
			return
		}
		sc := netutil.NewSafeWS(conn)

		a.connsMu.Lock()
		a.wsConns[sc] = true
		a.connsMu.Unlock()

		defer func() {
			a.connsMu.Lock()
			delete(a.wsConns, sc)
			a.connsMu.Unlock()
			_ = sc.Close()
		}()

		_ = sc.WriteText([]byte(`{"status":"connected","protocol":"websocket","port":":8080"}`))

		for {
			_, msg, err := conn.ReadMessage()
			if err != nil {
				break
			}
			ok := false
			if !a.disableLoopbackDial {
				ok, _ = injectViaProtocol(a.reg, "websocket", msg, "")
			}
			if !ok {
				if _, simOK := a.reg.SimulateInbound("websocket", msg); !simOK {
					a.reg.InboundChan <- core.UnifiedPacket{
						ID:            fmt.Sprintf("ws_%d", time.Now().UnixNano()%100000),
						SourceProto:   "websocket",
						Payload:       msg,
						PayloadSize:   len(msg),
						OverheadBytes: 2,
						CreatedAtNano: time.Now().UnixNano(),
					}
				}
			}
		}
	})

	// SSE Stream cùng origin trên :8080/api/events
	mux.HandleFunc("/api/events", func(w http.ResponseWriter, r *http.Request) {
		netutil.AllowCORS(w)
		w.Header().Set("Content-Type", "text/event-stream")
		w.Header().Set("Cache-Control", "no-cache")
		w.Header().Set("Connection", "keep-alive")

		flusher, ok := w.(http.Flusher)
		if !ok {
			http.Error(w, "SSE not supported", http.StatusInternalServerError)
			return
		}

		ch := make(chan string, 128)
		a.connsMu.Lock()
		a.sseChans[ch] = true
		a.connsMu.Unlock()

		defer func() {
			a.connsMu.Lock()
			delete(a.sseChans, ch)
			a.connsMu.Unlock()
		}()

		_, _ = w.Write([]byte("data: [CONNECTED] Gateway SSE live on :8080/api/events\n\n"))
		flusher.Flush()

		for {
			select {
			case <-r.Context().Done():
				return
			case <-ctx.Done():
				return
			case frame := <-ch:
				_, _ = w.Write([]byte(fmt.Sprintf("data: %s\n\n", frame)))
				flusher.Flush()
			}
		}
	})

	// HTTP Ingest cùng origin trên :8080/api/ingest
	mux.HandleFunc("/api/ingest", func(w http.ResponseWriter, r *http.Request) {
		netutil.AllowCORS(w)
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusOK)
			return
		}

		body, _ := io.ReadAll(http.MaxBytesReader(w, r.Body, 1<<20))
		defer r.Body.Close()

		pkt := core.UnifiedPacket{
			ID:            fmt.Sprintf("http_%d", time.Now().UnixNano()%100000),
			SourceProto:   "http_rest",
			ClientID:      r.RemoteAddr,
			Payload:       body,
			PayloadSize:   len(body),
			OverheadBytes: 550,
			CreatedAtNano: time.Now().UnixNano(),
		}

		viaSocket := false
		if !a.disableLoopbackDial {
			viaSocket, _ = injectViaProtocol(a.reg, "http_rest", body, pkt.ID)
		}
		if !viaSocket {
			if simPkt, ok := a.reg.SimulateInbound("http_rest", body); ok {
				pkt = simPkt
			} else {
				a.reg.InboundChan <- pkt
			}
		}

		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"status":     "accepted",
			"via_socket": viaSocket,
			"packet":     pkt,
		})
	})

	mux.HandleFunc("/api/send", a.handleSendPacket)
	mux.HandleFunc("/control/send", a.handleSendPacket)

	mux.HandleFunc("/control/stats", func(w http.ResponseWriter, r *http.Request) {
		netutil.AllowCORS(w)
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"current_swap_target": a.targetProto.Load(),
			"protocols":           a.reg.AllStats(),
		})
	})

	mux.HandleFunc("/control/toggle", func(w http.ResponseWriter, r *http.Request) {
		netutil.AllowCORS(w)
		proto := r.URL.Query().Get("proto")
		state := r.URL.Query().Get("state")
		var err error
		if state == "on" {
			err = a.reg.Enable(proto)
		} else {
			err = a.reg.Disable(proto)
		}
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		fmt.Fprintf(w, "[INFO] Protocol [%s] set to [%s]\n", proto, state)
	})

	mux.HandleFunc("/control/swap", func(w http.ResponseWriter, r *http.Request) {
		netutil.AllowCORS(w)
		target := r.URL.Query().Get("target")
		if target == "" {
			target = "all"
		}
		a.targetProto.Store(target)
		fmt.Fprintf(w, "[INFO] Swapped all outbound traffic to protocol: [%s]\n", target)
	})

	mux.HandleFunc("/control/reset", func(w http.ResponseWriter, r *http.Request) {
		netutil.AllowCORS(w)
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		a.reg.ResetAllStats()
		a.worker.Reset()
		_ = json.NewEncoder(w).Encode(map[string]string{"status": "reset"})
	})

	mux.HandleFunc("/control/bench", func(w http.ResponseWriter, r *http.Request) {
		netutil.AllowCORS(w)
		source := r.URL.Query().Get("source")
		if source == "" {
			source = "stress_test"
		}
		count := 1000
		if raw := r.URL.Query().Get("count"); raw != "" {
			if n, err := strconv.Atoi(raw); err == nil && n > 0 && n <= 10000 {
				count = n
			}
		}

		go func() {
			for i := 0; i < count; i++ {
				if ctx.Err() != nil {
					return
				}
				payload := []byte(fmt.Sprintf(`{"seq":%d,"token":"packet_test_data"}`, i))
				if _, ok := a.reg.SimulateInbound(source, payload); ok {
					continue
				}
				pkt := core.UnifiedPacket{
					ID:            fmt.Sprintf("bench_%d", i),
					SourceProto:   source,
					TopicOrRoute:  "bench/stress",
					Payload:       payload,
					PayloadSize:   len(payload),
					OverheadBytes: 8,
					CreatedAtNano: time.Now().UnixNano(),
				}
				select {
				case a.reg.InboundChan <- pkt:
				case <-ctx.Done():
					return
				}
			}
		}()
		fmt.Fprintf(w, "[INFO] Injected %d packets from [%s] into pipeline!\n", count, source)
	})

	// Các endpoint Worker Monitor tích hợp sẵn trên Gateway (:8080) cho /worker.html
	mux.HandleFunc("/stats", func(w http.ResponseWriter, r *http.Request) {
		netutil.AllowCORS(w)
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		_ = json.NewEncoder(w).Encode(a.worker.Snapshot())
	})

	mux.HandleFunc("/events", func(w http.ResponseWriter, r *http.Request) {
		netutil.AllowCORS(w)
		w.Header().Set("Content-Type", "text/event-stream")
		w.Header().Set("Cache-Control", "no-cache")
		w.Header().Set("Connection", "keep-alive")

		flusher, ok := w.(http.Flusher)
		if !ok {
			http.Error(w, "SSE not supported", http.StatusInternalServerError)
			return
		}

		ch := make(chan string, 128)
		a.worker.sseMu.Lock()
		a.worker.sseClients[ch] = true
		a.worker.sseMu.Unlock()

		defer func() {
			a.worker.sseMu.Lock()
			delete(a.worker.sseClients, ch)
			a.worker.sseMu.Unlock()
		}()

		_, _ = w.Write([]byte("data: {\"type\":\"ping\",\"status\":\"connected\"}\n\n"))
		flusher.Flush()

		for {
			select {
			case <-r.Context().Done():
				return
			case <-ctx.Done():
				return
			case msg := <-ch:
				_, _ = w.Write([]byte(fmt.Sprintf("data: %s\n\n", msg)))
				flusher.Flush()
			}
		}
	})

	mux.HandleFunc("/simulate", func(w http.ResponseWriter, r *http.Request) {
		netutil.AllowCORS(w)
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusOK)
			return
		}

		proto := r.URL.Query().Get("proto")
		if proto == "" {
			proto = "direct_test"
		}
		body, _ := io.ReadAll(http.MaxBytesReader(w, r.Body, 1<<20))
		payload := string(body)
		if payload == "" {
			payload = fmt.Sprintf(`{"msg":"direct test to worker","time":%q}`, time.Now().Format("15:04:05"))
		}

		pkt := core.UnifiedPacket{
			ID:            fmt.Sprintf("direct_%d", time.Now().UnixNano()%100000),
			SourceProto:   proto,
			Payload:       []byte(payload),
			PayloadSize:   len(payload),
			CreatedAtNano: time.Now().UnixNano(),
		}
		event := a.worker.Process(pkt)

		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"status": "processed",
			"packet": pkt,
			"event":  event,
		})
	})

	mux.HandleFunc("/clear", func(w http.ResponseWriter, r *http.Request) {
		netutil.AllowCORS(w)
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		a.worker.Clear()
		_ = json.NewEncoder(w).Encode(map[string]string{"status": "cleared"})
	})

	return mux
}

// injectViaProtocol gửi dữ liệu thật tới listener của từng plugin để đo đạc chính xác byte In/Overhead.
func injectViaProtocol(reg *core.Registry, proto string, payload []byte, id string) (bool, error) {
	if !reg.IsRunning(proto) {
		return false, nil
	}

	switch proto {
	case "http_rest":
		client := &http.Client{Timeout: 2 * time.Second}
		resp, err := client.Post("http://127.0.0.1:8084/ingest", "application/json", bytes.NewReader(payload))
		if err != nil {
			return false, err
		}
		_, _ = io.Copy(io.Discard, resp.Body)
		_ = resp.Body.Close()
		return resp.StatusCode >= 200 && resp.StatusCode < 300, nil

	case "websocket":
		dialer := websocket.Dialer{HandshakeTimeout: 2 * time.Second}
		conn, _, err := dialer.Dial("ws://127.0.0.1:8082/ws", nil)
		if err != nil {
			return false, err
		}
		defer conn.Close()
		_ = conn.SetWriteDeadline(time.Now().Add(2 * time.Second))
		if err := conn.WriteMessage(websocket.TextMessage, payload); err != nil {
			return false, err
		}
		_ = conn.WriteMessage(websocket.CloseMessage, websocket.FormatCloseMessage(websocket.CloseNormalClosure, ""))
		time.Sleep(15 * time.Millisecond)
		return true, nil

	case "socketio":
		dialer := websocket.Dialer{HandshakeTimeout: 2 * time.Second}
		conn, _, err := dialer.Dial("ws://127.0.0.1:8083/socket.io/?EIO=4&transport=websocket", nil)
		if err != nil {
			return false, err
		}
		defer conn.Close()
		deadline := time.Now().Add(2 * time.Second)
		_ = conn.SetReadDeadline(deadline)
		_ = conn.SetWriteDeadline(deadline)
		_, _, _ = conn.ReadMessage()
		if err := conn.WriteMessage(websocket.TextMessage, []byte("40")); err != nil {
			return false, err
		}
		_, _, _ = conn.ReadMessage()
		frame := fmt.Sprintf(`42["telemetry",%s]`, string(jsonOrQuote(payload)))
		if err := conn.WriteMessage(websocket.TextMessage, []byte(frame)); err != nil {
			return false, err
		}
		_ = conn.WriteMessage(websocket.TextMessage, []byte("41"))
		time.Sleep(15 * time.Millisecond)
		return true, nil

	case "mqtt":
		return true, sendMQTTPacket("127.0.0.1:1883", extractMQTTTopic(payload), payload)

	case "grpc":
		cc, err := grpc.NewClient(
			"127.0.0.1:50051",
			grpc.WithTransportCredentials(insecure.NewCredentials()),
			grpc.WithDefaultCallOptions(grpc.CallContentSubtype(grpc_stream.CodecName)),
		)
		if err != nil {
			return false, err
		}
		defer cc.Close()

		ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
		defer cancel()
		stream, err := cc.NewStream(ctx, &grpc.StreamDesc{
			StreamName:    "Pipe",
			ServerStreams: true,
			ClientStreams: true,
		}, grpc_stream.FullMethod)
		if err != nil {
			return false, err
		}
		msg := core.UnifiedPacket{
			ID:           id,
			SourceProto:  "grpc",
			TopicOrRoute: grpc_stream.FullMethod,
			Payload:      payload,
			PayloadSize:  len(payload),
		}
		if err := stream.SendMsg(&msg); err != nil {
			return false, err
		}
		_ = stream.CloseSend()
		waitCtx, waitCancel := context.WithTimeout(ctx, 120*time.Millisecond)
		defer waitCancel()
		done := make(chan struct{})
		go func() {
			defer close(done)
			var tmp core.UnifiedPacket
			for {
				if err := stream.RecvMsg(&tmp); err != nil {
					return
				}
			}
		}()
		select {
		case <-done:
		case <-waitCtx.Done():
		}
		return true, nil

	case "rtp_udp":
		conn, err := net.DialTimeout("udp", "127.0.0.1:8554", 2*time.Second)
		if err != nil {
			return false, err
		}
		defer conn.Close()
		_ = conn.SetWriteDeadline(time.Now().Add(2 * time.Second))
		rtpFrame := rtp_udp.BuildRTPPacket(uint16(time.Now().UnixNano()&0xffff), uint32(time.Now().UnixMilli()*90), payload)
		if _, err := conn.Write(rtpFrame); err != nil {
			return false, err
		}
		time.Sleep(15 * time.Millisecond)
		return true, nil

	case "tcp_raw":
		conn, err := net.DialTimeout("tcp", "127.0.0.1:8086", 2*time.Second)
		if err != nil {
			return false, err
		}
		defer conn.Close()
		_ = conn.SetWriteDeadline(time.Now().Add(2 * time.Second))
		if _, err := conn.Write(tcp_raw.EncodeFrame(payload)); err != nil {
			return false, err
		}
		time.Sleep(15 * time.Millisecond)
		return true, nil

	case "ndjson":
		client := &http.Client{Timeout: 2 * time.Second}
		line := append(bytes.Clone(bytes.TrimSpace(payload)), '\n')
		resp, err := client.Post("http://127.0.0.1:8087/ingest", "application/x-ndjson", bytes.NewReader(line))
		if err != nil {
			return false, err
		}
		_, _ = io.Copy(io.Discard, resp.Body)
		_ = resp.Body.Close()
		return resp.StatusCode >= 200 && resp.StatusCode < 300, nil

	default:
		return false, nil
	}
}

func extractMQTTTopic(payload []byte) string {
	var body struct {
		Topic string `json:"topic"`
	}
	if json.Unmarshal(payload, &body) == nil && body.Topic != "" {
		return body.Topic
	}
	return "sensor/temperature"
}

func sendMQTTPacket(addr, topic string, payload []byte) error {
	conn, err := net.DialTimeout("tcp", addr, 2*time.Second)
	if err != nil {
		return err
	}
	defer conn.Close()
	_ = conn.SetDeadline(time.Now().Add(2 * time.Second))

	var buf bytes.Buffer
	connPkt := mqttpackets.Packet{
		FixedHeader:     mqttpackets.FixedHeader{Type: mqttpackets.Connect},
		ProtocolVersion: 4,
		Connect: mqttpackets.ConnectParams{
			ProtocolName:     []byte("MQTT"),
			Clean:            true,
			Keepalive:        30,
			ClientIdentifier: fmt.Sprintf("bench_pub_%d", time.Now().UnixNano()%100000),
		},
	}
	if err := connPkt.ConnectEncode(&buf); err != nil {
		return err
	}
	if _, err := conn.Write(buf.Bytes()); err != nil {
		return err
	}
	connack := make([]byte, 4)
	if _, err := io.ReadFull(conn, connack); err != nil {
		return err
	}

	buf.Reset()
	pubPkt := mqttpackets.Packet{
		FixedHeader:     mqttpackets.FixedHeader{Type: mqttpackets.Publish, Qos: 0},
		ProtocolVersion: 4,
		TopicName:       topic,
		Payload:         payload,
	}
	if err := pubPkt.PublishEncode(&buf); err != nil {
		return err
	}
	if _, err := conn.Write(buf.Bytes()); err != nil {
		return err
	}

	buf.Reset()
	discPkt := mqttpackets.Packet{
		FixedHeader:     mqttpackets.FixedHeader{Type: mqttpackets.Disconnect},
		ProtocolVersion: 4,
	}
	_ = discPkt.DisconnectEncode(&buf)
	_, _ = conn.Write(buf.Bytes())
	time.Sleep(15 * time.Millisecond)
	return nil
}

func startBackgroundSubscribers(ctx context.Context, reg *core.Registry) {
	go runSSESubscriber(ctx, reg)
	go runWSSubscriber(ctx, reg)
	go runSocketIOSubscriber(ctx, reg)
	go runGRPCSubscriber(ctx, reg)
	go runMQTTSubscriber(ctx, reg)
	go runUDPSubscriber(ctx, reg)
	go runTCPRawSubscriber(ctx, reg)
	go runNDJSONSubscriber(ctx, reg)
}

func runTCPRawSubscriber(ctx context.Context, reg *core.Registry) {
	buf := make([]byte, 4096)
	for {
		if ctx.Err() != nil {
			return
		}
		if !reg.IsRunning("tcp_raw") {
			if !waitOrRetry(ctx, time.Second) {
				return
			}
			continue
		}
		conn, err := net.DialTimeout("tcp", "127.0.0.1:8086", 2*time.Second)
		if err != nil {
			if !waitOrRetry(ctx, 2*time.Second) {
				return
			}
			continue
		}
		go func() {
			<-ctx.Done()
			_ = conn.Close()
		}()
		for {
			if _, err := conn.Read(buf); err != nil {
				break
			}
		}
		_ = conn.Close()
		if !waitOrRetry(ctx, time.Second) {
			return
		}
	}
}

func runNDJSONSubscriber(ctx context.Context, reg *core.Registry) {
	client := &http.Client{}
	for {
		if ctx.Err() != nil {
			return
		}
		if !reg.IsRunning("ndjson") {
			if !waitOrRetry(ctx, time.Second) {
				return
			}
			continue
		}
		req, err := http.NewRequestWithContext(ctx, http.MethodGet, "http://127.0.0.1:8087/stream", nil)
		if err != nil {
			return
		}
		resp, err := client.Do(req)
		if err != nil {
			if !waitOrRetry(ctx, 2*time.Second) {
				return
			}
			continue
		}
		scanner := bufio.NewScanner(resp.Body)
		for scanner.Scan() {
		}
		_ = resp.Body.Close()
		if !waitOrRetry(ctx, time.Second) {
			return
		}
	}
}

func waitOrRetry(ctx context.Context, d time.Duration) bool {
	select {
	case <-ctx.Done():
		return false
	case <-time.After(d):
		return true
	}
}

func runSSESubscriber(ctx context.Context, reg *core.Registry) {
	client := &http.Client{}
	for {
		if ctx.Err() != nil {
			return
		}
		if !reg.IsRunning("sse") {
			if !waitOrRetry(ctx, time.Second) {
				return
			}
			continue
		}
		req, err := http.NewRequestWithContext(ctx, http.MethodGet, "http://127.0.0.1:8081/events", nil)
		if err != nil {
			return
		}
		resp, err := client.Do(req)
		if err != nil {
			if !waitOrRetry(ctx, 2*time.Second) {
				return
			}
			continue
		}
		scanner := bufio.NewScanner(resp.Body)
		for scanner.Scan() {
		}
		_ = resp.Body.Close()
		if !waitOrRetry(ctx, time.Second) {
			return
		}
	}
}

func runWSSubscriber(ctx context.Context, reg *core.Registry) {
	dialer := websocket.Dialer{HandshakeTimeout: 2 * time.Second}
	for {
		if ctx.Err() != nil {
			return
		}
		if !reg.IsRunning("websocket") {
			if !waitOrRetry(ctx, time.Second) {
				return
			}
			continue
		}
		conn, _, err := dialer.DialContext(ctx, "ws://127.0.0.1:8082/ws", nil)
		if err != nil {
			if !waitOrRetry(ctx, 2*time.Second) {
				return
			}
			continue
		}
		for {
			if _, _, err := conn.ReadMessage(); err != nil {
				break
			}
		}
		_ = conn.Close()
		if !waitOrRetry(ctx, time.Second) {
			return
		}
	}
}

func runSocketIOSubscriber(ctx context.Context, reg *core.Registry) {
	dialer := websocket.Dialer{HandshakeTimeout: 2 * time.Second}
	for {
		if ctx.Err() != nil {
			return
		}
		if !reg.IsRunning("socketio") {
			if !waitOrRetry(ctx, time.Second) {
				return
			}
			continue
		}
		conn, _, err := dialer.DialContext(ctx, "ws://127.0.0.1:8083/socket.io/?EIO=4&transport=websocket", nil)
		if err != nil {
			if !waitOrRetry(ctx, 2*time.Second) {
				return
			}
			continue
		}
		sio := netutil.NewSafeWS(conn)
		_, _, err = conn.ReadMessage()
		if err == nil {
			err = sio.WriteText([]byte("40"))
		}
		if err == nil {
			for {
				_, raw, rerr := conn.ReadMessage()
				if rerr != nil {
					break
				}
				if string(raw) == "2" {
					_ = sio.WriteText([]byte("3"))
				}
			}
		}
		_ = sio.Close()
		if !waitOrRetry(ctx, time.Second) {
			return
		}
	}
}

func runGRPCSubscriber(ctx context.Context, reg *core.Registry) {
	for {
		if ctx.Err() != nil {
			return
		}
		if !reg.IsRunning("grpc") {
			if !waitOrRetry(ctx, time.Second) {
				return
			}
			continue
		}
		cc, err := grpc.NewClient(
			"127.0.0.1:50051",
			grpc.WithTransportCredentials(insecure.NewCredentials()),
			grpc.WithDefaultCallOptions(grpc.CallContentSubtype(grpc_stream.CodecName)),
		)
		if err != nil {
			if !waitOrRetry(ctx, 2*time.Second) {
				return
			}
			continue
		}
		stream, err := cc.NewStream(ctx, &grpc.StreamDesc{
			StreamName:    "Pipe",
			ServerStreams: true,
			ClientStreams: true,
		}, grpc_stream.FullMethod)
		if err == nil {
			var pkt core.UnifiedPacket
			for {
				if err := stream.RecvMsg(&pkt); err != nil {
					break
				}
			}
		}
		_ = cc.Close()
		if !waitOrRetry(ctx, 2*time.Second) {
			return
		}
	}
}

func runMQTTSubscriber(ctx context.Context, reg *core.Registry) {
	for {
		if ctx.Err() != nil {
			return
		}
		if !reg.IsRunning("mqtt") {
			if !waitOrRetry(ctx, time.Second) {
				return
			}
			continue
		}
		conn, err := net.DialTimeout("tcp", "127.0.0.1:1883", 2*time.Second)
		if err != nil {
			if !waitOrRetry(ctx, 2*time.Second) {
				return
			}
			continue
		}

		var buf bytes.Buffer
		connPkt := mqttpackets.Packet{
			FixedHeader:     mqttpackets.FixedHeader{Type: mqttpackets.Connect},
			ProtocolVersion: 4,
			Connect: mqttpackets.ConnectParams{
				ProtocolName:     []byte("MQTT"),
				Clean:            true,
				Keepalive:        30,
				ClientIdentifier: "bench_sub_loopback",
			},
		}
		_ = connPkt.ConnectEncode(&buf)
		if _, err := conn.Write(buf.Bytes()); err != nil {
			_ = conn.Close()
			if !waitOrRetry(ctx, 2*time.Second) {
				return
			}
			continue
		}
		connack := make([]byte, 4)
		_ = conn.SetReadDeadline(time.Now().Add(2 * time.Second))
		if _, err := io.ReadFull(conn, connack); err != nil {
			_ = conn.Close()
			if !waitOrRetry(ctx, 2*time.Second) {
				return
			}
			continue
		}

		buf.Reset()
		subPkt := mqttpackets.Packet{
			FixedHeader:     mqttpackets.FixedHeader{Type: mqttpackets.Subscribe, Qos: 1},
			ProtocolVersion: 4,
			PacketID:        1,
			Filters: mqttpackets.Subscriptions{
				{Filter: mqtt.OutTopicPrefix + "#", Qos: 0},
			},
		}
		_ = subPkt.SubscribeEncode(&buf)
		_, _ = conn.Write(buf.Bytes())

		stopPing := make(chan struct{})
		go func() {
			t := time.NewTicker(15 * time.Second)
			defer t.Stop()
			var pbuf bytes.Buffer
			ping := mqttpackets.Packet{
				FixedHeader:     mqttpackets.FixedHeader{Type: mqttpackets.Pingreq},
				ProtocolVersion: 4,
			}
			_ = ping.PingreqEncode(&pbuf)
			for {
				select {
				case <-ctx.Done():
					_ = conn.Close()
					return
				case <-stopPing:
					return
				case <-t.C:
					if _, err := conn.Write(pbuf.Bytes()); err != nil {
						return
					}
				}
			}
		}()

		_ = conn.SetReadDeadline(time.Time{})
		tmp := make([]byte, 4096)
		for {
			if _, err := conn.Read(tmp); err != nil {
				break
			}
		}
		close(stopPing)
		_ = conn.Close()
		if !waitOrRetry(ctx, time.Second) {
			return
		}
	}
}

func runUDPSubscriber(ctx context.Context, reg *core.Registry) {
	raddr, err := net.ResolveUDPAddr("udp", "127.0.0.1:8554")
	if err != nil {
		return
	}
	for {
		if ctx.Err() != nil {
			return
		}
		if !reg.IsRunning("rtp_udp") {
			if !waitOrRetry(ctx, time.Second) {
				return
			}
			continue
		}
		conn, err := net.ListenUDP("udp", &net.UDPAddr{IP: net.IPv4(127, 0, 0, 1), Port: 0})
		if err != nil {
			if !waitOrRetry(ctx, 2*time.Second) {
				return
			}
			continue
		}

		_, _ = conn.WriteToUDP([]byte(udpKeepaliveMarker), raddr)
		stopKeepalive := make(chan struct{})
		go func() {
			t := time.NewTicker(45 * time.Second)
			defer t.Stop()
			for {
				select {
				case <-ctx.Done():
					_ = conn.Close()
					return
				case <-stopKeepalive:
					return
				case <-t.C:
					if !reg.IsRunning("rtp_udp") {
						_ = conn.Close()
						return
					}
					_, _ = conn.WriteToUDP([]byte(udpKeepaliveMarker), raddr)
				}
			}
		}()

		buf := make([]byte, 65535)
		for {
			_ = conn.SetReadDeadline(time.Now().Add(2 * time.Second))
			_, _, rerr := conn.ReadFromUDP(buf)
			if rerr != nil {
				var ne net.Error
				if errors.As(rerr, &ne) && ne.Timeout() && reg.IsRunning("rtp_udp") && ctx.Err() == nil {
					continue
				}
				break
			}
		}
		close(stopKeepalive)
		_ = conn.Close()
		if !waitOrRetry(ctx, time.Second) {
			return
		}
	}
}

func startWorkerHTTPForwarder(ctx context.Context, ch <-chan core.UnifiedPacket) {
	client := &http.Client{
		Timeout: 400 * time.Millisecond,
		Transport: &http.Transport{
			MaxIdleConns:        8,
			MaxIdleConnsPerHost: 8,
			IdleConnTimeout:     30 * time.Second,
		},
	}
	for i := 0; i < 4; i++ {
		go func() {
			for {
				select {
				case <-ctx.Done():
					return
				case pkt := <-ch:
					raw, err := json.Marshal(pkt)
					if err != nil {
						continue
					}
					req, err := http.NewRequestWithContext(ctx, http.MethodPost, "http://127.0.0.1:8090/ingest", bytes.NewReader(raw))
					if err != nil {
						continue
					}
					req.Header.Set("Content-Type", "application/json")
					resp, err := client.Do(req)
					if err == nil {
						_, _ = io.Copy(io.Discard, resp.Body)
						_ = resp.Body.Close()
					}
				}
			}
		}()
	}
}

func main() {
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	app := newGatewayApp()
	app.registerAllProtocols()

	redisBus := bus.NewRedisBus("127.0.0.1:6379")
	app.redisBus = redisBus
	if err := redisBus.Ping(ctx); err == nil {
		app.redisAvailable.Store(true)
		app.worker.redisConnected.Store(true)
		log.Println("[INFO] Redis Bus connected. Inbound packets will mirror to Redis Streams for Workers.")
		redisBus.SubscribeOutbound(ctx, func(pkt core.UnifiedPacket) {
			target := app.routePacket(pkt)
			app.broadcastToDashboard(buildDashboardFrame(pkt, target))
		})
	} else {
		log.Println("[INFO] Redis not detected. Using built-in Worker Monitor (:8080/worker.html) and HTTP forwarder (:8090).")
		startWorkerHTTPForwarder(ctx, app.workerForwardCh)
	}

	startBackgroundSubscribers(ctx, app.reg)
	app.startInboundLoop(ctx)

	srv := &http.Server{
		Addr:              ":8080",
		Handler:           app.routes(ctx),
		ReadHeaderTimeout: 10 * time.Second,
	}

	go func() {
		<-ctx.Done()
		log.Println("[INFO] Shutting down Gateway...")
		app.reg.StopAll()
		shutCtx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
		defer cancel()
		_ = srv.Shutdown(shutCtx)
	}()

	log.Println("[INFO] Control Dashboard API running at http://localhost:8080")
	if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		log.Fatalf("[ERROR] Gateway server failed: %v", err)
	}
}
