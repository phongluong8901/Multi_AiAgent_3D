// Package main là điểm khởi đầu của Distributed Service (Go).
// Dịch vụ này quản lý mạng lưới tính toán phân tán (Partner Nodes),
// đánh giá phần cứng (Benchmark), phân phối ứng dụng Electron Worker
// và điều phối suy luận AI qua đường hầm WebSocket / Server-Sent Events (SSE).
package main

import (
	"log"
	"net/http"
	"os"

	"distributed-service/config"
	"distributed-service/handlers"
	"distributed-service/service"
	"distributed-service/storage"
)

// corsMiddleware thiết lập tiêu đề Cross-Origin Resource Sharing (CORS) cho toàn bộ các HTTP request.
// Hỗ trợ xử lý nhanh preflight request (OPTIONS) để tương thích với trình duyệt và API Gateway.
func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With, Accept")

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusOK)
			return
		}

		next.ServeHTTP(w, r)
	})
}

// main khởi tạo cấu hình, kết nối cơ sở dữ liệu, đăng ký các HTTP/WebSocket route và khởi chạy HTTP server.
func main() {
	cfg := config.LoadConfig()

	log.Println("==================================================")
	log.Println("[INFO] Khởi động Multi-Agent Distributed Service (Go)")
	log.Printf("[CONFIG] Cổng lắng nghe: :%s\n", cfg.Port)
	log.Printf("[CONFIG] Đường dẫn Client App: %s\n", cfg.ClientAppPath)
	log.Println("==================================================")

	// Khởi tạo Storage: Neon PostgreSQL (Lưu trữ cấu hình Node bền vững, tự động fallback sang in-memory nếu lỗi)
	pgStorage, err := storage.NewPostgresStorage(cfg.DatabaseURL)
	if err != nil {
		log.Printf("[WARN] Không thể kết nối Neon PostgreSQL (%v), chuyển sang chế độ in-memory hoàn toàn.\n", err)
	} else {
		defer pgStorage.Close()
	}

	// Khởi tạo các dịch vụ nghiệp vụ cốt lõi (Core Services) - Chế độ In-Memory Native Direct WebSocket Routing
	benchmarkEngine := service.NewBenchmarkEngine()
	nodeRegistry := service.NewNodeRegistry(pgStorage)
	appDistributor := service.NewAppDistributor(cfg)

	// Khởi tạo các HTTP & WebSocket Handlers
	benchmarkHandler := handlers.NewBenchmarkHandler(benchmarkEngine)
	nodeHandler := handlers.NewNodeHandler(nodeRegistry, benchmarkEngine, appDistributor)
	appHandler := handlers.NewAppHandler(appDistributor, nodeRegistry)
	wsHandler := handlers.NewWSHandler(nodeRegistry)
	nodeHandler.SetWSHandler(wsHandler)

	// Thiết lập HTTP Router (Mux)
	mux := http.NewServeMux()

	// Health check endpoints
	mux.HandleFunc("/", handlers.HealthCheckHandler)
	mux.HandleFunc("/health", handlers.HealthCheckHandler)

	// Model Benchmark & Recommendation Endpoints
	mux.HandleFunc("/api/v1/distributed/benchmark", benchmarkHandler.HandleBenchmark)
	mux.HandleFunc("/api/v1/distributed/models/catalog", benchmarkHandler.HandleGetCatalog)
	mux.HandleFunc("/api/v1/distributed/models/download-info", benchmarkHandler.HandleGetDownloadInfo)
	mux.HandleFunc("/api/v1/distributed/models/setup-script", benchmarkHandler.HandleDownloadSetupScript)

	// Partner Node Management Endpoints
	mux.HandleFunc("/api/v1/distributed/nodes/register", nodeHandler.HandleRegisterNode)
	mux.HandleFunc("/api/v1/distributed/nodes/me", nodeHandler.HandleGetMyNode)
	mux.HandleFunc("/api/v1/distributed/nodes/toggle-status", nodeHandler.HandleToggleNodeStatus)
	mux.HandleFunc("/api/v1/distributed/nodes", nodeHandler.HandleListNodes)

	// Electron Client App Distribution Endpoints
	mux.HandleFunc("/api/v1/distributed/app/info", appHandler.HandleGetAppInfo)
	mux.HandleFunc("/api/v1/distributed/app/download", appHandler.HandleDownloadApp)
	mux.HandleFunc("/api/v1/distributed/app/config-file", appHandler.HandleDownloadConfigFile)

	// Real-time WebSocket & Inference Relay Endpoints
	mux.HandleFunc("/api/v1/distributed/ws", wsHandler.HandleWebSocket)
	mux.HandleFunc("/ws", wsHandler.HandleWebSocket)
	mux.HandleFunc("/api/v1/distributed/inference", wsHandler.HandleInferenceRelay)
	mux.HandleFunc("/api/v1/inference/execute", wsHandler.HandleInferenceRelay)

	wrappedHandler := corsMiddleware(mux)

	serverAddr := ":" + cfg.Port
	log.Printf("[INFO] [GO DISTRIBUTED] Server đang phục vụ tại http://localhost:%s\n", cfg.Port)
	log.Printf("[INFO] [GO DISTRIBUTED] WebSocket khả dụng tại ws://localhost:%s/api/v1/distributed/ws\n", cfg.Port)

	if err := http.ListenAndServe(serverAddr, wrappedHandler); err != nil {
		log.Fatalf("[ERROR] Lỗi khởi chạy server: %v\n", err)
		os.Exit(1)
	}
}
