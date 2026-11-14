package core

import (
	"encoding/json"
	"math"
	"time"
)

// UnifiedPacket là định dạng chung khi dữ liệu đi qua lại giữa các protocol.
type UnifiedPacket struct {
	ID            string            `json:"id"`
	SourceProto   string            `json:"source_proto"`    // VD: "mqtt", "grpc", "http_rest"
	TargetProto   string            `json:"target_proto"`    // Giao thức đích khi định tuyến (swap)
	ClientID      string            `json:"client_id"`       // Địa chỉ / định danh client gửi
	TopicOrRoute  string            `json:"topic_or_route"`  // "/sensor/temp", "/ingest", ...
	Payload       []byte            `json:"payload"`         // Dữ liệu thô (JSON, nhị phân, ...)
	PayloadSize   int               `json:"payload_size"`    // Kích thước payload (byte)
	OverheadBytes int               `json:"overhead_bytes"`  // Số byte header của giao thức gốc
	CreatedAtNano int64             `json:"created_at_nano"` // Thời điểm gói tin vào hệ thống (đo latency)
	Metadata      map[string]string `json:"metadata,omitempty"`
}

// CalculateLatencyMs trả về độ trễ (ms) kể từ khi gói tin vào hệ thống.
func (p *UnifiedPacket) CalculateLatencyMs() float64 {
	if p.CreatedAtNano == 0 {
		return 0
	}
	return float64(time.Now().UnixNano()-p.CreatedAtNano) / 1e6
}

// WireJSON là dạng JSON thống nhất khi Gateway phát gói tin ra client của mọi giao thức.
func (p UnifiedPacket) WireJSON() []byte {
	var data any
	if json.Valid(p.Payload) {
		data = json.RawMessage(p.Payload)
	} else {
		data = string(p.Payload)
	}
	b, _ := json.Marshal(struct {
		ID        string  `json:"id"`
		Source    string  `json:"source"`
		Topic     string  `json:"topic,omitempty"`
		Size      int     `json:"size"`
		LatencyMs float64 `json:"latency_ms"`
		Data      any     `json:"data"`
	}{p.ID, p.SourceProto, p.TopicOrRoute, p.PayloadSize, math.Round(p.CalculateLatencyMs()*1000) / 1000, data})
	return b
}
