package storage

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/url"
	"time"

	"distributed-service/models"

	_ "github.com/lib/pq"
)

type PostgresStorage struct {
	db *sql.DB
}

// cleanPostgresURL chuẩn hóa URL cho thư viện lib/pq, loại bỏ các tham số không tương thích như channel_binding
func cleanPostgresURL(rawURL string) string {
	u, err := url.Parse(rawURL)
	if err != nil {
		return rawURL
	}
	q := u.Query()
	q.Del("channel_binding")
	if q.Get("sslmode") == "" {
		q.Set("sslmode", "require")
	}
	u.RawQuery = q.Encode()
	return u.String()
}

// NewPostgresStorage khởi tạo kết nối PostgreSQL (Neon DB) và tự động tạo bảng nếu chưa có
func NewPostgresStorage(dbURL string) (*PostgresStorage, error) {
	if dbURL == "" {
		return nil, fmt.Errorf("DATABASE_URL is empty")
	}

	cleanedURL := cleanPostgresURL(dbURL)
	db, err := sql.Open("postgres", cleanedURL)
	if err != nil {
		return nil, fmt.Errorf("lỗi kết nối postgres: %w", err)
	}

	// Cấu hình Connection Pool cho PostgreSQL / Neon Pooler
	db.SetMaxOpenConns(20)
	db.SetMaxIdleConns(5)
	db.SetConnMaxLifetime(15 * time.Minute)

	// Thử Ping kiểm tra kết nối với timeout
	if err := db.Ping(); err != nil {
		db.Close()
		return nil, fmt.Errorf("ping postgres (Neon DB) thất bại: %w", err)
	}

	ps := &PostgresStorage{db: db}
	if err := ps.initSchema(); err != nil {
		log.Printf("[POSTGRES WARNING] Khởi tạo schema thất bại: %v\n", err)
	}

	log.Println("[POSTGRES] Kết nối Neon PostgreSQL thành công và Schema đã sẵn sàng.")
	return ps, nil
}

// initSchema tự động khởi tạo bảng lưu trữ partner nodes
func (ps *PostgresStorage) initSchema() error {
	query := `
	CREATE TABLE IF NOT EXISTS partner_nodes (
		id VARCHAR(100) PRIMARY KEY,
		user_id VARCHAR(100) NOT NULL,
		username VARCHAR(255),
		email VARCHAR(255),
		status VARCHAR(50) DEFAULT 'IDLE',
		hardware JSONB,
		rent_config JSONB,
		compatible_models JSONB,
		active_model VARCHAR(100),
		is_llm_running BOOLEAN DEFAULT FALSE,
		llm_provider VARCHAR(100) DEFAULT 'ollama',
		has_gpu BOOLEAN DEFAULT FALSE,
		gpu_name VARCHAR(255) DEFAULT '',
		vram_gb DOUBLE PRECISION DEFAULT 0,
		total_coins_earned DOUBLE PRECISION DEFAULT 0,
		uptime_seconds BIGINT DEFAULT 0,
		auth_token VARCHAR(255) UNIQUE,
		client_app_downloaded BOOLEAN DEFAULT FALSE,
		last_telemetry JSONB,
		created_at TIMESTAMPTZ DEFAULT NOW(),
		updated_at TIMESTAMPTZ DEFAULT NOW()
	);

	ALTER TABLE partner_nodes ADD COLUMN IF NOT EXISTS is_llm_running BOOLEAN DEFAULT FALSE;
	ALTER TABLE partner_nodes ADD COLUMN IF NOT EXISTS llm_provider VARCHAR(100) DEFAULT 'ollama';
	ALTER TABLE partner_nodes ADD COLUMN IF NOT EXISTS has_gpu BOOLEAN DEFAULT FALSE;
	ALTER TABLE partner_nodes ADD COLUMN IF NOT EXISTS gpu_name VARCHAR(255) DEFAULT '';
	ALTER TABLE partner_nodes ADD COLUMN IF NOT EXISTS vram_gb DOUBLE PRECISION DEFAULT 0;

	CREATE INDEX IF NOT EXISTS idx_partner_nodes_user_id ON partner_nodes(user_id);
	CREATE INDEX IF NOT EXISTS idx_partner_nodes_auth_token ON partner_nodes(auth_token);
	`
	_, err := ps.db.Exec(query)
	return err
}

