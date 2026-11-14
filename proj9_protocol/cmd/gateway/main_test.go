package main

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

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
)

func newTestGateway(t *testing.T) (*gatewayApp, http.Handler, func()) {
	t.Helper()
	t.Chdir("../..")

	ctx, cancel := context.WithCancel(context.Background())
	app := &gatewayApp{
		reg:                 core.NewRegistry(),
		worker:              newWorkerMonitor(),
		workerForwardCh:     make(chan core.UnifiedPacket, 256),
		disableLoopbackDial: true,
		wsConns:             make(map[*netutil.SafeWS]bool),
		sseChans:            make(map[chan string]bool),
	}
	app.targetProto.Store("all")

	app.reg.Register(sse.NewSSEPlugin("127.0.0.1:0"))
	app.reg.Register(wsplugin.NewWSPlugin("127.0.0.1:0"))
	app.reg.Register(socketio.NewSocketIOPlugin("127.0.0.1:0"))
	app.reg.Register(http_rest.NewHTTPRestPlugin("127.0.0.1:0"))
	app.reg.Register(mjpeg.NewMJPEGPlugin("127.0.0.1:0"))
	app.reg.Register(rtp_udp.NewRTPUDPPlugin("127.0.0.1:0"))
	app.reg.Register(mqtt.NewMQTTPlugin("127.0.0.1:0"))
	app.reg.Register(grpc_stream.NewGRPCPlugin("127.0.0.1:0"))
	app.reg.Register(tcp_raw.NewTCPRawPlugin("127.0.0.1:0"))
	app.reg.Register(ndjson.NewNDJSONPlugin("127.0.0.1:0"))

	for _, name := range app.reg.Names() {
		if err := app.reg.Enable(name); err != nil {
			cancel()
			t.Fatalf("failed to enable protocol %s: %v", name, err)
		}
	}

	app.startInboundLoop(ctx)
	handler := app.routes(ctx)

	cleanup := func() {
		cancel()
		app.reg.StopAll()
	}
	return app, handler, cleanup
}

type controlStatsResponse struct {
	CurrentSwapTarget string               `json:"current_swap_target"`
	Protocols         []core.ProtocolStats `json:"protocols"`
}

type workerStatsResponse struct {
	WorkerID       string              `json:"worker_id"`
	RedisConnected bool                `json:"redis_connected"`
	TotalReceived  uint64              `json:"total_received"`
	TotalProcessed uint64              `json:"total_processed"`
	AvgLatencyMs   float64             `json:"avg_latency_ms"`
	RecentEvents   []WorkerPacketEvent `json:"recent_events"`
}

