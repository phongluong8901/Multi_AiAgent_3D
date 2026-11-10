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
	"syscall"
	"time"

	pb "go-distributed-llm/api/proto"
	grpcclient "go-distributed-llm/internal/clients/grpc"
	"go-distributed-llm/internal/handlers"
	"go-distributed-llm/internal/repositories"
	redisrepo "go-distributed-llm/internal/repositories/redis"
	"go-distributed-llm/internal/services"
	"go-distributed-llm/pkg/config"
	"go-distributed-llm/pkg/logger"

	"google.golang.org/grpc"
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

	// 1. Repositories: Redis (Job Queue, EventBus, NodeRegistry) + Database (swap qua driver config)
	rdb, err := redisrepo.NewRedisClient(cfg.Redis.Addr, cfg.Redis.Password, cfg.Redis.DB)
	if err != nil {
		log.Error("failed to connect redis", "addr", cfg.Redis.Addr, "err", err)
		os.Exit(1)
	}
	defer rdb.Close()

	queue := redisrepo.NewRedisStreamQueue(rdb)
	pubsub := redisrepo.NewRedisEventBus(rdb)
	registry := redisrepo.NewRedisNodeRegistry(rdb)

	repo, cleanupRepo, err := repositories.NewRepository(ctx, cfg.Postgres.Driver, cfg.Postgres.DSN, log)
	if err != nil {
		log.Error("failed to init repository", "driver", cfg.Postgres.Driver, "err", err)
		os.Exit(1)
	}
	defer cleanupRepo()

	// 2. Services: ChatService + AdminService + SSEHub
	sseHub := services.NewSSEHub()
	chatSvc := services.NewChatService(
		queue,
		pubsub,
		registry,
		repo,
		sseHub,
		cfg.Server.AdvertiseGRPCAddr,
		cfg.Server.AdvertiseHTTPAddr,
		log,
	)
	adminSvc := services.NewAdminService(queue, registry)

	// 3. gRPC Token Server (nhận stream nhị phân từ các Worker Nodes)
	var grpcServer *grpc.Server
	if cfg.Server.EnableGRPC {
		grpcListenAddr := fmt.Sprintf(":%d", cfg.Server.GRPCPort)
		lis, err := net.Listen("tcp", grpcListenAddr)
		if err != nil {
			log.Error("gRPC listen failed", "addr", grpcListenAddr, "err", err)
			os.Exit(1)
		}

		grpcServer = grpc.NewServer()
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

	// 4. HTTP Handlers & Router (REST + SSE + Internal HTTP Token Receiver)
	router := handlers.NewRouter(handlers.GatewayRouterDeps{
		ChatService:  chatSvc,
		AdminService: adminSvc,
		APIKey:       cfg.Auth.APIKey,
	})

	httpAddr := fmt.Sprintf(":%d", cfg.Server.HTTPPort)
	httpServer := &http.Server{
		Addr:              httpAddr,
		Handler:           router,
		ReadHeaderTimeout: 10 * time.Second,
	}

	go func() {
		log.Info("HTTP/SSE Server listening", "addr", httpAddr, "advertise_http", cfg.Server.AdvertiseHTTPAddr)
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