// UpsertNode lưu mới hoặc cập nhật thông tin Node vào cơ sở dữ liệu Neon
func (ps *PostgresStorage) UpsertNode(node *models.PartnerNode) error {
	hwJSON, _ := json.Marshal(node.Hardware)
	rentJSON, _ := json.Marshal(node.RentConfig)
	modelsJSON, _ := json.Marshal(node.CompatibleModels)

	var telemetryJSON []byte
	if node.LastTelemetry != nil {
		telemetryJSON, _ = json.Marshal(node.LastTelemetry)
	}

	createdAt := node.CreatedAt
	if createdAt.IsZero() {
		createdAt = time.Now()
	}
	updatedAt := time.Now()

	query := `
	INSERT INTO partner_nodes (
		id, user_id, username, email, status,
		hardware, rent_config, compatible_models, active_model,
		is_llm_running, llm_provider, has_gpu, gpu_name, vram_gb,
		total_coins_earned, uptime_seconds, auth_token,
		client_app_downloaded, last_telemetry, created_at, updated_at
	) VALUES (
		$1, $2, $3, $4, $5,
		$6, $7, $8, $9,
		$10, $11, $12, $13, $14,
		$15, $16, $17,
		$18, $19, $20, $21
	) ON CONFLICT (id) DO UPDATE SET
		username = EXCLUDED.username,
		email = EXCLUDED.email,
		status = EXCLUDED.status,
		hardware = EXCLUDED.hardware,
		rent_config = EXCLUDED.rent_config,
		compatible_models = EXCLUDED.compatible_models,
		active_model = EXCLUDED.active_model,
		is_llm_running = EXCLUDED.is_llm_running,
		llm_provider = EXCLUDED.llm_provider,
		has_gpu = EXCLUDED.has_gpu,
		gpu_name = EXCLUDED.gpu_name,
		vram_gb = EXCLUDED.vram_gb,
		auth_token = EXCLUDED.auth_token,
		client_app_downloaded = EXCLUDED.client_app_downloaded,
		last_telemetry = COALESCE(EXCLUDED.last_telemetry, partner_nodes.last_telemetry),
		updated_at = EXCLUDED.updated_at;
	`

	var telemVal interface{}
	if len(telemetryJSON) > 0 {
		telemVal = string(telemetryJSON)
	}

	_, err := ps.db.Exec(
		query,
		node.ID, node.UserID, node.Username, node.Email, node.Status,
		string(hwJSON), string(rentJSON), string(modelsJSON), node.ActiveModel,
		node.IsLLMRunning, node.LLMProvider, node.HasGPU, node.GPUName, node.VRAMGB,
		node.TotalCoinsEarned, node.UptimeSeconds, node.AuthToken,
		node.ClientAppDownloaded, telemVal, createdAt, updatedAt,
	)
	return err
}

// GetAllNodes nạp danh sách tất cả các node từ Neon DB
func (ps *PostgresStorage) GetAllNodes() ([]*models.PartnerNode, error) {
	query := `
	SELECT id, user_id, username, email, status,
	       hardware, rent_config, compatible_models, active_model,
	       is_llm_running, llm_provider, has_gpu, gpu_name, vram_gb,
	       total_coins_earned, uptime_seconds, auth_token,
	       client_app_downloaded, last_telemetry, created_at, updated_at
	FROM partner_nodes
	ORDER BY updated_at DESC;
	`
	rows, err := ps.db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var nodes []*models.PartnerNode
	for rows.Next() {
		var n models.PartnerNode
		var hwJSON, rentJSON, modelsJSON []byte
		var telemJSON sql.NullString

		err := rows.Scan(
			&n.ID, &n.UserID, &n.Username, &n.Email, &n.Status,
			&hwJSON, &rentJSON, &modelsJSON, &n.ActiveModel,
			&n.IsLLMRunning, &n.LLMProvider, &n.HasGPU, &n.GPUName, &n.VRAMGB,
			&n.TotalCoinsEarned, &n.UptimeSeconds, &n.AuthToken,
			&n.ClientAppDownloaded, &telemJSON, &n.CreatedAt, &n.UpdatedAt,
		)
		if err != nil {
			log.Printf("[POSTGRES] Lỗi scan row: %v\n", err)
			continue
		}

		if len(hwJSON) > 0 {
			_ = json.Unmarshal(hwJSON, &n.Hardware)
		}
		if len(rentJSON) > 0 {
			_ = json.Unmarshal(rentJSON, &n.RentConfig)
		}
		if len(modelsJSON) > 0 {
			_ = json.Unmarshal(modelsJSON, &n.CompatibleModels)
		}
		if telemJSON.Valid && len(telemJSON.String) > 0 {
			var telem models.TelemetryStats
			if err := json.Unmarshal([]byte(telemJSON.String), &telem); err == nil {
				n.LastTelemetry = &telem
			}
		}

		nodes = append(nodes, &n)
	}

	return nodes, nil
}

// UpdateTelemetry cập nhật telemetry tải máy và tích lũy coin trên PostgreSQL
func (ps *PostgresStorage) UpdateTelemetry(nodeID string, stats models.TelemetryStats) error {
	telemJSON, err := json.Marshal(stats)
	if err != nil {
		return err
	}

	query := `
	UPDATE partner_nodes SET
		last_telemetry = $2,
		status = CASE WHEN status = 'OFFLINE' OR status = 'REGISTERED' THEN 'IDLE' ELSE status END,
		is_llm_running = CASE WHEN $3 = TRUE THEN TRUE ELSE is_llm_running END,
		has_gpu = CASE WHEN $4 = TRUE THEN TRUE ELSE has_gpu END,
		gpu_name = CASE WHEN $5 != '' THEN $5 ELSE gpu_name END,
		vram_gb = CASE WHEN $6 > 0 THEN $6 ELSE vram_gb END,
		total_coins_earned = total_coins_earned + 0.02,
		uptime_seconds = uptime_seconds + 10,
		updated_at = NOW()
	WHERE id = $1;
	`
	_, err = ps.db.Exec(query, nodeID, string(telemJSON), stats.IsLLMRunning, stats.HasGPU, stats.GPUName, stats.VRAMGB)
	return err
}

// UpdateStatus cập nhật trạng thái online/offline của Node
func (ps *PostgresStorage) UpdateStatus(nodeID string, status string) error {
	query := `UPDATE partner_nodes SET status = $2, updated_at = NOW() WHERE id = $1;`
	_, err := ps.db.Exec(query, nodeID, status)
	return err
}

// Close đóng kết nối cơ sở dữ liệu
func (ps *PostgresStorage) Close() error {
	if ps.db != nil {
		return ps.db.Close()
	}
	return nil
}
