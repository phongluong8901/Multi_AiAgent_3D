package mjpeg

import (
	"bytes"
	"context"
	"fmt"
	"image"
	"image/color"
	"image/draw"
	"image/jpeg"
	"net/http"
	"sync/atomic"
	"time"

	"protocol-testbench/internal/core"
	"protocol-testbench/internal/netutil"
)

// MJPEGPlugin giả lập camera ESP32-CAM: multipart/x-mixed-replace ~15 FPS.
// Đây là luồng video 1 chiều, không nhận gói tin dữ liệu từ Gateway.
type MJPEGPlugin struct {
	port     string
	server   netutil.HTTPServer
	running  atomic.Bool
	seq      atomic.Uint64
	counters core.Counters
}

func NewMJPEGPlugin(port string) *MJPEGPlugin {
	return &MJPEGPlugin{port: port}
}

func (m *MJPEGPlugin) Name() string { return "mjpeg" }

func (m *MJPEGPlugin) Start(ctx context.Context, _ chan<- core.UnifiedPacket) error {
	mux := http.NewServeMux()
	mux.HandleFunc("/video", m.handleVideo)
	if err := m.server.Start(m.port, mux); err != nil {
		return err
	}
	m.running.Store(true)
	go func() {
		<-ctx.Done()
		_ = m.Stop(context.Background())
	}()
	return nil
}

func (m *MJPEGPlugin) handleVideo(w http.ResponseWriter, r *http.Request) {
	netutil.AllowCORS(w)
	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "streaming not supported", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "multipart/x-mixed-replace; boundary=frame")
	w.Header().Set("Cache-Control", "no-cache")

	m.counters.Clients.Add(1)
	defer m.counters.Clients.Add(-1)

	ticker := time.NewTicker(66 * time.Millisecond)
	defer ticker.Stop()

	step := 0
	for {
		start := time.Now()
		jpg := generateTestJPEGFrame(step)
		step = (step + 8) % 280

		header := fmt.Sprintf("--frame\r\nContent-Type: image/jpeg\r\nContent-Length: %d\r\n\r\n", len(jpg))
		if _, err := w.Write([]byte(header)); err != nil {
			return
		}
		if _, err := w.Write(jpg); err != nil {
			return
		}
		if _, err := w.Write([]byte("\r\n")); err != nil {
			return
		}
		flusher.Flush()
		m.counters.Out(len(header) + len(jpg) + 2)
		m.counters.Latency.Observe(float64(time.Since(start).Microseconds()) / 1000)

		select {
		case <-r.Context().Done():
			return
		case <-ticker.C:
		}
	}
}

// generateTestJPEGFrame tạo ảnh 320x240 có khối di chuyển (giả lập bounding box).
func generateTestJPEGFrame(offsetX int) []byte {
	img := image.NewRGBA(image.Rect(0, 0, 320, 240))
	draw.Draw(img, img.Bounds(), &image.Uniform{color.RGBA{20, 25, 35, 255}}, image.Point{}, draw.Src)
	box := image.Rect(offsetX, 80, offsetX+40, 160)
	draw.Draw(img, box, &image.Uniform{color.RGBA{0, 230, 118, 255}}, image.Point{}, draw.Src)
	var buf bytes.Buffer
	_ = jpeg.Encode(&buf, img, &jpeg.Options{Quality: 75})
	return buf.Bytes()
}

func (m *MJPEGPlugin) Stop(context.Context) error {
	m.running.Store(false)
	return m.server.Stop()
}

// Send: MJPEG chỉ phát video, bỏ qua gói tin dữ liệu.
func (m *MJPEGPlugin) Send(core.UnifiedPacket) error { return nil }

func (m *MJPEGPlugin) SimulateInbound(payload []byte, inbound chan<- core.UnifiedPacket) core.UnifiedPacket {
	const overhead = 64
	cp := bytes.Clone(payload)
	m.counters.In(len(cp) + overhead)
	pkt := core.UnifiedPacket{
		ID:            fmt.Sprintf("mjpeg_%d", m.seq.Add(1)),
		SourceProto:   "mjpeg",
		ClientID:      "gateway_sim",
		TopicOrRoute:  "/video",
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

func (m *MJPEGPlugin) ResetStats() {
	m.counters.Reset()
}

func (m *MJPEGPlugin) Stats() core.ProtocolStats {
	st := core.ProtocolStats{
		ProtocolName:   "MJPEG Stream (ESP32-CAM sim)",
		Port:           m.port,
		Endpoint:       "GET /video",
		Direction:      "Video 1 chiều (Server -> Client)",
		IsRunning:      m.running.Load(),
		HeaderOverhead: 64,
	}
	m.counters.Fill(&st)
	return st
}
