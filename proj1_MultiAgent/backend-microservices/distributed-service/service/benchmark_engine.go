package service

import (
	"fmt"
	"math"
	"strings"

	"distributed-service/models"
)

type BenchmarkEngine struct {
	catalog []models.ModelSpec
}

func NewBenchmarkEngine() *BenchmarkEngine {
	return &BenchmarkEngine{
		catalog: models.GetCatalogModels(),
	}
}

// GetCatalog trả về toàn bộ danh mục mô hình
func (b *BenchmarkEngine) GetCatalog() []models.ModelSpec {
	return b.catalog
}

// GetModelByID tìm kiếm mô hình theo ID
func (b *BenchmarkEngine) GetModelByID(id string) (*models.ModelSpec, bool) {
	for _, m := range b.catalog {
		if strings.EqualFold(m.ID, id) {
			return &m, true
		}
	}
	return nil, false
}

// EvaluateHardware kiểm tra RAM, CPU, GPU và đưa ra đề xuất cho người dùng
func (b *BenchmarkEngine) EvaluateHardware(hw models.HardwareReport) models.BenchmarkResult {
	var eligibleList []models.ModelRecommendation
	totalCoins := 0.0

	for _, spec := range b.catalog {
		rec := models.ModelRecommendation{
			ModelID:           spec.ID,
			ModelName:         spec.Name,
			Category:          spec.Category,
			Role:              spec.Role,
			HardwareTier:      spec.HardwareTier,
			TierLabel:         spec.TierLabel,
			CoinsPerHour:      spec.BaseCoinsPerHour,
			DownloadURL:       spec.DownloadURL,
			DownloadSizeGB:    spec.DownloadSizeGB,
			DownloadFormat:    spec.DownloadFormat,
			OllamaModel:       spec.OllamaModel,
			RunCommand:        spec.RunCommand,
			SetupInstructions: spec.SetupInstructions,
			SetupScriptURL:    fmt.Sprintf("/api/v1/distributed/models/setup-script?id=%s", spec.ID),
			ContextLength:     spec.ContextLength,
		}

		var missing []string

		// 1. Kiểm tra RAM
		if hw.DeviceMemoryGB < spec.MinRAMGB {
			diff := spec.MinRAMGB - hw.DeviceMemoryGB
			missing = append(missing, fmt.Sprintf("Thiếu %.1f GB RAM (Yêu cầu tối thiểu %.0f GB)", diff, spec.MinRAMGB))
		}

		// 2. Kiểm tra CPU Cores
		if hw.CPUCores < spec.MinCPUCores {
			missing = append(missing, fmt.Sprintf("Thiếu CPU Cores (Máy có %d cores, yêu cầu %d cores)", hw.CPUCores, spec.MinCPUCores))
		}

		// 3. Kiểm tra GPU nếu model bắt buộc
		if spec.RequiresGPU {
			if !hw.HasWebGPU && hw.GPUName == "" {
				missing = append(missing, "Model yêu cầu GPU rời (NVIDIA RTX / Apple Silicon / WebGPU)")
			} else if hw.VRAMGB > 0 && hw.VRAMGB < spec.MinVRAMGB {
				missing = append(missing, fmt.Sprintf("Thiếu VRAM GPU (Có %.1f GB, yêu cầu %.0f GB)", hw.VRAMGB, spec.MinVRAMGB))
			}
		}

		// 4. Tính toán Match Percent
		ramScore := math.Min(1.0, hw.DeviceMemoryGB/spec.MinRAMGB) * 40
		cpuScore := math.Min(1.0, float64(hw.CPUCores)/float64(spec.MinCPUCores)) * 30
		gpuScore := 0.0
		if spec.RequiresGPU {
			if hw.HasWebGPU || hw.GPUName != "" {
				gpuScore = 30.0
			}
		} else {
			gpuScore = 30.0 // Model không bắt buộc GPU nên tự động đạt
		}

		totalScore := int(ramScore + cpuScore + gpuScore)
		if totalScore > 100 {
			totalScore = 100
		}
		rec.MatchPercent = totalScore

		// Đủ điều kiện nếu không thiếu yêu cầu nào
		if len(missing) == 0 {
			rec.IsEligible = true

			// Tính token/s ước tính: phụ thuộc vào CPU cores + GPU boost
			speedMultiplier := 1.0
			if hw.CPUCores > spec.MinCPUCores {
				speedMultiplier += float64(hw.CPUCores-spec.MinCPUCores) * 0.08
			}
			if hw.HasWebGPU || hw.GPUName != "" {
				speedMultiplier *= 1.45
			}
			rec.EstimatedTokensPerS = math.Round(spec.BaseTokensPerSec*speedMultiplier*10) / 10

			// Thưởng thêm nếu cấu hình mạnh hơn mức chuẩn
			rec.CoinsPerHour = math.Round(spec.BaseCoinsPerHour*(1.0+(speedMultiplier-1.0)*0.5)*10) / 10
			if rec.CoinsPerHour > totalCoins {
				totalCoins = rec.CoinsPerHour
			}

			// Đề xuất mức phân bổ cho thuê tối ưu
			rec.RecommendedRentAlloc.Cores = int(math.Min(float64(hw.CPUCores), float64(spec.MinCPUCores+2)))
			rec.RecommendedRentAlloc.RAMGB = math.Min(hw.DeviceMemoryGB*0.8, spec.MinRAMGB+2)
			rec.RecommendedRentAlloc.GPU = spec.RequiresGPU || hw.HasWebGPU
		} else {
			rec.IsEligible = false
			rec.MissingRequirements = missing
			rec.EstimatedTokensPerS = 0
		}

		eligibleList = append(eligibleList, rec)
	}

	// Đánh giá Hạng phần cứng (Tier)
	tierName := "Tier 1: Edge & Office Node"
	tierScore := 35
	summaryAdvice := "Máy bạn tối ưu chạy các mô hình AI siêu nhẹ (Phi-3, Llama 3.2, Qwen Coder 1.5B) bằng CPU, không cần GPU rời."

	if hw.DeviceMemoryGB >= 64 || (hw.VRAMGB >= 24 && hw.CPUCores >= 16) {
		tierName = "Tier 4: Enterprise Compute Cluster"
		tierScore = 98
		summaryAdvice = "Cấu hình siêu cấp máy chủ! Bạn có thể gánh DeepSeek-R1 32B và Llama 3.3 70B, nhận tỷ lệ chia thưởng SaveCoin tối đa."
	} else if hw.DeviceMemoryGB >= 32 && (hw.HasWebGPU || strings.Contains(strings.ToLower(hw.GPUName), "rtx") || hw.VRAMGB >= 12) {
		tierName = "Tier 3: AI Studio Rig & High-End GPU"
		tierScore = 90
		summaryAdvice = "Cấu hình xuất sắc! Thiết bị của bạn đủ điều kiện chạy FLUX.1, SDXL Turbo và DeepSeek-R1 14B với hiệu năng xử lý cao."
	} else if hw.DeviceMemoryGB >= 16 && hw.CPUCores >= 6 {
		tierName = "Tier 2: High-Performance AI Workstation"
		tierScore = 75
		summaryAdvice = "Cấu hình rất tốt! Bạn đủ điều kiện chạy DeepSeek-R1 (7B), Qwen 2.5 Coder (7B) và Llama 3.3 (8B) với hiệu suất ổn định."
	} else if hw.DeviceMemoryGB >= 8 {
		tierName = "Tier 1+: Standard Compute Node"
		tierScore = 55
		summaryAdvice = "Máy đạt chuẩn chạy các mô hình Edge AI, nhận diện âm thanh Whisper và xử lý trí nhớ Agent Vector."
	}

	return models.BenchmarkResult{
		Hardware:          hw,
		EligibleModels:    eligibleList,
		TierName:          tierName,
		TierScore:         tierScore,
		EstimatedMaxCoins: totalCoins,
		SummaryAdvice:     summaryAdvice,
	}
}

