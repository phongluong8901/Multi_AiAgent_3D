package mqtt

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"os"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"protocol-testbench/internal/core"

	mqttserver "github.com/mochi-mqtt/server/v2"
	"github.com/mochi-mqtt/server/v2/listeners"
	"github.com/mochi-mqtt/server/v2/packets"
)

// OutTopicPrefix: Gateway phát gói tin ra MQTT trên topic "gateway/out/<nguồn>".
// Thiết bị muốn nhận dữ liệu từ Gateway: SUBSCRIBE "gateway/out/#".
const OutTopicPrefix = "gateway/out/"

// MQTTPlugin nhúng broker Mochi-MQTT (MQTT 3.1.1 / 5.0).
type MQTTPlugin struct {
	port     string
	mu       sync.Mutex
	server   *mqttserver.Server
	running  atomic.Bool
	seq      atomic.Uint64
	counters core.Counters
}

func NewMQTTPlugin(port string) *MQTTPlugin {
	return &MQTTPlugin{port: port}
}

func (m *MQTTPlugin) Name() string { return "mqtt" }

func (m *MQTTPlugin) Start(ctx context.Context, inbound chan<- core.UnifiedPacket) error {
	srv := mqttserver.New(&mqttserver.Options{
		InlineClient: true,
		Logger:       slog.New(slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelWarn})),
	})
	// benchHook đảm nhận cả auth/ACL (cho phép tất cả trong môi trường test) để không phụ thuộc hooks/auth.
	if err := srv.AddHook(&benchHook{parent: m, inbound: inbound}, nil); err != nil {
		return err
	}
	tcp := listeners.NewTCP(listeners.Config{Type: "tcp", ID: "mqtt-bench", Address: m.port})
	if err := srv.AddListener(tcp); err != nil {
		return err
	}
	if err := srv.Serve(); err != nil {
		_ = srv.Close()
		return err
	}

	m.mu.Lock()
	m.server = srv
	m.mu.Unlock()
	m.running.Store(true)
	go func() {
		<-ctx.Done()
		_ = m.Stop(context.Background())
	}()
	return nil
}

func (m *MQTTPlugin) Stop(context.Context) error {
	m.running.Store(false)
	m.mu.Lock()
	srv := m.server
	m.server = nil
	m.mu.Unlock()
	if srv == nil {
		return nil
	}
	m.counters.Clients.Store(0)
	return srv.Close()
}

// Send publish gói tin ra topic gateway/out/<nguồn> cho mọi subscriber.
func (m *MQTTPlugin) Send(pkt core.UnifiedPacket) error {
	m.mu.Lock()
	srv := m.server
	m.mu.Unlock()
	if srv == nil || !m.running.Load() {
		return nil
	}
	m.counters.Latency.Observe(pkt.CalculateLatencyMs())
	topic := OutTopicPrefix + sanitizeTopic(pkt.SourceProto)
	data := pkt.WireJSON()
	if err := srv.Publish(topic, data, false, 0); err != nil {
		return err
	}
	m.counters.Out(len(data) + 2 + 2 + len(topic))
	return nil
}

func (m *MQTTPlugin) SimulateInbound(payload []byte, inbound chan<- core.UnifiedPacket) core.UnifiedPacket {
	topic := "sensor/temperature"
	var meta struct {
		Topic string `json:"topic"`
	}
	if json.Unmarshal(payload, &meta) == nil && meta.Topic != "" {
		topic = meta.Topic
	}

	overhead := 2 + 2 + len(topic)
	cp := bytes.Clone(payload)
	m.counters.In(len(cp) + overhead)

	// Nếu broker đang chạy và topic không trùng prefix đầu ra gateway/out/, publish qua inline client
	// để các MQTT subscriber ngoài cũng nhận được gói mô phỏng.
	m.mu.Lock()
	srv := m.server
	m.mu.Unlock()
	if srv != nil && m.running.Load() && !strings.HasPrefix(topic, OutTopicPrefix) {
		_ = srv.Publish(topic, cp, false, 0)
	}

	pkt := core.UnifiedPacket{
		ID:            fmt.Sprintf("mqtt_%d", m.seq.Add(1)),
		SourceProto:   "mqtt",
		ClientID:      "gateway_sim",
		TopicOrRoute:  topic,
		Payload:       cp,
		PayloadSize:   len(cp),
		OverheadBytes: overhead,
		CreatedAtNano: time.Now().UnixNano(),
	}
	if inbound != nil {
		inbound <- pkt
	}
	return pkt
}

func (m *MQTTPlugin) ResetStats() {
	m.counters.Reset()
}

func sanitizeTopic(s string) string {
	if s == "" {
		return "unknown"
	}
	return strings.NewReplacer("#", "_", "+", "_", "/", "_").Replace(s)
}

func (m *MQTTPlugin) Stats() core.ProtocolStats {
	st := core.ProtocolStats{
		ProtocolName:   "MQTT 3.1.1 / 5.0 Broker",
		Port:           m.port,
		Endpoint:       "PUBLISH bất kỳ topic; SUBSCRIBE " + OutTopicPrefix + "#",
		Direction:      "Pub/Sub 2 chiều",
		IsRunning:      m.running.Load(),
		HeaderOverhead: 2,
	}
	m.counters.Fill(&st)
	return st
}

// benchHook đếm client, đếm byte và đẩy gói tin từ thiết bị vào trục chính.
type benchHook struct {
	mqttserver.HookBase
	parent  *MQTTPlugin
	inbound chan<- core.UnifiedPacket
}

func (h *benchHook) ID() string { return "bench-hook" }

func (h *benchHook) Provides(b byte) bool {
	return b == mqttserver.OnConnectAuthenticate ||
		b == mqttserver.OnACLCheck ||
		b == mqttserver.OnConnect ||
		b == mqttserver.OnDisconnect ||
		b == mqttserver.OnPublished
}

func (h *benchHook) OnConnectAuthenticate(_ *mqttserver.Client, _ packets.Packet) bool {
	return true
}

func (h *benchHook) OnACLCheck(_ *mqttserver.Client, _ string, _ bool) bool {
	return true
}

func (h *benchHook) OnConnect(cl *mqttserver.Client, _ packets.Packet) error {
	if !cl.Net.Inline {
		h.parent.counters.Clients.Add(1)
	}
	return nil
}

func (h *benchHook) OnDisconnect(cl *mqttserver.Client, _ error, _ bool) {
	if !cl.Net.Inline {
		h.parent.counters.Clients.Add(-1)
	}
}

func (h *benchHook) OnPublished(cl *mqttserver.Client, pk packets.Packet) {
	// Bỏ qua gói do chính Gateway publish (inline client) -> tránh vòng lặp vô hạn
	// inbound -> broadcast -> publish -> hook -> inbound ...
	if cl.Net.Inline {
		return
	}
	overhead := 2 + 2 + len(pk.TopicName)
	h.parent.counters.In(len(pk.Payload) + overhead)

	payload := make([]byte, len(pk.Payload))
	copy(payload, pk.Payload)
	h.inbound <- core.UnifiedPacket{
		ID:            "mqtt_" + cl.ID + "_" + time.Now().Format("150405.000000"),
		SourceProto:   "mqtt",
		ClientID:      cl.ID,
		TopicOrRoute:  pk.TopicName,
		Payload:       payload,
		PayloadSize:   len(payload),
		OverheadBytes: overhead,
		CreatedAtNano: time.Now().UnixNano(),
	}
}
