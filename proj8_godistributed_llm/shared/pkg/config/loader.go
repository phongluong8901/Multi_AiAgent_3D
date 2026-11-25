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
		MaxQueueDepth     int    `yaml:"max_queue_depth"`
		GRPCTLSCert       string `yaml:"grpc_tls_cert"`
		GRPCTLSKey        string `yaml:"grpc_tls_key"`
	} `yaml:"server"`
	Redis struct {
		Addr       string `yaml:"addr"`
		MasterName string `yaml:"master_name"`
		Password   string `yaml:"password"`
		DB         int    `yaml:"db"`
	} `yaml:"redis"`
	Postgres struct {
		Driver string `yaml:"driver"`
		DSN    string `yaml:"dsn"`
	} `yaml:"postgres"`
	Auth struct {
		APIKey        string `yaml:"api_key"`
		InternalToken string `yaml:"internal_token"`
		RateLimitRPM  int    `yaml:"rate_limit_rpm"`
	} `yaml:"auth"`
}

// WorkerConfig chứa toàn bộ cấu hình cho mỗi máy Worker Node.
type WorkerConfig struct {
	Worker struct {
		ID                   string   `yaml:"id"`
		UIAddr               string   `yaml:"ui_addr"`
		Transport            string   `yaml:"transport"` // "grpc" hoặc "http"
		InternalToken        string   `yaml:"internal_token"`
		GRPCTLSCA            string   `yaml:"grpc_tls_ca"`
		MaxParallelJobs      int      `yaml:"max_parallel_jobs"`
		SupportedModels      []string `yaml:"supported_models"`
		HeartbeatIntervalSec int      `yaml:"heartbeat_interval_sec"`
		MaxJobDurationSec    int      `yaml:"max_job_duration_sec"`
		ShutdownGraceSec     int      `yaml:"shutdown_grace_sec"`
		BatchFlushMs         int      `yaml:"batch_flush_ms"`
		DynamicModelSync     bool     `yaml:"dynamic_model_sync"`
	} `yaml:"worker"`
	LLM struct {
		Provider   string `yaml:"provider"` // "ollama", "llamacpp", hoặc "vllm"
		BaseURL    string `yaml:"base_url"`
		TimeoutSec int    `yaml:"timeout_sec"`
	} `yaml:"llm"`
	Redis struct {
		Addr          string `yaml:"addr"`
		MasterName    string `yaml:"master_name"`
		Password      string `yaml:"password"`
		DB            int    `yaml:"db"`
		ConsumerGroup string `yaml:"consumer_group"`
	} `yaml:"redis"`
}

// LoadGatewayConfig nạp cấu hình Gateway theo thứ tự ưu tiên:
// giá trị mặc định an toàn -> đọc file YAML (nếu có) -> ghi đè từ biến môi trường (ENV).
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
	if v := os.Getenv("MAX_QUEUE_DEPTH"); v != "" {
		if d, err := strconv.Atoi(v); err == nil {
			cfg.Server.MaxQueueDepth = d
		}
	}
	if v := os.Getenv("GRPC_TLS_CERT"); v != "" {
		cfg.Server.GRPCTLSCert = v
	}
	if v := os.Getenv("GRPC_TLS_KEY"); v != "" {
		cfg.Server.GRPCTLSKey = v
	}
	if v := os.Getenv("REDIS_ADDR"); v != "" {
		cfg.Redis.Addr = v
	}
	if v := os.Getenv("REDIS_MASTER_NAME"); v != "" {
		cfg.Redis.MasterName = v
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
	if v := os.Getenv("INTERNAL_TOKEN"); v != "" {
		cfg.Auth.InternalToken = v
	}
	if v := os.Getenv("RATE_LIMIT_RPM"); v != "" {
		if rpm, err := strconv.Atoi(v); err == nil {
			cfg.Auth.RateLimitRPM = rpm
		}
	}

	return cfg, nil
}

// LoadWorkerConfig nạp cấu hình Worker theo thứ tự ưu tiên:
// giá trị mặc định -> đọc file YAML (nếu có) -> ghi đè từ biến môi trường (ENV).
func LoadWorkerConfig(path string) (*WorkerConfig, error) {
	cfg := &WorkerConfig{}
	cfg.Worker.ID = "worker-node-01"
	cfg.Worker.UIAddr = ":9091"
	cfg.Worker.Transport = "grpc"
	cfg.Worker.MaxParallelJobs = 2
	cfg.Worker.SupportedModels = []string{"qwen2.5:1.5b", "qwen2.5:7b", "llama3.2:3b"}
	cfg.Worker.HeartbeatIntervalSec = 5
	cfg.Worker.MaxJobDurationSec = 300
	cfg.Worker.ShutdownGraceSec = 15
	cfg.Worker.BatchFlushMs = 20
	cfg.Worker.DynamicModelSync = true
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
	if v := os.Getenv("WORKER_UI_ADDR"); v != "" {
		cfg.Worker.UIAddr = v
	}
	if v := os.Getenv("WORKER_TRANSPORT"); v != "" {
		cfg.Worker.Transport = strings.ToLower(strings.TrimSpace(v))
	}
	if v := os.Getenv("INTERNAL_TOKEN"); v != "" {
		cfg.Worker.InternalToken = v
	}
	if v := os.Getenv("GRPC_TLS_CA"); v != "" {
		cfg.Worker.GRPCTLSCA = v
	}
	if v := os.Getenv("MAX_JOB_DURATION_SEC"); v != "" {
		if sec, err := strconv.Atoi(v); err == nil {
			cfg.Worker.MaxJobDurationSec = sec
		}
	}
	if v := os.Getenv("SHUTDOWN_GRACE_SEC"); v != "" {
		if sec, err := strconv.Atoi(v); err == nil {
			cfg.Worker.ShutdownGraceSec = sec
		}
	}
	if v := os.Getenv("BATCH_FLUSH_MS"); v != "" {
		if ms, err := strconv.Atoi(v); err == nil {
			cfg.Worker.BatchFlushMs = ms
		}
	}
	if v := os.Getenv("DYNAMIC_MODEL_SYNC"); v != "" {
		if b, err := strconv.ParseBool(v); err == nil {
			cfg.Worker.DynamicModelSync = b
		}
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
	if v := os.Getenv("REDIS_MASTER_NAME"); v != "" {
		cfg.Redis.MasterName = v
	}
	if v := os.Getenv("REDIS_PASSWORD"); v != "" {
		cfg.Redis.Password = v
	}
	if v := os.Getenv("CONSUMER_GROUP"); v != "" {
		cfg.Redis.ConsumerGroup = v
	}

	return cfg, nil
}

