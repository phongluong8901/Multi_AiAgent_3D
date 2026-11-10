package utils

import (
	"time"

	"github.com/shirou/gopsutil/v4/cpu"
	"github.com/shirou/gopsutil/v4/mem"
)

// HostMetrics chứa thông số tài nguyên thực tế tại máy chạy Worker.
type HostMetrics struct {
	CPUPercent float64
	RAMPercent float64
}

// CollectHostMetrics đo % CPU và % RAM hiện tại của node để gửi về Admin Dashboard qua Heartbeat.
func CollectHostMetrics() HostMetrics {
	var metrics HostMetrics

	if cpuPercents, err := cpu.Percent(200*time.Millisecond, false); err == nil && len(cpuPercents) > 0 {
		metrics.CPUPercent = cpuPercents[0]
	}

	if vmStat, err := mem.VirtualMemory(); err == nil {
		metrics.RAMPercent = vmStat.UsedPercent
	}

	return metrics
}

