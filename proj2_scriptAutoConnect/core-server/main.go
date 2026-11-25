package main

import (
	"fmt"
	"log"
	"net/http"

	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

func handleConnections(w http.ResponseWriter, r *http.Request) {
	ws, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("[ERROR] WebSocket Upgrade Failed: %v", err)
		return
	}
	defer ws.Close()

	for {
		var msg map[string]interface{}
		err := ws.ReadJSON(&msg)
		if err != nil {
			log.Printf("[WARN] Connection closed: %v", err)
			break
		}

		msgType, _ := msg["type"].(string)

		switch msgType {
		case "PING_CHECK":
			// Phản hồi ngay cho bước kiểm tra kết nối từ UI
			_ = ws.WriteJSON(map[string]interface{}{
				"type":   "PONG_OK",
				"status": "ONLINE",
			})
			log.Println("[PING] Client connection test verified.")

		case "REGISTER_WORKER":
			token := msg["token"]
			hardware, hwOk := msg["hardware"].(map[string]interface{})
			if !hwOk {
				log.Println("[WARN] Invalid hardware payload")
				continue
			}

			city, country := "Unknown", "Unknown"
			if loc, ok := msg["location"].(map[string]interface{}); ok {
				if c, exists := loc["city"].(string); exists {
					city = c
				}
				if cn, exists := loc["country"].(string); exists {
					country = cn
				}
			}

			fmt.Println("==================================================")
			fmt.Println("[OK] WORKER NODE REGISTERED")
			fmt.Println("--------------------------------------------------")
			fmt.Printf("  Auth Token       : %v\n", token)
			fmt.Printf("  Operating System : %v\n", hardware["os"])
			fmt.Printf("  Allocated CPU    : %v / %v Cores\n", hardware["cpu_cores"], hardware["cpu_cores_total"])
			fmt.Printf("  Allocated RAM    : %v / %v GB\n", hardware["system_ram_gb"], hardware["system_ram_total_gb"])
			fmt.Printf("  GPU Accelerator  : %v (VRAM: %v GB)\n", hardware["gpu_name"], hardware["vram_gb"])
			fmt.Printf("  Geo Location     : %s, %s\n", city, country)
			fmt.Printf("  Supported Models : %v\n", hardware["supported_models"])
			fmt.Println("==================================================")

		case "HEARTBEAT":
			token := msg["token"]
			metrics, ok := msg["metrics"].(map[string]interface{})
			if ok {
				log.Printf(
					"[TELEMETRY] Token: %v | CPU Load: %v%% (Limit: %v Cores) | RAM Used: %v GB (%v%% | Limit: %v GB)",
					token,
					metrics["cpu_usage_percent"],
					metrics["allocated_cpu"],
					metrics["ram_used_gb"],
					metrics["ram_usage_percent"],
					metrics["allocated_ram_gb"],
				)
			}

		default:
			log.Printf("[MESSAGE] Unknown payload: %v\n", msg)
		}
	}
}

func main() {
	http.HandleFunc("/ws", handleConnections)

	port := ":8080"
	log.Printf("[SYSTEM] Core Server (Golang) listening on port %s...\n", port)

	if err := http.ListenAndServe(port, nil); err != nil {
		log.Fatal("[FATAL] Server startup failed: ", err)
	}
}