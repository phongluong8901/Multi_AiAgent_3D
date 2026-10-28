package config

import (
	"os"
	"path/filepath"
)

type Config struct {
	Port            string
	ClientAppPath   string
	ClientSourceDir string
	JWTSecret       string
	GatewayWSURL    string
	DatabaseURL     string
	RedisURL        string
}

func LoadConfig() *Config {
	port := os.Getenv("PORT")
	if port == "" {
		port = "5010"
	}

	clientAppPath := os.Getenv("CLIENT_APP_PATH")
	if clientAppPath == "" {
		// Ưu tiên tìm bộ cài đặt Electron Desktop (.exe) trước, sau đó mới đến worker.exe
		candidates := []string{
			`/app/release/Go-Python Worker Monitor Setup 1.0.0.exe`,
			filepath.Join("..", "worker-client", "release", "Go-Python Worker Monitor Setup 1.0.0.exe"),
			filepath.Join("worker-client", "release", "Go-Python Worker Monitor Setup 1.0.0.exe"),
			`d:\A_Self_Proj\learn_mlflow\proj1_MultiAgent\backend-microservices\worker-client\release\Go-Python Worker Monitor Setup 1.0.0.exe`,
			`/app/release/worker.exe`,
			filepath.Join("..", "worker-client", "release", "worker.exe"),
			filepath.Join("worker-client", "release", "worker.exe"),
			`d:\A_Self_Proj\learn_mlflow\proj1_MultiAgent\backend-microservices\worker-client\release\worker.exe`,
		}
		for _, c := range candidates {
			if _, err := os.Stat(c); err == nil {
				clientAppPath = c
				break
			}
		}
		if clientAppPath == "" {
			clientAppPath = filepath.Join("..", "worker-client", "release", "Go-Python Worker Monitor Setup 1.0.0.exe")
		}
	}

	clientSourceDir := os.Getenv("CLIENT_SOURCE_DIR")
	if clientSourceDir == "" {
		clientSourceDir = filepath.Join("..", "worker-client")
	}

	jwtSecret := os.Getenv("JWT_SECRET")
	if jwtSecret == "" {
		jwtSecret = "super_secret_key_2026"
	}

	gatewayWSURL := os.Getenv("GATEWAY_WS_URL")
	if gatewayWSURL == "" {
		gatewayWSURL = "ws://localhost:4000/api/v1/distributed/ws"
	}

	databaseURL := os.Getenv("DATABASE_URL")
	if databaseURL == "" {
		// Mặc định kết nối database riêng distributed_db trên Neon PostgreSQL
		databaseURL = "postgresql://neondb_owner:npg_nGjr85EBbXPw@ep-fragrant-fire-a1icbw9e-pooler.ap-southeast-1.aws.neon.tech/distributed_db?sslmode=require"
	}

	redisURL := os.Getenv("REDIS_URL")
	if redisURL == "" {
		redisURL = "redis://localhost:6379/0"
	}

	return &Config{
		Port:            port,
		ClientAppPath:   clientAppPath,
		ClientSourceDir: clientSourceDir,
		JWTSecret:       jwtSecret,
		GatewayWSURL:    gatewayWSURL,
		DatabaseURL:     databaseURL,
		RedisURL:        redisURL,
	}
}
