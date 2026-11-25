package agent

import (
	"context"
	"fmt"
	"log/slog"
	"os"
	"strings"
	"sync"
	"time"
)

const maxLogEntries = 150

// LogEntry biểu thị 1 dòng log có cấu trúc cho Desktop App console viewer.
type LogEntry struct {
	Time    string `json:"time"`
	Level   string `json:"level"`
	Message string `json:"message"`
}

// LogBuffer lưu vòng tròn tối đa maxLogEntries dòng log gần nhất.
type LogBuffer struct {
	mu      sync.RWMutex
	entries []LogEntry
}

// NewLogBuffer khởi tạo bộ đệm vòng lưu log phục vụ Desktop App.
func NewLogBuffer() *LogBuffer {
	return &LogBuffer{}
}

// Add ghi thêm 1 dòng log mới vào bộ đệm và tự động cắt phần cũ nếu vượt quá maxLogEntries.
func (b *LogBuffer) Add(entry LogEntry) {
	b.mu.Lock()
	b.entries = append(b.entries, entry)
	if len(b.entries) > maxLogEntries {
		b.entries = b.entries[len(b.entries)-maxLogEntries:]
	}
	b.mu.Unlock()
}

// List trả về bản sao danh sách các dòng log hiện đang lưu trong bộ đệm.
func (b *LogBuffer) List() []LogEntry {
	b.mu.RLock()
	defer b.mu.RUnlock()
	out := make([]LogEntry, len(b.entries))
	copy(out, b.entries)
	return out
}

// Clear xóa sạch toàn bộ lịch sử log trong bộ đệm.
func (b *LogBuffer) Clear() {
	b.mu.Lock()
	b.entries = nil
	b.mu.Unlock()
}

// teeHandler cài đặt slog.Handler để vừa in log ra stdout vừa đẩy đồng thời vào LogBuffer cho UI.
type teeHandler struct {
	next   slog.Handler
	buf    *LogBuffer
	attrs  []slog.Attr
	groups []string
}

// NewTeeLogger khởi tạo slog.Logger nhân đôi output (Stdout + Ring Buffer).
func NewTeeLogger(service string, buf *LogBuffer) *slog.Logger {
	base := slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo})
	return slog.New(&teeHandler{next: base, buf: buf}).With("service", service)
}

// Enabled ủy quyền kiểm tra log level cho handler stdout gốc.
func (h *teeHandler) Enabled(ctx context.Context, level slog.Level) bool {
	return h.next.Enabled(ctx, level)
}

// Handle format các cặp key=value thành chuỗi dễ đọc để lưu vào LogBuffer trước khi in ra stdout.
func (h *teeHandler) Handle(ctx context.Context, r slog.Record) error {
	if h.buf != nil {
		var parts []string
		for _, a := range h.attrs {
			parts = append(parts, formatAttr(a))
		}
		r.Attrs(func(a slog.Attr) bool {
			parts = append(parts, formatAttr(a))
			return true
		})
		msg := r.Message
		if len(parts) > 0 {
			msg = msg + " (" + strings.Join(parts, ", ") + ")"
		}
		h.buf.Add(LogEntry{
			Time:    r.Time.Format(time.TimeOnly),
			Level:   r.Level.String(),
			Message: msg,
		})
	}
	return h.next.Handle(ctx, r)
}

// WithAttrs giữ lại các thuộc tính cố định (như service="worker") khi tạo sub-logger.
func (h *teeHandler) WithAttrs(attrs []slog.Attr) slog.Handler {
	combined := make([]slog.Attr, len(h.attrs)+len(attrs))
	copy(combined, h.attrs)
	copy(combined[len(h.attrs):], attrs)
	return &teeHandler{
		next:   h.next.WithAttrs(attrs),
		buf:    h.buf,
		attrs:  combined,
		groups: h.groups,
	}
}

// WithGroup giữ nguyên tên group khi slog.WithGroup được gọi.
func (h *teeHandler) WithGroup(name string) slog.Handler {
	return &teeHandler{
		next:   h.next.WithGroup(name),
		buf:    h.buf,
		attrs:  h.attrs,
		groups: append(append([]string{}, h.groups...), name),
	}
}

// formatAttr chuyển một slog.Attr thành chuỗi "key=value".
func formatAttr(a slog.Attr) string {
	return fmt.Sprintf("%s=%v", a.Key, a.Value.Any())
}

