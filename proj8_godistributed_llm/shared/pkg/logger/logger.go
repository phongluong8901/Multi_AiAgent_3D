package logger

import (
	"log/slog"
	"os"
)

// NewLogger khởi tạo structured logger chuẩn (log/slog) dùng chung cho Gateway và Worker.
func NewLogger(service string) *slog.Logger {
	handler := slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{
		Level: slog.LevelInfo,
	})
	return slog.New(handler).With("service", service)
}

