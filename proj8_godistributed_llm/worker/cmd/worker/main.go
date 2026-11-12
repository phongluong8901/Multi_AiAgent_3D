package main

import (
	"context"
	"flag"
	"os"
	"os/signal"
	"syscall"

	"go-distributed-llm/shared/pkg/config"
	"go-distributed-llm/shared/pkg/logger"
	"go-distributed-llm/worker/pkg/agent"
)

// main là entry point CLI của Worker Node: nạp worker.yaml/ENV, khởi tạo Runner và chờ tín hiệu SIGINT/SIGTERM để tắt êm.
func main() {
	configPath := flag.String("config", "configs/worker.yaml", "path to worker yaml config")
	flag.Parse()

	log := logger.NewLogger("worker")

	cfg, err := config.LoadWorkerConfig(*configPath)
	if err != nil {
		log.Error("failed to load worker config", "err", err)
		os.Exit(1)
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	runner := agent.NewRunner()
	if err := runner.Start(ctx, cfg); err != nil {
		log.Error("failed to start worker", "err", err)
		os.Exit(1)
	}

	runner.Wait()
}
