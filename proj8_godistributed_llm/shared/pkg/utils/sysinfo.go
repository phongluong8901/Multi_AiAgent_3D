package utils

import (
	"context"
	"os/exec"
	"strconv"
	"strings"
	"time"

	"github.com/shirou/gopsutil/v4/cpu"
	"github.com/shirou/gopsutil/v4/mem"
)

// HostMetrics chứa thông số tài nguyên thực tế tại máy chạy Worker.
type HostMetrics struct {
	CPUPercent     float64
	RAMPercent     float64
	GPUVRAMPercent float64
}

// CollectHostMetrics đo % CPU, % RAM và % VRAM GPU (nếu có NVIDIA GPU) hiện tại của node.
func CollectHostMetrics() HostMetrics {
	var metrics HostMetrics

	if cpuPercents, err := cpu.Percent(200*time.Millisecond, false); err == nil && len(cpuPercents) > 0 {
		metrics.CPUPercent = cpuPercents[0]
	}

	if vmStat, err := mem.VirtualMemory(); err == nil {
		metrics.RAMPercent = vmStat.UsedPercent
	}

	metrics.GPUVRAMPercent = collectNvidiaVRAMPercent()
	return metrics
}

func collectNvidiaVRAMPercent() float64 {
	ctx, cancel := context.WithTimeout(context.Background(), 500*time.Millisecond)
	defer cancel()

	cmd := exec.CommandContext(ctx, "nvidia-smi", "--query-gpu=memory.used,memory.total", "--format=csv,noheader,nounits")
	out, err := cmd.Output()
	if err != nil {
		return 0
	}

	var totalUsed, totalCap float64
	for _, line := range strings.Split(strings.TrimSpace(string(out)), "\n") {
		parts := strings.Split(line, ",")
		if len(parts) != 2 {
			continue
		}
		used, err1 := strconv.ParseFloat(strings.TrimSpace(parts[0]), 64)
		capMB, err2 := strconv.ParseFloat(strings.TrimSpace(parts[1]), 64)
		if err1 == nil && err2 == nil && capMB > 0 {
			totalUsed += used
			totalCap += capMB
		}
	}

	if totalCap <= 0 {
		return 0
	}
	return (totalUsed / totalCap) * 100.0
}

