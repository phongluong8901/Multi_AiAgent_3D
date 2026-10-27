package main

import (
	"log"
	"net/http"
	"sync"

	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool { return true },
}

var clients = make(map[*websocket.Conn]bool)
var mu sync.Mutex

func wsHandler(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println("Lỗi upgrade:", err)
		return
	}

	mu.Lock()
	clients[conn] = true
	mu.Unlock()
	log.Println("[GO SERVER] Một Client (Python Worker hoặc React UI) đã kết nối!")

	defer func() {
		mu.Lock()
		delete(clients, conn)
		mu.Unlock()
		conn.Close()
		log.Println("[GO SERVER] Một Client đã ngắt kết nối.")
	}()

	for {
		messageType, msg, err := conn.ReadMessage()
		if err != nil {
			log.Println("Lỗi đọc message:", err)
			break
		}

		// ---> THÊM DÒNG NÀY ĐỂ IN LOG NỘI DUNG DATA NHẬN ĐƯỢC <---
		log.Printf("[GO SERVER RECV] %s", string(msg))

		// BROADCAST: Nhận data từ Python worker, phát tán xuống cho React UI và mọi client khác
		mu.Lock()
		for client := range clients {
			err := client.WriteMessage(messageType, msg)
			if err != nil {
				log.Println("Lỗi gửi tới client:", err)
				client.Close()
				delete(clients, client)
			}
		}
		mu.Unlock()
	}
}

func main() {
	http.HandleFunc("/ws", wsHandler)
	log.Println("[GO SERVER] Đang chạy tại ws://localhost:8080/ws")
	err := http.ListenAndServe(":8080", nil)
	if err != nil {
		log.Fatal("Lỗi server: ", err)
	}
}
