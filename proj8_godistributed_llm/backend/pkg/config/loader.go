package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"

	"gopkg.in/yaml.v3"
)

// GatewayConfig chứa toàn bộ cấu hình cho service API Gateway.
type GatewayConfig struct {
	Server struct {
		HTTPPort          int    `yaml:"http_port"`
		GRPCPort          int    `yaml:"grpc_port"`
		EnableGRPC        bool   `yaml:"enable_grpc"`
		AdvertiseGRPCAddr string `yaml:"advertise_grpc_addr"`
		AdvertiseHTTPAddr string `yaml:"advertise_http_addr"`
	} `yaml:"server"`
	Redis struct {
		Addr     string `yaml:"addr"`
		Password string `yaml:"password"`
		DB       int    `yaml:"db"`
	} `yaml:"redis"`
	Postgres struct {
		Driver string `yaml:"driver"`
		DSN    string `yaml:"dsn"`
	} `yaml:"postgres"`
	Auth struct {
		APIKey string `yaml:"api_key"`
	} `yaml:"auth"`
}

// WorkerConfig chứa toàn bộ cấu hình cho mỗi máy Worker Node.
type WorkerConfig struct {
	Worker struct {
		ID                   string   `yaml:"id"`
		Transport            string   `yaml:"transport"` // "grpc" hoặc "http"
		MaxParallelJobs      int      `yaml:"max_parallel_jobs"`
		SupportedModels      []string `yaml:"supported_models"`
		HeartbeatIntervalSec int      `yaml:"heartbeat_interval_sec"`
	} `yaml:"worker"`
	LLM struct {
		Provider   string `yaml:"provider"` // "ollama" hoặc "llamacpp"
		BaseURL    string `yaml:"base_url"`
		TimeoutSec int    `yaml:"timeout_sec"`
	} `yaml:"llm"`
	Redis struct {
		Addr          string `yaml:"addr"`
		Password      string `yaml:"password"`
		DB            int    `yaml:"db"`
		ConsumerGroup string `yaml:"consumer_group"`
	} `yaml:"redis"`
}

// LoadGatewayConfig đọc file YAML tại path; nếu file không tồn tại thì dùng giá trị mặc định local,
// sau đó cho phép biến môi trường ghi đè (ưu tiên Docker/CI).
func LoadGatewayConfig(path string) (*GatewayConfig, error) {
	cfg := &GatewayConfig{}
	cfg.Server.HTTPPort = 8088
	cfg.Server.GRPCPort = 50051
	cfg.Server.EnableGRPC = true
	cfg.Server.AdvertiseGRPCAddr = "127.0.0.1:50051"
	cfg.Server.AdvertiseHTTPAddr = "http://127.0.0.1:8088"
	cfg.Redis.Addr = "127.0.0.1:6379"
	cfg.Postgres.Driver = "postgres"

	if path != "" {
		if data, err := os.ReadFile(path); err == nil {
			if err := yaml.Unmarshal(data, cfg); err != nil {
				return nil, fmt.Errorf("parse gateway config %s: %w", path, err)
			}
		}
	}

	if v := os.Getenv("HTTP_PORT"); v != "" {
		if p, err := strconv.Atoi(v); err == nil {
			cfg.Server.HTTPPort = p
		}
	}
	if v := os.Getenv("GRPC_PORT"); v != "" {
		if p, err := strconv.Atoi(v); err == nil {
			cfg.Server.GRPCPort = p
		}
	}
	if v := os.Getenv("ENABLE_GRPC"); v != "" {
		if b, err := strconv.ParseBool(v); err == nil {
			cfg.Server.EnableGRPC = b
		}
	}
	if v := os.Getenv("ADVERTISE_GRPC_ADDR"); v != "" {
		cfg.Server.AdvertiseGRPCAddr = v
	}
	if v := os.Getenv("ADVERTISE_HTTP_ADDR"); v != "" {
		cfg.Server.AdvertiseHTTPAddr = v
	}
	if v := os.Getenv("REDIS_ADDR"); v != "" {
		cfg.Redis.Addr = v
	}
	if v := os.Getenv("REDIS_PASSWORD"); v != "" {
		cfg.Redis.Password = v
	}
	if v := os.Getenv("POSTGRES_DRIVER"); v != "" {
		cfg.Postgres.Driver = v
	}
	if v := os.Getenv("POSTGRES_DSN"); v != "" {
		cfg.Postgres.DSN = v
	}
	if v := os.Getenv("GATEWAY_API_KEY"); v != "" {
		cfg.Auth.APIKey = v
	}

	return cfg, nil
}

// LoadWorkerConfig đọc cấu hình Worker từ YAML và cho phép override bằng biến môi trường.
func LoadWorkerConfig(path string) (*WorkerConfig, error) {
	cfg := &WorkerConfig{}
	cfg.Worker.ID = "worker-node-01"
	cfg.Worker.Transport = "grpc"
	cfg.Worker.MaxParallelJobs = 2
	cfg.Worker.SupportedModels = []string{"qwen2.5:7b", "llama3.2:3b"}
	cfg.Worker.HeartbeatIntervalSec = 5
	cfg.LLM.Provider = "ollama"
	cfg.LLM.BaseURL = "http://127.0.0.1:11434"
	cfg.LLM.TimeoutSec = 120
	cfg.Redis.Addr = "127.0.0.1:6379"
	cfg.Redis.ConsumerGroup = "llm_cluster_group"

	if path != "" {
		if data, err := os.ReadFile(path); err == nil {
			if err := yaml.Unmarshal(data, cfg); err != nil {
				return nil, fmt.Errorf("parse worker config %s: %w", path, err)
			}
		}
	}

	if v := os.Getenv("WORKER_ID"); v != "" {
		cfg.Worker.ID = v
	}
	if v := os.Getenv("WORKER_TRANSPORT"); v != "" {
		cfg.Worker.Transport = strings.ToLower(strings.TrimSpace(v))
	}
	if v := os.Getenv("SUPPORTED_MODELS"); v != "" {
		parts := strings.Split(v, ",")
		var cleaned []string
		for _, p := range parts {
			if trimmed := strings.TrimSpace(p); trimmed != "" {
				cleaned = append(cleaned, trimmed)
			}
		}
		if len(cleaned) > 0 {
			cfg.Worker.SupportedModels = cleaned
		}
	}
	if v := os.Getenv("LLM_PROVIDER"); v != "" {
		cfg.LLM.Provider = v
	}
	if v := os.Getenv("LLM_BASE_URL"); v != "" {
		cfg.LLM.BaseURL = v
	}
	if v := os.Getenv("REDIS_ADDR"); v != "" {
		cfg.Redis.Addr = v
	}
	if v := os.Getenv("REDIS_PASSWORD"); v != "" {
		cfg.Redis.Password = v
	}
	if v := os.Getenv("CONSUMER_GROUP"); v != "" {
		cfg.Redis.ConsumerGroup = v
	}

	return cfg, nil
}
