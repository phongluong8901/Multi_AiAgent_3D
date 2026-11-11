package main

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"net"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	grpcclient "go-distributed-llm/internal/clients/grpc"
	"go-distributed-llm/internal/handlers"
	"go-distributed-llm/internal/metrics"
	"go-distributed-llm/internal/repositories"
	"go-distributed-llm/internal/services"
	pb "go-distributed-llm/shared/api/proto"
	"go-distributed-llm/shared/pkg/config"
	"go-distributed-llm/shared/pkg/logger"
	redisrepo "go-distributed-llm/shared/repositories/redis"

	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials"
)

func main() {
	configPath := flag.String("config", "configs/gateway.yaml", "path to gateway yaml config")
	flag.Parse()

	log := logger.NewLogger("gateway")

	cfg, err := config.LoadGatewayConfig(*configPath)
	if err != nil {
		log.Error("failed to load config", "err", err)
		os.Exit(1)
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	// 1. Repositories: Redis UniversalClient (Streams + Single-Channel Pub/Sub + MGET NodeRegistry + RateLimiter) & Database
	rdb, err := redisrepo.NewRedisClient(cfg.Redis.Addr, cfg.Redis.MasterName, cfg.Redis.Password, cfg.Redis.DB)
	if err != nil {
		log.Error("failed to connect redis", "addr", cfg.Redis.Addr, "err", err)
		os.Exit(1)
	}
	defer rdb.Close()

	queue := redisrepo.NewRedisStreamQueue(rdb)
	pubsub := redisrepo.NewRedisEventBus(rdb)
	registry := redisrepo.NewRedisNodeRegistry(rdb)
	rateLimiter := redisrepo.NewRedisRateLimiter(rdb)

	repo, cleanupRepo, err := repositories.NewRepository(ctx, cfg.Postgres.Driver, cfg.Postgres.DSN, log)
	if err != nil {
		log.Error("failed to init repository", "driver", cfg.Postgres.Driver, "err", err)
		os.Exit(1)
	}
	defer cleanupRepo()

	// 2. Services: ChatService (2s Node Cache + Fail-Fast max_queue_depth) + AdminService + SSEHub + Metrics
	sseHub := services.NewSSEHub()
	gatewayMetrics := metrics.NewGatewayMetrics()
	chatSvc := services.NewChatService(
		queue,
		pubsub,
		registry,
		repo,
		sseHub,
		gatewayMetrics,
		cfg.Server.AdvertiseGRPCAddr,
		cfg.Server.AdvertiseHTTPAddr,
		cfg.Server.MaxQueueDepth,
		log,
	)
	adminSvc := services.NewAdminService(queue, registry)

	// 3. gRPC Token Server (hỗ trợ bật TLS nếu cấu hình grpc_tls_cert & grpc_tls_key)
	var grpcServer *grpc.Server
	if cfg.Server.EnableGRPC {
		grpcListenAddr := fmt.Sprintf(":%d", cfg.Server.GRPCPort)
		lis, err := net.Listen("tcp", grpcListenAddr)
		if err != nil {
			log.Error("gRPC listen failed", "addr", grpcListenAddr, "err", err)
			os.Exit(1)
		}

		var serverOpts []grpc.ServerOption
		if strings.TrimSpace(cfg.Server.GRPCTLSCert) != "" && strings.TrimSpace(cfg.Server.GRPCTLSKey) != "" {
			creds, tlsErr := credentials.NewServerTLSFromFile(cfg.Server.GRPCTLSCert, cfg.Server.GRPCTLSKey)
			if tlsErr != nil {
				log.Error("failed to load gRPC TLS credentials", "err", tlsErr)
				os.Exit(1)
			}
			serverOpts = append(serverOpts, grpc.Creds(creds))
			log.Info("gRPC TLS enabled")
		}

		grpcServer = grpc.NewServer(serverOpts...)
		pb.RegisterTokenStreamerServer(grpcServer, grpcclient.NewGrpcTokenServer(sseHub))

		go func() {
			log.Info("gRPC Server listening", "addr", grpcListenAddr, "advertise_addr", cfg.Server.AdvertiseGRPCAddr)
			if serveErr := grpcServer.Serve(lis); serveErr != nil {
				log.Error("gRPC serve stopped", "err", serveErr)
			}
		}()
	} else {
		log.Info("gRPC Server disabled, accepting internal token streams via HTTP only")
	}

	// 4. HTTP Handlers & Router (REST + SSE + OpenAI /v1 + Prometheus /metrics + Distributed RateLimit)
	router := handlers.NewRouter(handlers.GatewayRouterDeps{
		ChatService:  chatSvc,
		AdminService: adminSvc,
		Metrics:      gatewayMetrics,
		RateLimiter:  rateLimiter,
		APIKey:       cfg.Auth.APIKey,
		RateLimitRPM: cfg.Auth.RateLimitRPM,
	})

	httpAddr := fmt.Sprintf(":%d", cfg.Server.HTTPPort)
	httpServer := &http.Server{
		Addr:              httpAddr,
		Handler:           router,
		ReadHeaderTimeout: 10 * time.Second,
	}

	go func() {
		log.Info("HTTP/SSE Server listening",
			"addr", httpAddr,
			"advertise_http", cfg.Server.AdvertiseHTTPAddr,
			"max_queue_depth", cfg.Server.MaxQueueDepth,
		)
		if err := httpServer.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Error("HTTP server failed", "err", err)
			stop()
		}
	}()

	<-ctx.Done()
	log.Info("shutting down gateway...")

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_ = httpServer.Shutdown(shutdownCtx)
	if grpcServer != nil {
		grpcServer.GracefulStop()
	}
	log.Info("gateway stopped cleanly")
}