func doReq(t *testing.T, h http.Handler, method, target string, body []byte) *httptest.ResponseRecorder {
	t.Helper()
	var req *http.Request
	if body != nil {
		req = httptest.NewRequest(method, target, bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
	} else {
		req = httptest.NewRequest(method, target, nil)
	}
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	return rec
}

func waitWorkerCount(t *testing.T, h http.Handler, wantMin uint64) workerStatsResponse {
	t.Helper()
	deadline := time.Now().Add(2 * time.Second)
	for time.Now().Before(deadline) {
		rec := doReq(t, h, http.MethodGet, "/stats", nil)
		if rec.Code != http.StatusOK {
			t.Fatalf("GET /stats returned %d", rec.Code)
		}
		var st workerStatsResponse
		if err := json.Unmarshal(rec.Body.Bytes(), &st); err != nil {
			t.Fatalf("decode /stats: %v", err)
		}
		if st.TotalProcessed >= wantMin {
			return st
		}
		time.Sleep(15 * time.Millisecond)
	}
	t.Fatalf("timed out waiting for worker processed >= %d", wantMin)
	return workerStatsResponse{}
}

func TestGatewayAllProtocolsAndWorkerMonitor(t *testing.T) {
	_, handler, cleanup := newTestGateway(t)
	defer cleanup()

	// 1. Gửi gói tin test cho cả 9 giao thức truyền dữ liệu (bao gồm tcp_raw, ndjson, rtp_udp)
	tests := []struct {
		proto     string
		payload   string
		wantTopic string
		wantOvh   int
	}{
		{"http_rest", `{"device":"web","val":1}`, "/ingest", 550},
		{"websocket", `{"msg":"ws_test"}`, "/ws", 6},
		{"socketio", `{"event":"alarm","zone":3}`, "event:alarm", 13},
		{"mqtt", `{"topic":"factory/line1","temp":28.5}`, "factory/line1", 4 + len("factory/line1")},
		{"grpc", `{"rpc":"bidi"}`, grpc_stream.FullMethod, 14},
		{"rtp_udp", `{"frame":101}`, "rtp/datagram", 20},
		{"sse", `{"sse":"ok"}`, "/events", 8},
		{"tcp_raw", `{"plc":"ok"}`, "tcp/binary", 4},
		{"ndjson", `{"token":"hi"}`, "/ingest", 1},
	}

	for _, tc := range tests {
		body, _ := json.Marshal(SendRequest{Proto: tc.proto, Payload: tc.payload})
		rec := doReq(t, handler, http.MethodPost, "/api/send", body)
		if rec.Code != http.StatusOK {
			t.Fatalf("POST /api/send for %s failed: %d %s", tc.proto, rec.Code, rec.Body.String())
		}
		var resp struct {
			Status string             `json:"status"`
			Packet core.UnifiedPacket `json:"packet"`
		}
		if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
			t.Fatalf("invalid JSON response from /api/send (%s): %v", tc.proto, err)
		}
		if resp.Status != "success" {
			t.Fatalf("unexpected /api/send status for %s: %v", tc.proto, resp.Status)
		}
		if resp.Packet.TopicOrRoute != tc.wantTopic {
			t.Errorf("%s expected topic %q, got %q", tc.proto, tc.wantTopic, resp.Packet.TopicOrRoute)
		}
		if resp.Packet.OverheadBytes != tc.wantOvh {
			t.Errorf("%s expected overhead %d, got %d", tc.proto, tc.wantOvh, resp.Packet.OverheadBytes)
		}
	}

	// 2. Xác nhận Worker Monitor (/stats) nhận và xử lý đủ 9 gói tin
	wStats := waitWorkerCount(t, handler, uint64(len(tests)))
	if wStats.TotalReceived < uint64(len(tests)) || wStats.TotalProcessed < uint64(len(tests)) {
		t.Fatalf("expected >= %d packets in worker, got recv=%d proc=%d",
			len(tests), wStats.TotalReceived, wStats.TotalProcessed)
	}

	seenWorkerProto := make(map[string]bool)
	for _, ev := range wStats.RecentEvents {
		seenWorkerProto[ev.SourceProto] = true
	}
	for _, tc := range tests {
		if !seenWorkerProto[tc.proto] {
			t.Errorf("worker missing event from protocol %q", tc.proto)
		}
	}

	// 3. Kiểm tra /control/stats: cả 10 giao thức đang chạy, 9 giao thức có MsgIn >= 1 và MsgOut >= 9
	rec := doReq(t, handler, http.MethodGet, "/control/stats", nil)
	if rec.Code != http.StatusOK {
		t.Fatalf("GET /control/stats returned %d", rec.Code)
	}
	var cStats controlStatsResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &cStats); err != nil {
		t.Fatalf("decode /control/stats: %v", err)
	}
	if len(cStats.Protocols) != 10 {
		t.Fatalf("expected 10 protocols in /control/stats, got %d", len(cStats.Protocols))
	}

	byKey := make(map[string]core.ProtocolStats, len(cStats.Protocols))
	for _, st := range cStats.Protocols {
		if !st.IsRunning {
			t.Errorf("protocol %q expected to be running", st.Key)
		}
		byKey[st.Key] = st
	}

	for _, tc := range tests {
		st, ok := byKey[tc.proto]
		if !ok {
			t.Fatalf("missing stats entry for %q", tc.proto)
		}
		if st.MsgInCount < 1 || st.BytesInTotal == 0 {
			t.Errorf("protocol %q expected MsgInCount >= 1 and BytesInTotal > 0, got in=%d bytes=%d",
				tc.proto, st.MsgInCount, st.BytesInTotal)
		}
		if st.MsgOutCount < uint64(len(tests)) || st.BytesOutTotal == 0 {
			t.Errorf("protocol %q expected MsgOutCount >= %d and BytesOutTotal > 0, got out=%d bytes=%d",
				tc.proto, len(tests), st.MsgOutCount, st.BytesOutTotal)
		}
	}

	// 4. Kiểm tra Stress Test nguồn tcp_raw (50 gói) và Reset toàn bộ thông số về 0
	benchRec := doReq(t, handler, http.MethodPost, "/control/bench?source=tcp_raw&count=50", nil)
	if benchRec.Code != http.StatusOK {
		t.Fatalf("POST /control/bench failed: %d", benchRec.Code)
	}
	waitWorkerCount(t, handler, uint64(len(tests)+50))

	afterBench := doReq(t, handler, http.MethodGet, "/control/stats", nil)
	var bStats controlStatsResponse
	_ = json.Unmarshal(afterBench.Body.Bytes(), &bStats)
	var tcpIn uint64
	for _, st := range bStats.Protocols {
		if st.Key == "tcp_raw" {
			tcpIn = st.MsgInCount
		}
	}
	if tcpIn != 51 {
		t.Errorf("expected tcp_raw MsgInCount=51 (1 test + 50 bench), got %d", tcpIn)
	}

	resetRec := doReq(t, handler, http.MethodPost, "/control/reset", nil)
	if resetRec.Code != http.StatusOK {
		t.Fatalf("POST /control/reset failed: %d", resetRec.Code)
	}

	afterReset := doReq(t, handler, http.MethodGet, "/control/stats", nil)
	var rStats controlStatsResponse
	_ = json.Unmarshal(afterReset.Body.Bytes(), &rStats)
	for _, st := range rStats.Protocols {
		if st.MsgInCount != 0 || st.MsgOutCount != 0 || st.BytesInTotal != 0 || st.BytesOutTotal != 0 {
			t.Errorf("protocol %q not reset to zero: %+v", st.Key, st)
		}
	}

	wResetRec := doReq(t, handler, http.MethodGet, "/stats", nil)
	var wReset workerStatsResponse
	_ = json.Unmarshal(wResetRec.Body.Bytes(), &wReset)
	if wReset.TotalReceived != 0 || wReset.TotalProcessed != 0 || len(wReset.RecentEvents) != 0 {
		t.Errorf("worker not reset cleanly: %+v", wReset)
	}
}

