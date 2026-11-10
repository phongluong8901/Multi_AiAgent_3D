package models

// WorkerNodeInfo lưu thông tin sức khỏe và năng lực của một máy Worker trong cụm.
// Được Worker gửi định kỳ lên Redis (Heartbeat) để Admin Dashboard giám sát.
type WorkerNodeInfo struct {
	WorkerID        string   `json:"worker_id"`
	SupportedModels []string `json:"supported_models"`
	MaxSlots        int      `json:"max_slots"`
	ActiveJobs      int      `json:"active_jobs"`
	CPUUsagePercent float64  `json:"cpu_usage_percent"`
	RAMUsagePercent float64  `json:"ram_usage_percent"`
	Status          string   `json:"status"` // ONLINE, DRAINING
	LastHeartbeat   int64    `json:"last_heartbeat"`
}

