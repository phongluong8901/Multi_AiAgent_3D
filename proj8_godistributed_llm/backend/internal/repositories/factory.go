package repositories

import (
	"context"
	"fmt"
	"log/slog"
	"strings"

	postgresrepo "go-distributed-llm/internal/repositories/postgres"
	"go-distributed-llm/shared/ports"
)

// NewRepository là Factory khởi tạo tầng lưu trữ ("postgres", "memory", "noop").
// Với PostgreSQL, tự động bọc qua AsyncRepository để ghi message/usage bất đồng bộ không làm tăng TTFT.
func NewRepository(ctx context.Context, driver string, dsn string, log *slog.Logger) (ports.Repository, func(), error) {
	cleanup := func() {}

	switch strings.ToLower(strings.TrimSpace(driver)) {
	case "noop":
		return postgresrepo.NewNoopRepository(), cleanup, nil
	case "memory", "in-memory":
		if log != nil {
			log.Info("using in-memory chat repository")
		}
		return postgresrepo.NewMemoryRepository(), cleanup, nil
	case "", "postgres", "postgresql":
		if strings.TrimSpace(dsn) == "" {
			if log != nil {
				log.Warn("postgres DSN empty, running with in-memory repository")
			}
			return postgresrepo.NewMemoryRepository(), cleanup, nil
		}
		pool, err := postgresrepo.NewPostgresPool(ctx, dsn)
		if err != nil {
			if log != nil {
				log.Warn("postgres unavailable, falling back to in-memory repository", "err", err)
			}
			return postgresrepo.NewMemoryRepository(), cleanup, nil
		}
		if log != nil {
			log.Info("connected to PostgreSQL repository (async write pipeline enabled)")
		}
		asyncRepo := NewAsyncRepository(postgresrepo.NewChatRepository(pool), 2048, log)
		return asyncRepo, func() {
			asyncRepo.Close()
			pool.Close()
		}, nil
	default:
		return nil, cleanup, fmt.Errorf("unsupported repository driver: %s", driver)
	}
}
