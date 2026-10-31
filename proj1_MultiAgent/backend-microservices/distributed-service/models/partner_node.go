package models

import "time"

// HardwareReport chứa thông số quét phần cứng của Client hoặc Trình duyệt
type HardwareReport struct {
	CPUCores       int     `json:"cpuCores"`
	DeviceMemoryGB float64 `json:"deviceMemoryGB"`
	HasWebGPU      bool    `json:"hasWebGPU"`
	GPUName        string  `json:"gpuName,omitempty"`
	VRAMGB         float64 `json:"vramGB,omitempty"`
	OS             string  `json:"os,omitempty"`
	Arch           string  `json:"arch,omitempty"`
	DiskFreeGB     float64 `json:"diskFreeGB,omitempty"`
}

// RentConfiguration cấu hình người dùng cam kết cho thuê
type RentConfiguration struct {
	AllocatedCores       int     `json:"allocatedCores"`       // Số core CPU chia sẻ
	AllocatedRAMGB       float64 `json:"allocatedRAMGB"`       // Số GB RAM chia sẻ
	EnableGPU            bool    `json:"enableGPU"`            // Cho phép sử dụng GPU
	GPUSharePercent      int     `json:"gpuSharePercent"`      // 10% - 100%
	AvailabilitySchedule string  `json:"availabilitySchedule"` // "24/7", "idle_hours", "custom"
	MinPricePerHourCoin  float64 `json:"minPricePerHourCoin"`  // Giá mong muốn (SaveCoins/giờ)
	AutoStartWithOS      bool    `json:"autoStartWithOS"`      // Khởi động cùng hệ điều hành
	MaxTokens            int     `json:"maxTokens,omitempty"`        // Hạn mức token tối đa mỗi request
	ContextLength        int     `json:"contextLength,omitempty"`    // Độ dài ngữ cảnh (2048, 4096, 8192)
	Temperature          float64 `json:"temperature,omitempty"`      // Nhiệt độ sinh (0.1 - 1.0)
	DefaultModel         string  `json:"defaultModel,omitempty"`     // Model phục vụ chính
	MaxConcurrentTasks   int     `json:"maxConcurrentTasks,omitempty"` // Số task song song
}

// LLMActivityStats thống kê số lượng token và lượt xử lý LLM thời gian thực
type LLMActivityStats struct {
	TotalRequests    int64   `json:"totalRequests"`
	ActiveRequests   int     `json:"activeRequests"`
	TotalTokens      int64   `json:"totalTokens"`
	PromptTokens     int64   `json:"promptTokens"`
	CompletionTokens int64   `json:"completionTokens"`
	TokensPerSec     float64 `json:"tokensPerSec"`
	LastLatencyMs    int64   `json:"lastLatencyMs"`
	CurrentModel     string  `json:"currentModel"`
	IsBusy           bool    `json:"isBusy"`
	Status           string  `json:"status"` // "IDLE", "INFERENCING", "OFFLINE"
}

// TelemetryStats dữ liệu tải động truyền từ Python Worker / Electron Client qua WebSocket
type TelemetryStats struct {
	NodeName        string            `json:"nodeName,omitempty"`
	CPUPercent      float64           `json:"cpu_percent"`
	RAMPercent      float64           `json:"ram_percent"`
	DiskPercent     float64           `json:"disk_percent"`
	GPUPercent      float64           `json:"gpu_percent,omitempty"`
	GPUTemperature  float64           `json:"gpu_temp,omitempty"`
	HasGPU          bool              `json:"has_gpu,omitempty"`
	GPUName         string            `json:"gpu_name,omitempty"`
	VRAMGB          float64           `json:"vram_gb,omitempty"`
	IsLLMRunning    bool              `json:"is_llm_running,omitempty"`
	LLMProvider     string            `json:"llm_provider,omitempty"`
	InstalledModels []string          `json:"installed_models,omitempty"`
	LLMStats        *LLMActivityStats `json:"llm_stats,omitempty"`
	Timestamp       time.Time         `json:"timestamp"`
}

// PartnerNode đại diện cho 1 máy tính đối tác gia nhập mạng lưới tính toán
type PartnerNode struct {
	ID                  string            `json:"id"`
	UserID              string            `json:"userId"`
	Username            string            `json:"username"`
	NodeName            string            `json:"nodeName,omitempty"`
	Email               string            `json:"email"`
	Status              string            `json:"status"` // "IDLE", "BUSY", "OFFLINE", "REGISTERED"
	Hardware            HardwareReport    `json:"hardware"`
	RentConfig          RentConfiguration `json:"rentConfig"`
	CompatibleModels    []string          `json:"compatibleModels"`
	ActiveModel         string            `json:"activeModel,omitempty"`
	IsLLMRunning        bool              `json:"isLLMRunning"`
	LLMProvider         string            `json:"llmProvider,omitempty"`
	HasGPU              bool              `json:"hasGPU"`
	GPUName             string            `json:"gpuName,omitempty"`
	VRAMGB              float64           `json:"vramGB,omitempty"`
	TotalCoinsEarned    float64           `json:"totalCoinsEarned"`
	UptimeSeconds       int64             `json:"uptimeSeconds"`
	LastTelemetry       *TelemetryStats   `json:"lastTelemetry,omitempty"`
	LLMStats            *LLMActivityStats `json:"llmStats,omitempty"`
	AuthToken           string            `json:"authToken"`
	ClientAppDownloaded bool              `json:"clientAppDownloaded"`
	CreatedAt           time.Time         `json:"createdAt"`
	UpdatedAt           time.Time         `json:"updatedAt"`
}

// BenchmarkResult kết quả đánh giá phần cứng và đề xuất mô hình phù hợp
type BenchmarkResult struct {
	Hardware          HardwareReport        `json:"hardware"`
	EligibleModels    []ModelRecommendation `json:"eligibleModels"`
	TierName          string                `json:"tierName"`
	TierScore         int                   `json:"tierScore"` // 0 - 100
	EstimatedMaxCoins float64               `json:"estimatedMaxCoinsPerHour"`
	SummaryAdvice     string                `json:"summaryAdvice"`
}

// ModelRecommendation thông tin chi tiết từng model đối với cấu hình máy
type ModelRecommendation struct {
	ModelID              string   `json:"modelId"`
	ModelName            string   `json:"modelName"`
	Category             string   `json:"category"`
	Role                 string   `json:"role"`
	HardwareTier         string   `json:"hardwareTier"`
	TierLabel            string   `json:"tierLabel"`
	IsEligible           bool     `json:"isEligible"`
	MatchPercent         int      `json:"matchPercent"`
	EstimatedTokensPerS  float64  `json:"estimatedTokensPerS"`
	CoinsPerHour         float64  `json:"coinsPerHour"`
	DownloadURL          string   `json:"downloadUrl"`
	DownloadSizeGB       float64  `json:"downloadSizeGB"`
	DownloadFormat       string   `json:"downloadFormat"`
	OllamaModel          string   `json:"ollamaModel"`
	RunCommand           string   `json:"runCommand"`
	SetupInstructions    string   `json:"setupInstructions"`
	SetupScriptURL       string   `json:"setupScriptUrl"`
	ContextLength        int      `json:"contextLength"`
	MissingRequirements []string `json:"missingRequirements,omitempty"`
	RecommendedRentAlloc struct {
		Cores int     `json:"cores"`
		RAMGB float64 `json:"ramGB"`
		GPU   bool    `json:"gpu"`
	} `json:"recommendedRentAlloc"`
}
