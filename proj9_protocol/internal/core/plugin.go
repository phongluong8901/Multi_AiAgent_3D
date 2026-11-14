package core

import "context"

// ProtocolStats là thông số thời gian thực của từng giao thức.
type ProtocolStats struct {
	Key            string  `json:"key"`
	ProtocolName   string  `json:"protocol_name"`
	Port           string  `json:"port"`
	Endpoint       string  `json:"endpoint"`
	Direction      string  `json:"direction"`
	IsRunning      bool    `json:"is_running"`
	ActiveClients  int64   `json:"active_clients"`
	MsgInCount     uint64  `json:"msg_in_count"`
	MsgOutCount    uint64  `json:"msg_out_count"`
	BytesInTotal   uint64  `json:"bytes_in_total"`
	BytesOutTotal  uint64  `json:"bytes_out_total"`
	HeaderOverhead int     `json:"header_overhead_bytes"`
	AvgLatencyMs   float64 `json:"avg_latency_ms"`
}

// ProtocolPlugin là interface mà mọi thư mục trong internal/protocols/* phải implement.
//
// Quy ước:
//   - Start phải bind cổng ĐỒNG BỘ và trả lỗi ngay nếu thất bại (VD: cổng bị chiếm).
//     Việc phục vụ client chạy nền; plugin tự dừng khi ctx bị hủy.
//   - Stop phải idempotent (gọi nhiều lần không lỗi) và đóng mọi kết nối đang mở.
//   - Send phát gói tin từ hệ thống ra client của giao thức này, không được block lâu.
type ProtocolPlugin interface {
	Name() string
	Start(ctx context.Context, inbound chan<- UnifiedPacket) error
	Stop(ctx context.Context) error
	Send(packet UnifiedPacket) error
	Stats() ProtocolStats
}

// InboundSimulator là interface tùy chọn cho phép tiêm trực tiếp gói tin vào plugin
// để thống kê chính xác byte In/Overhead khi không mở được kết nối socket loopback.
type InboundSimulator interface {
	SimulateInbound(payload []byte, inbound chan<- UnifiedPacket) UnifiedPacket
}

// StatsResetter cho phép đặt lại các bộ đếm benchmark của plugin về 0.
type StatsResetter interface {
	ResetStats()
}
