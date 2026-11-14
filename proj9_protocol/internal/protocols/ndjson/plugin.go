package ndjson

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"sync"
	"sync/atomic"
	"time"

	"protocol-testbench/internal/core"
	"protocol-testbench/internal/netutil"
)

const (
	lineOverhead = 1       // Ký tự '\n' phân tách mỗi dòng JSON
	maxBody      = 2 << 20 // 2 MB
)

// NDJSONPlugin: luồng HTTP Chunked NDJSON (application/x-ndjson) chuyên cho streaming token AI/log.
type NDJSONPlugin struct {
	port      string
	server    netutil.HTTPServer
	running   atomic.Bool
	clientsMu sync.RWMutex
	clients   map[chan []byte]struct{}
	counters  core.Counters
	seq       atomic.Uint64
}

func NewNDJSONPlugin(port string) *NDJSONPlugin {
	return &NDJSONPlugin{
		port:    port,
		clients: make(map[chan []byte]struct{}),
	}
}

func (n *NDJSONPlugin) Name() string { return "ndjson" }

func (n *NDJSONPlugin) Start(ctx context.Context, inbound chan<- core.UnifiedPacket) error {
	mux := http.NewServeMux()
	mux.HandleFunc("/ingest", func(w http.ResponseWriter, r *http.Request) {
		n.handleIngest(w, r, inbound)
	})
	mux.HandleFunc("/stream", n.handleStream)

	if err := n.server.Start(n.port, mux); err != nil {
		return err
	}
	n.running.Store(true)
	go func() {
		<-ctx.Done()
		_ = n.Stop(context.Background())
	}()
	return nil
}

func (n *NDJSONPlugin) handleIngest(w http.ResponseWriter, r *http.Request, inbound chan<- core.UnifiedPacket) {
	netutil.AllowCORS(w)
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusNoContent)
		return
	}
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "chỉ chấp nhận POST"})
		return
	}

	scanner := bufio.NewScanner(http.MaxBytesReader(w, r.Body, maxBody))
	scanner.Buffer(make([]byte, 0, 64*1024), maxBody)

	ids := make([]string, 0, 4)
	for scanner.Scan() {
		trimmed := bytes.TrimSpace(scanner.Bytes())
		if len(trimmed) == 0 {
			continue
		}
		cp := bytes.Clone(trimmed)
		id := fmt.Sprintf("ndjson_%d", n.seq.Add(1))
		n.counters.In(len(cp) + lineOverhead)
		inbound <- core.UnifiedPacket{
			ID:            id,
			SourceProto:   "ndjson",
			ClientID:      r.RemoteAddr,
			TopicOrRoute:  r.URL.Path,
			Payload:       cp,
			PayloadSize:   len(cp),
			OverheadBytes: lineOverhead,
			CreatedAtNano: time.Now().UnixNano(),
		}
		ids = append(ids, id)
	}
	if err := scanner.Err(); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"status": "accepted", "lines": len(ids), "ids": ids})
}

func (n *NDJSONPlugin) handleStream(w http.ResponseWriter, r *http.Request) {
	netutil.AllowCORS(w)
	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "streaming not supported", http.StatusInternalServerError)
		return
	}

	h := w.Header()
	h.Set("Content-Type", "application/x-ndjson; charset=utf-8")
	h.Set("Cache-Control", "no-cache")
	h.Set("X-Accel-Buffering", "no")

	ch := make(chan []byte, 256)
	n.clientsMu.Lock()
	n.clients[ch] = struct{}{}
	n.clientsMu.Unlock()
	n.counters.Clients.Add(1)
	defer func() {
		n.clientsMu.Lock()
		delete(n.clients, ch)
		n.clientsMu.Unlock()
		n.counters.Clients.Add(-1)
	}()

	_, _ = w.Write([]byte("{\"type\":\"hello\",\"protocol\":\"ndjson\"}\n"))
	flusher.Flush()

	for {
		select {
		case <-r.Context().Done():
			return
		case data := <-ch:
			if _, err := fmt.Fprintf(w, "%s\n", data); err != nil {
				return
			}
			flusher.Flush()
			n.counters.Out(len(data) + lineOverhead)
		}
	}
}

func (n *NDJSONPlugin) Stop(context.Context) error {
	n.running.Store(false)
	return n.server.Stop()
}

func (n *NDJSONPlugin) Send(pkt core.UnifiedPacket) error {
	if !n.running.Load() {
		return nil
	}
	n.counters.Latency.Observe(pkt.CalculateLatencyMs())
	data := pkt.WireJSON()

	n.clientsMu.RLock()
	cnt := len(n.clients)
	for ch := range n.clients {
		select {
		case ch <- data:
		default:
		}
	}
	n.clientsMu.RUnlock()
	if cnt == 0 {
		n.counters.Out(len(data) + lineOverhead)
	}
	return nil
}

func (n *NDJSONPlugin) SimulateInbound(payload []byte, inbound chan<- core.UnifiedPacket) core.UnifiedPacket {
	cp := bytes.Clone(payload)
	n.counters.In(len(cp) + lineOverhead)
	pkt := core.UnifiedPacket{
		ID:            fmt.Sprintf("ndjson_%d", n.seq.Add(1)),
		SourceProto:   "ndjson",
		ClientID:      "gateway_sim",
		TopicOrRoute:  "/ingest",
		Payload:       cp,
		PayloadSize:   len(cp),
		OverheadBytes: lineOverhead,
		CreatedAtNano: time.Now().UnixNano(),
	}
	if inbound != nil {
		inbound <- pkt
	}
	return pkt
}

func (n *NDJSONPlugin) ResetStats() {
	n.counters.Reset()
}

func (n *NDJSONPlugin) Stats() core.ProtocolStats {
	st := core.ProtocolStats{
		ProtocolName:   "HTTP NDJSON Stream (AI/LLM Chunked)",
		Port:           n.port,
		Endpoint:       "POST /ingest, GET /stream",
		Direction:      "2 chiều (Stream/Ingest)",
		IsRunning:      n.running.Load(),
		HeaderOverhead: lineOverhead,
	}
	n.counters.Fill(&st)
	return st
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

