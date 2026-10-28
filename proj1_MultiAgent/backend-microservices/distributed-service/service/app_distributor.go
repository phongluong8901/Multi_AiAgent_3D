package service

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"distributed-service/config"
	"distributed-service/models"
)

type AppDistributor struct {
	cfg *config.Config
}

func NewAppDistributor(cfg *config.Config) *AppDistributor {
	return &AppDistributor{
		cfg: cfg,
	}
}

// GetPackageInfo trả về thông tin chi tiết gói phần mềm Desktop Client
func (d *AppDistributor) GetPackageInfo() models.AppPackageInfo {
	fileSizeMB := 109.6
	if filePath, err := d.GetAppFilePath(); err == nil {
		if fi, err := os.Stat(filePath); err == nil {
			fileSizeMB = float64(fi.Size()) / (1024 * 1024)
			fileSizeMB = float64(int(fileSizeMB*10)) / 10
		}
	}

	return models.AppPackageInfo{
		AppName:        "Multi-Agent AI Partner Desktop Client (Electron + React)",
		Version:        "1.0.0",
		ReleaseDate:    time.Now().Add(-24 * time.Hour),
		Platform:       "windows",
		Arch:           "x64",
		FileSizeMB:     fileSizeMB,
		DownloadURL:    "/api/v1/distributed/app/download",
		FallbackZipURL: "/api/v1/distributed/app/download?type=portable",
		Components: []string{
			"React Postman-Style Frameless Dashboard UI",
			"Python Hardware Telemetry Daemon (worker.py / worker.exe)",
			"Electron Native Windows Runner & Auto-Lifecycle",
			"Real-time CPU/RAM/GPU/Location Reporter",
		},
		MinOSVersion: "Windows 10 / 11 64-bit or Ubuntu 20.04+",
		InstallationDoc: `1. Tải về file cài đặt "Go-Python Worker Monitor Setup 1.0.0.exe" hoặc "worker.exe".
2. Chạy ứng dụng, giao diện React Desktop sẽ tự động mở và chạy ngầm Python daemon.
3. Tải file "worker-config.json" chứa Token của bạn và đặt cùng thư mục để tự động kết nối vào cụm phân tán.
4. Bắt đầu nhận tác vụ mô hình AI và tích lũy SaveCoin theo thời gian thực!`,
	}
}

// GetAppFilePath trả về đường dẫn vật lý thực tế của file cài đặt
func (d *AppDistributor) GetAppFilePath() (string, error) {
	candidates := []string{
		d.cfg.ClientAppPath,
		"/app/release/Go-Python Worker Monitor Setup 1.0.0.exe",
		filepath.Join("..", "worker-client", "release", "Go-Python Worker Monitor Setup 1.0.0.exe"),
		filepath.Join("worker-client", "release", "Go-Python Worker Monitor Setup 1.0.0.exe"),
		`d:\A_Self_Proj\learn_mlflow\proj1_MultiAgent\backend-microservices\worker-client\release\Go-Python Worker Monitor Setup 1.0.0.exe`,
		"/app/release/worker.exe",
		filepath.Join("..", "worker-client", "release", "worker.exe"),
		filepath.Join("worker-client", "release", "worker.exe"),
		`d:\A_Self_Proj\learn_mlflow\proj1_MultiAgent\backend-microservices\worker-client\release\worker.exe`,
	}

	for _, p := range candidates {
		if fi, err := os.Stat(p); err == nil && !fi.IsDir() {
			return p, nil
		}
	}

	return "", fmt.Errorf("file client app chưa được build sẵn tại thư mục release")
}

// GenerateNodeConfigFile tạo file JSON cấu hình riêng biệt cho người dùng
func (d *AppDistributor) GenerateNodeConfigFile(node *models.PartnerNode) ([]byte, error) {
	clientCfg := models.ClientRunConfig{
		NodeID:          node.ID,
		AuthToken:       node.AuthToken,
		ServerWSURL:     d.cfg.GatewayWSURL,
		LocalServerPort: 8080,
		AutoConnect:     true,
		TargetModels:    node.CompatibleModels,
		AllocatedCores:  node.RentConfig.AllocatedCores,
		AllocatedRAMGB:  node.RentConfig.AllocatedRAMGB,
		EnableGPU:       node.RentConfig.EnableGPU,
	}

	return json.MarshalIndent(clientCfg, "", "  ")
}
