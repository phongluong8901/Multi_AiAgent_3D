package models

import "time"

// AppPackageInfo thông tin chi tiết gói cài đặt Client App (Python + React + Electron)
type AppPackageInfo struct {
	AppName         string    `json:"appName"`
	Version         string    `json:"version"`
	ReleaseDate     time.Time `json:"releaseDate"`
	Platform        string    `json:"platform"` // "windows", "linux", "darwin"
	Arch            string    `json:"arch"`     // "x64", "arm64"
	FileSizeMB      float64   `json:"fileSizeMB"`
	DownloadURL     string    `json:"downloadUrl"`
	FallbackZipURL  string    `json:"fallbackZipUrl"`
	Components      []string  `json:"components"` // ["Python Hardware Worker", "Go WebSocket Core", "React Dashboard UI", "Electron Frameless Host"]
	SHA256          string    `json:"sha256,omitempty"`
	MinOSVersion    string    `json:"minOSVersion"`
	InstallationDoc string    `json:"installationDoc"`
}

// ClientRunConfig cấu hình node được tạo riêng cho người dùng đưa vào app electron
type ClientRunConfig struct {
	NodeID          string   `json:"nodeId"`
	AuthToken       string   `json:"authToken"`
	ServerWSURL     string   `json:"serverWsUrl"`
	LocalServerPort int      `json:"localServerPort"`
	AutoConnect     bool     `json:"autoConnect"`
	TargetModels    []string `json:"targetModels"`
	AllocatedCores  int      `json:"allocatedCores"`
	AllocatedRAMGB  float64  `json:"allocatedRAMGB"`
	EnableGPU       bool     `json:"enableGPU"`
}
