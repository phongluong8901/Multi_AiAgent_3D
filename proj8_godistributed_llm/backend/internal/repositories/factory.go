package repositories

import (
	"context"
	"fmt"
	"log/slog"
	"strings"

	"go-distributed-llm/internal/ports"
	postgresrepo "go-distributed-llm/internal/repositories/postgres"
)

// NewRepository là Factory khởi tạo tầng lưu trữ dựa theo driver cấu hình ("postgres", "noop").
// Muốn swap sang MySQL/SQLite/MongoDB chỉ cần thêm case mới implement ports.Repository.
func NewRepository(ctx context.Context, driver string, dsn string, log *slog.Logger) (ports.Repository, func(), error) {
	cleanup := func() {}

	switch strings.ToLower(strings.TrimSpace(driver)) {
	case "noop", "memory":
		return postgresrepo.NewNoopRepository(), cleanup, nil
	case "", "postgres", "postgresql":
		if strings.TrimSpace(dsn) == "" {
			if log != nil {
				log.Warn("postgres DSN empty, running with noop repository")
			}
			return postgresrepo.NewNoopRepository(), cleanup, nil
		}
		pool, err := postgresrepo.NewPostgresPool(ctx, dsn)
		if err != nil {
			if log != nil {
				log.Warn("postgres unavailable, falling back to noop repository", "err", err)
			}
			return postgresrepo.NewNoopRepository(), cleanup, nil
		}
		if log != nil {
			log.Info("connected to PostgreSQL repository")
		}
		return postgresrepo.NewChatRepository(pool), pool.Close, nil
	default:
		return nil, cleanup, fmt.Errorf("unsupported repository driver: %s", driver)
	}
}

