package handlers

import (
	"encoding/json"
	"net/http"
	"time"
)

// HealthCheckHandler phản hồi trạng thái hoạt động (Health Check) của Distributed Service.
func HealthCheckHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)

	resp := map[string]interface{}{
		"status":    "UP",
		"service":   "distributed-service",
		"engine":    "Golang",
		"version":   "1.0.0",
		"timestamp": time.Now().Format(time.RFC3339),
		"message":   "Distributed Model Partner & App Delivery Service is running smoothly",
	}

	json.NewEncoder(w).Encode(resp)
}