// GenerateSetupScript tạo file kịch bản cài đặt tự động (.bat hoặc .sh) cho người dùng
func (b *BenchmarkEngine) GenerateSetupScript(modelID string, osType string) (string, string, error) {
	spec, found := b.GetModelByID(modelID)
	if !found {
		return "", "", fmt.Errorf("không tìm thấy mô hình với ID: %s", modelID)
	}

	isWindows := strings.ToLower(osType) != "linux" && strings.ToLower(osType) != "darwin" && strings.ToLower(osType) != "macos"

	if isWindows {
		filename := fmt.Sprintf("setup_%s.bat", spec.ID)
		script := fmt.Sprintf(`@echo off
chcp 65001 >nul
echo ==============================================================
echo 🚀 Multi-Agent AI Model Installer - %s
echo    Dung lượng tải: %.1f GB | Định dạng: %s
echo    Phân khúc: %s
echo ==============================================================
echo.

if not exist models mkdir models

where ollama >nul 2>nul
if %%ERRORLEVEL%% equ 0 (
    echo [1/2] Phát hiện Ollama đã cài đặt trên hệ thống!
    echo [2/2] Đang tải mô hình qua Ollama (%s)...
    ollama pull %s
    echo.
    echo ✅ Đã cài đặt hoàn tất!
    echo Bạn có thể khởi động mô hình bất cứ lúc nào bằng lệnh:
    echo    ollama run %s
) else (
    echo [1/2] Chưa có Ollama, tiến hành tải file trọng số trực tiếp (%s)...
    echo Đang tải từ HuggingFace CDN: %s
    curl -L -o "models\%s.%s" "%s" --progress-bar
    echo.
    echo ✅ Đã lưu file mô hình tại: %%~dp0models\%s.%s
    echo Bạn có thể nạp file này trực tiếp vào Desktop Client hoặc llama.cpp.
)

echo.
pause
`, spec.Name, spec.DownloadSizeGB, spec.DownloadFormat, spec.TierLabel,
			spec.OllamaModel, spec.OllamaModel, spec.OllamaModel,
			spec.DownloadFormat, spec.DownloadURL,
			spec.ID, "gguf", spec.DownloadURL,
			spec.ID, "gguf",
		)
		return filename, script, nil
	}

	// Linux / macOS Shell script
	filename := fmt.Sprintf("setup_%s.sh", spec.ID)
	script := fmt.Sprintf(`#!/usr/bin/env bash
set -e
echo "=============================================================="
echo "🚀 Multi-Agent AI Model Installer - %s"
echo "   Dung lượng tải: %.1f GB | Định dạng: %s"
echo "   Phân khúc: %s"
echo "=============================================================="

mkdir -p models

if command -v ollama &> /dev/null; then
    echo "[1/2] Phát hiện Ollama trên hệ thống!"
    echo "[2/2] Đang tải mô hình %s..."
    ollama pull %s
    echo "✅ Hoàn tất! Chạy bằng lệnh: ollama run %s"
else
    echo "[1/2] Đang tải file trọng số GGUF trực tiếp..."
    curl -L -o "models/%s.gguf" "%s" --progress-bar
    echo "✅ Đã lưu file tại models/%s.gguf"
fi
`, spec.Name, spec.DownloadSizeGB, spec.DownloadFormat, spec.TierLabel,
		spec.OllamaModel, spec.OllamaModel, spec.OllamaModel,
		spec.ID, spec.DownloadURL, spec.ID,
	)
	return filename, script, nil
}
