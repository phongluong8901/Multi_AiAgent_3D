package main

import (
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
	"sync"
	"sync/atomic"
	"syscall"
	"time"

	"protocol-testbench/internal/bus"
	"protocol-testbench/internal/core"
	"protocol-testbench/internal/netutil"
)

type WorkerPacketEvent struct {
	ID             string  `json:"id"`
	SourceProto    string  `json:"source_proto"`
	OriginalSize   int     `json:"original_size"`
	OriginalData   string  `json:"original_data"`
	ProcessedData  string  `json:"processed_data"`
	ReceivedAt     string  `json:"received_at"`
	TransitLatency float64 `json:"transit_latency_ms"`
}

var (
	totalReceived  atomic.Uint64
	totalProcessed atomic.Uint64
	latencyMeter   core.LatencyMeter

	recentMu     sync.RWMutex
	recentEvents []WorkerPacketEvent

	sseMu      sync.RWMutex
	sseClients = make(map[chan string]bool)

	redisConnected atomic.Bool
)

func broadcastSSE(msg string) {
	sseMu.RLock()
	targets := make([]chan string, 0, len(sseClients))
	for ch := range sseClients {
		targets = append(targets, ch)
	}
	sseMu.RUnlock()

	for _, ch := range targets {
		select {
		case ch <- msg:
		default:
		}
	}
}

func processPacket(pkt core.UnifiedPacket, redisBus *bus.RedisBus) WorkerPacketEvent {
	totalReceived.Add(1)
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
	latencyMeter.Observe(latency)

	// Giả lập Worker AI/LLM gắn tag xử lý dữ liệu
	processed := fmt.Sprintf(`{"worker_node":"worker_01","ai_tag":"annotated","model":"yolo_v8","source":%q,"content":%s}`,
		pkt.SourceProto, string(jsonOrString(pkt.Payload)))

	event := WorkerPacketEvent{
		ID:             pkt.ID,
		SourceProto:    pkt.SourceProto,
		OriginalSize:   pkt.PayloadSize,
		OriginalData:   string(pkt.Payload),
		ProcessedData:  processed,
		ReceivedAt:     time.Now().Format("15:04:05.000"),
		TransitLatency: latency,
	}

	recentMu.Lock()
	recentEvents = append([]WorkerPacketEvent{event}, recentEvents...)
	if len(recentEvents) > 50 {
		recentEvents = recentEvents[:50]
	}
	recentMu.Unlock()

	totalProcessed.Add(1)

	// Bắn ra SSE để giao diện Worker Dashboard cập nhật thời gian thực
	rawEvent, _ := json.Marshal(event)
	broadcastSSE(string(rawEvent))

	log.Printf("[WORKER-01] [RECV] ID=%s Proto=%s Size=%dB Latency=%.2fms",
		pkt.ID, pkt.SourceProto, pkt.PayloadSize, latency)

	// Đẩy ngược lại Redis PubSub nếu có kết nối
	if redisConnected.Load() && redisBus != nil {
		pkt.Payload = []byte(processed)
		pkt.PayloadSize = len(pkt.Payload)
		_ = redisBus.PublishOutbound(context.Background(), pkt)
	}
	return event
}

func jsonOrString(b []byte) []byte {
	var js json.RawMessage
	if json.Unmarshal(b, &js) == nil && json.Valid(b) {
		return b
	}
	q, _ := json.Marshal(string(b))
	return q
}

