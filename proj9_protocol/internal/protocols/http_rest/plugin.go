package http_rest

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"sync"
	"sync/atomic"
	"time"

	"protocol-testbench/internal/core"
	"protocol-testbench/internal/netutil"
)

const (
	maxBody    = 1 << 20 // 1 MB
	outboxSize = 50
)

// HTTPRestPlugin: client POST /ingest để gửi lên; HTTP là request/response nên
// chiều ra (Gateway -> client) được lưu vào hộp thư, client lấy qua GET /outbox.
type HTTPRestPlugin struct {
	port       string
	server     netutil.HTTPServer
	running    atomic.Bool
	counters   core.Counters
	seq        atomic.Uint64
	lastHeader atomic.Int64

	outMu  sync.Mutex
	outbox [][]byte
}

func NewHTTPRestPlugin(port string) *HTTPRestPlugin {
	return &HTTPRestPlugin{port: port}
}

func (h *HTTPRestPlugin) Name() string { return "http_rest" }

func (h *HTTPRestPlugin) Start(ctx context.Context, inbound chan<- core.UnifiedPacket) error {
	mux := http.NewServeMux()
	mux.HandleFunc("/ingest", func(w http.ResponseWriter, r *http.Request) {
		h.handleIngest(w, r, inbound)
	})
	mux.HandleFunc("/outbox", h.handleOutbox)
	if err := h.server.Start(h.port, mux); err != nil {
		return err
	}
	h.running.Store(true)
	go func() {
		<-ctx.Done()
		_ = h.Stop(context.Background())
	}()
	return nil
}

func (h *HTTPRestPlugin) handleIngest(w http.ResponseWriter, r *http.Request, inbound chan<- core.UnifiedPacket) {
	netutil.AllowCORS(w)
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusNoContent)
		return
	}
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "chỉ chấp nhận POST"})
		return
	}
	body, err := io.ReadAll(http.MaxBytesReader(w, r.Body, maxBody))
	if err != nil {
		writeJSON(w, http.StatusRequestEntityTooLarge, map[string]string{"error": "body quá lớn (tối đa 1MB)"})
		return
	}

	header := requestHeaderSize(r)
	h.lastHeader.Store(int64(header))
	id := fmt.Sprintf("http_%d", h.seq.Add(1))
	h.counters.In(len(body) + header)

	inbound <- core.UnifiedPacket{
		ID:            id,
		SourceProto:   "http_rest",
		ClientID:      r.RemoteAddr,
		TopicOrRoute:  r.URL.Path,
		Payload:       body,
		PayloadSize:   len(body),
		OverheadBytes: header,
		CreatedAtNano: time.Now().UnixNano(),
	}
	writeJSON(w, http.StatusOK, map[string]any{"status": "accepted", "id": id, "size": len(body)})
}

func (h *HTTPRestPlugin) handleOutbox(w http.ResponseWriter, r *http.Request) {
	netutil.AllowCORS(w)
	h.outMu.Lock()
	packets := make([]json.RawMessage, 0, len(h.outbox))
	for i := len(h.outbox) - 1; i >= 0; i-- { // mới nhất trước
		packets = append(packets, json.RawMessage(h.outbox[i]))
	}
	h.outMu.Unlock()
	writeJSON(w, http.StatusOK, map[string]any{"count": len(packets), "packets": packets})
}

func (h *HTTPRestPlugin) Stop(context.Context) error {
	h.running.Store(false)
	return h.server.Stop()
}

func (h *HTTPRestPlugin) Send(pkt core.UnifiedPacket) error {
	if !h.running.Load() {
		return nil
	}
	h.counters.Latency.Observe(pkt.CalculateLatencyMs())
	data := pkt.WireJSON()
	h.outMu.Lock()
	h.outbox = append(h.outbox, data)
	if len(h.outbox) > outboxSize {
		h.outbox = h.outbox[len(h.outbox)-outboxSize:]
	}
	h.outMu.Unlock()
	h.counters.Out(len(data))
	return nil
}

func (h *HTTPRestPlugin) SimulateInbound(payload []byte, inbound chan<- core.UnifiedPacket) core.UnifiedPacket {
	h.lastHeader.CompareAndSwap(0, 550)
	header := int(h.lastHeader.Load())
	cp := bytes.Clone(payload)
	h.counters.In(len(cp) + header)
	pkt := core.UnifiedPacket{
		ID:            fmt.Sprintf("http_%d", h.seq.Add(1)),
		SourceProto:   "http_rest",
		ClientID:      "gateway_sim",
		TopicOrRoute:  "/ingest",
		Payload:       cp,
		PayloadSize:   len(cp),
		OverheadBytes: header,
		CreatedAtNano: time.Now().UnixNano(),
	}
	if inbound != nil {
		inbound <- pkt
	}
	return pkt
}

func (h *HTTPRestPlugin) ResetStats() {
	h.counters.Reset()
	h.outMu.Lock()
	h.outbox = nil
	h.outMu.Unlock()
}

func (h *HTTPRestPlugin) Stats() core.ProtocolStats {
	st := core.ProtocolStats{
		ProtocolName:   "HTTP/1.1 REST",
		Port:           h.port,
		Endpoint:       "POST /ingest, GET /outbox",
		Direction:      "Request/Response",
		IsRunning:      h.running.Load(),
		HeaderOverhead: int(h.lastHeader.Load()),
	}
	h.counters.Fill(&st)
	return st
}

// requestHeaderSize ước lượng số byte header thật của request HTTP/1.1.
func requestHeaderSize(r *http.Request) int {
	n := len(r.Method) + len(r.URL.RequestURI()) + len(r.Proto) + 4
	n += len("Host: ") + len(r.Host) + 2
	for k, vs := range r.Header {
		for _, v := range vs {
			n += len(k) + len(v) + 4
		}
	}
	return n + 2
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}