func TestGatewaySwapToggleAndStaticRoutes(t *testing.T) {
	_, handler, cleanup := newTestGateway(t)
	defer cleanup()

	// Kiểm tra Swap Target chỉ định tuyến tới websocket
	rec := doReq(t, handler, http.MethodPost, "/control/swap?target=websocket", nil)
	if rec.Code != http.StatusOK {
		t.Fatalf("POST /control/swap failed: %d", rec.Code)
	}

	body, _ := json.Marshal(SendRequest{Proto: "http_rest", Payload: `{"swap":"ws_only"}`})
	if r := doReq(t, handler, http.MethodPost, "/api/send", body); r.Code != http.StatusOK {
		t.Fatalf("/api/send after swap failed: %d", r.Code)
	}
	waitWorkerCount(t, handler, 1)

	afterStatsRec := doReq(t, handler, http.MethodGet, "/control/stats", nil)
	var after controlStatsResponse
	_ = json.Unmarshal(afterStatsRec.Body.Bytes(), &after)
	if after.CurrentSwapTarget != "websocket" {
		t.Fatalf("expected swap target 'websocket', got %q", after.CurrentSwapTarget)
	}

	var wsOutAfter, mqttOutAfter uint64
	for _, st := range after.Protocols {
		if st.Key == "websocket" {
			wsOutAfter = st.MsgOutCount
		}
		if st.Key == "mqtt" {
			mqttOutAfter = st.MsgOutCount
		}
	}
	if wsOutAfter != 1 {
		t.Errorf("expected websocket MsgOutCount=1 after targeted swap, got %d", wsOutAfter)
	}
	if mqttOutAfter != 0 {
		t.Errorf("expected mqtt MsgOutCount=0 when swapped to websocket, got %d", mqttOutAfter)
	}

	// Kiểm tra Toggle off / on
	if r := doReq(t, handler, http.MethodPost, "/control/toggle?proto=mqtt&state=off", nil); r.Code != http.StatusOK {
		t.Fatalf("toggle off failed: %d %s", r.Code, r.Body.String())
	}
	if r := doReq(t, handler, http.MethodPost, "/control/toggle?proto=mqtt&state=on", nil); r.Code != http.StatusOK {
		t.Fatalf("toggle on failed: %d %s", r.Code, r.Body.String())
	}

	// Kiểm tra Worker /simulate và /clear
	if r := doReq(t, handler, http.MethodPost, "/simulate?proto=unit_test", []byte(`{"ok":true}`)); r.Code != http.StatusOK {
		t.Fatalf("POST /simulate failed: %d", r.Code)
	}
	if r := doReq(t, handler, http.MethodPost, "/clear", nil); r.Code != http.StatusOK {
		t.Fatalf("POST /clear failed: %d", r.Code)
	}
	statsAfterClear := doReq(t, handler, http.MethodGet, "/stats", nil)
	var wCleared workerStatsResponse
	_ = json.Unmarshal(statsAfterClear.Body.Bytes(), &wCleared)
	if len(wCleared.RecentEvents) != 0 {
		t.Errorf("expected RecentEvents empty after /clear, got %d", len(wCleared.RecentEvents))
	}

	// Kiểm tra các file static UI và JSON 404
	for _, path := range []string{"/", "/style.css", "/app.js", "/worker.html"} {
		r := doReq(t, handler, http.MethodGet, path, nil)
		if r.Code != http.StatusOK {
			t.Errorf("GET %s returned status %d", path, r.Code)
		}
	}
	notFound := doReq(t, handler, http.MethodGet, "/sensor/unknown", nil)
	if notFound.Code != http.StatusNotFound || !strings.Contains(notFound.Header().Get("Content-Type"), "application/json") {
		t.Errorf("expected 404 application/json for unknown route, got %d (%s)",
			notFound.Code, notFound.Header().Get("Content-Type"))
	}
}