func main() {
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	redisBus := bus.NewRedisBus("127.0.0.1:6379")

	// 1. Kiểm tra kết nối Redis
	if err := redisBus.Ping(ctx); err == nil {
		redisConnected.Store(true)
		log.Println("[INFO] Connected to Redis at 127.0.0.1:6379. Listening to Redis Streams: bench:inbound:stream")

		go redisBus.ConsumeInbound(ctx, "bench_worker_group", "worker_01", func(pkt core.UnifiedPacket) {
			processPacket(pkt, redisBus)
		})
	} else {
		redisConnected.Store(false)
		log.Println("[WARN] Redis at 127.0.0.1:6379 not reachable. Worker running in Standalone/HTTP mode.")
		log.Println("[INFO] Gateway will forward packets directly to Worker via HTTP :8090/ingest.")
	}

	// 2. HTTP Server cho Worker Dashboard (Port 8090)
	mux := http.NewServeMux()

	// Giao diện Worker Monitor HTML (phục vụ từ web/worker.html)
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/" {
			http.NotFound(w, r)
			return
		}
		http.ServeFile(w, r, "web/worker.html")
	})

	// Nhận gói tin chuyển tiếp trực tiếp từ Gateway khi không dùng Redis: POST /ingest
	mux.HandleFunc("/ingest", func(w http.ResponseWriter, r *http.Request) {
		netutil.AllowCORS(w)
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		if r.Method != http.MethodPost {
			w.WriteHeader(http.StatusMethodNotAllowed)
			_ = json.NewEncoder(w).Encode(map[string]string{"error": "chỉ chấp nhận POST"})
			return
		}

		body, err := io.ReadAll(http.MaxBytesReader(w, r.Body, 2<<20))
		if err != nil {
			w.WriteHeader(http.StatusBadRequest)
			_ = json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
			return
		}

		var pkt core.UnifiedPacket
		if err := json.Unmarshal(body, &pkt); err != nil {
			w.WriteHeader(http.StatusBadRequest)
			_ = json.NewEncoder(w).Encode(map[string]string{"error": "invalid packet JSON: " + err.Error()})
			return
		}

		event := processPacket(pkt, redisBus)
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"status": "processed",
			"event":  event,
		})
	})

	// SSE Stream cho Worker Dashboard: GET /events
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
		sseMu.Lock()
		sseClients[ch] = true
		sseMu.Unlock()

		defer func() {
			sseMu.Lock()
			delete(sseClients, ch)
			sseMu.Unlock()
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

	// JSON Stats API: GET /stats
	mux.HandleFunc("/stats", func(w http.ResponseWriter, r *http.Request) {
		netutil.AllowCORS(w)
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		recentMu.RLock()
		snapshot := make([]WorkerPacketEvent, len(recentEvents))
		copy(snapshot, recentEvents)
		recentMu.RUnlock()

		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"worker_id":       "worker_01",
			"redis_connected": redisConnected.Load(),
			"total_received":  totalReceived.Load(),
			"total_processed": totalProcessed.Load(),
			"avg_latency_ms":  latencyMeter.Value(),
			"recent_events":   snapshot,
		})
	})

	// Xóa lịch sử hiển thị trên Worker Dashboard: POST /clear
	mux.HandleFunc("/clear", func(w http.ResponseWriter, r *http.Request) {
		netutil.AllowCORS(w)
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		recentMu.Lock()
		recentEvents = nil
		recentMu.Unlock()
		_ = json.NewEncoder(w).Encode(map[string]string{"status": "cleared"})
	})

	// Direct simulate endpoint: POST /simulate?proto=...
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

		event := processPacket(pkt, redisBus)

		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"status": "processed",
			"packet": pkt,
			"event":  event,
		})
	})

	addr := os.Getenv("WORKER_ADDR")
	var ln net.Listener
	var err error
	if addr != "" {
		ln, err = net.Listen("tcp", addr)
	} else {
		for _, candidate := range []string{":8090", ":8091"} {
			ln, err = net.Listen("tcp", candidate)
			if err == nil {
				addr = candidate
				break
			}
			log.Printf("[WARN] Port %s unavailable (%v), trying next candidate...", candidate, err)
		}
	}
	if err != nil {
		log.Fatalf("[ERROR] Worker failed to bind listener: %v", err)
	}

	srv := &http.Server{
		Handler:           mux,
		ReadHeaderTimeout: 10 * time.Second,
	}

	go func() {
		<-ctx.Done()
		log.Println("[INFO] Shutting down Worker...")
		shutCtx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
		defer cancel()
		_ = srv.Shutdown(shutCtx)
	}()

	log.Printf("[INFO] Worker Monitor Dashboard running at http://localhost%s", addr)
	if err := srv.Serve(ln); err != nil && !errors.Is(err, http.ErrServerClosed) {
		log.Fatalf("[ERROR] Worker server failed: %v", err)
	}
}
