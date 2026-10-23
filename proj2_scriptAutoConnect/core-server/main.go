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
		log.Printf("❌ Lỗi nâng cấp WebSocket: %v", err)
		return
	}
	defer ws.Close()

	fmt.Println("🟢 Đã có một Worker kết nối thành công tới Server!")

	for {
		var msg map[string]interface{}
		err := ws.ReadJSON(&msg)
		if err != nil {
			log.Printf("⚠️ Worker đã ngắt kết nối: %v", err)
			break
		}

		msgType := msg["type"]

		if msgType == "REGISTER_WORKER" {
			token := msg["token"]

			hardware, hwOk := msg["hardware"].(map[string]interface{})
			if !hwOk {
				log.Println("⚠️ Dữ liệu hardware không hợp lệ")
			}

			city := "Unknown"
			country := "Unknown"
			if loc, ok := msg["location"].(map[string]interface{}); ok {
				if c, exists := loc["city"].(string); exists {
					city = c
				}
				if cn, exists := loc["country"].(string); exists {
					country = cn
				}
			}

			fmt.Println("\n----------------------------------------")
			fmt.Println("📋 NHẬN ĐĂNG KÝ WORKER THÀNH CÔNG:")
			fmt.Printf("🔑 Token tài khoản: %v\n", token)
			if hwOk {
				fmt.Printf("💻 OS: %v | CPU Cores: %v\n", hardware["os"], hardware["cpu_cores"])
				fmt.Printf("🎮 GPU: %v (VRAM: %v GB)\n", hardware["gpu_name"], hardware["vram_gb"])
			}
			fmt.Printf("📍 Vị trí địa lý: %s, %s\n", city, country)
			if hwOk {
				fmt.Printf("🤖 Model hỗ trợ: %v\n", hardware["supported_models"])
			}
			fmt.Println("----------------------------------------\n")
		} else {
			fmt.Printf("📩 Nhận tin nhắn khác: %v\n", msg)
		}
	}
}

func main() {
	http.HandleFunc("/ws", handleConnections)

	port := ":8080"
	fmt.Printf("🚀 Core Server (Golang) đang khởi chạy tại cổng %s...\n", port)

	err := http.ListenAndServe(port, nil)
	if err != nil {
		log.Fatal("❌ Không thể khởi động server: ", err)
	}
}
