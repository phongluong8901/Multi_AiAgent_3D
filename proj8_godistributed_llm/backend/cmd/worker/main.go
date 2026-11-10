package main

import (
	"context"
	"flag"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	grpcclient "go-distributed-llm/internal/clients/grpc"
	httpclient "go-distributed-llm/internal/clients/http"
	llmclient "go-distributed-llm/internal/clients/llm"
	"go-distributed-llm/internal/ports"
	redisrepo "go-distributed-llm/internal/repositories/redis"
	"go-distributed-llm/internal/worker"
	"go-distributed-llm/pkg/config"
	"go-distributed-llm/pkg/logger"
)

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

	// 1. Repositories: Redis (JobQueue, EventBus, NodeRegistry)
	rdb, err := redisrepo.NewRedisClient(cfg.Redis.Addr, cfg.Redis.Password, cfg.Redis.DB)
	if err != nil {
		log.Error("failed to connect redis", "addr", cfg.Redis.Addr, "err", err)
		os.Exit(1)
	}
	defer rdb.Close()

	queue := redisrepo.NewRedisStreamQueue(rdb)
	pubsub := redisrepo.NewRedisEventBus(rdb)
	registry := redisrepo.NewRedisNodeRegistry(rdb)

	// 2. Clients: Local LLM Engine (swap ollama <-> llamacpp) & Token Streamer (swap grpc <-> http)
	llmTimeout := time.Duration(cfg.LLM.TimeoutSec) * time.Second
	llmProvider, err := llmclient.NewLLMProvider(cfg.LLM.Provider, cfg.LLM.BaseURL, llmTimeout)
	if err != nil {
		log.Error("failed to init llm provider", "provider", cfg.LLM.Provider, "err", err)
		os.Exit(1)
	}

	var streamer ports.TokenStreamer
	transportMode := strings.ToLower(strings.TrimSpace(cfg.Worker.Transport))
	if transportMode == "http" {
		streamer = httpclient.NewHTTPTokenClient(llmTimeout + 30*time.Second)
	} else {
		transportMode = "grpc"
		grpcPool := grpcclient.NewGrpcClientPool()
		defer grpcPool.Close()
		streamer = grpcPool
	}

	// 3. Worker Engine
	hbInterval := time.Duration(cfg.Worker.HeartbeatIntervalSec) * time.Second
	clusterWorker := worker.NewClusterWorker(
		cfg.Worker.ID,
		transportMode,
		cfg.Redis.ConsumerGroup,
		cfg.Worker.SupportedModels,
		cfg.Worker.MaxParallelJobs,
		hbInterval,
		queue,
		pubsub,
		registry,
		llmProvider,
		streamer,
		log,
	)

	log.Info("starting worker node",
		"worker_id", cfg.Worker.ID,
		"transport", transportMode,
		"provider", cfg.LLM.Provider,
		"llm_url", cfg.LLM.BaseURL,
		"models", cfg.Worker.SupportedModels,
		"max_slots", cfg.Worker.MaxParallelJobs,
	)

	clusterWorker.Start(ctx)
	log.Info("worker node stopped cleanly", "worker_id", cfg.Worker.ID)
}
