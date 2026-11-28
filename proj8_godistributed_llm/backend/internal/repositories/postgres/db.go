package postgresrepo

import (
	"context"
	"fmt"
	"time"

	"go-distributed-llm/migrations"

	"github.com/jackc/pgx/v5/pgxpool"
)

// NewPostgresPool mở connection pool tới PostgreSQL và chạy schema migration từ migrations/001_init.sql.
func NewPostgresPool(ctx context.Context, dsn string) (*pgxpool.Pool, error) {
	cfg, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		return nil, fmt.Errorf("invalid postgres dsn: %w", err)
	}

	connectCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	pool, err := pgxpool.NewWithConfig(connectCtx, cfg)
	if err != nil {
		return nil, fmt.Errorf("postgres connect failed: %w", err)
	}

	if err := pool.Ping(connectCtx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("postgres ping failed: %w", err)
	}

	if _, err := pool.Exec(connectCtx, migrations.InitSQL); err != nil {
		pool.Close()
		return nil, fmt.Errorf("postgres schema init failed: %w", err)
	}

	return pool, nil
}

