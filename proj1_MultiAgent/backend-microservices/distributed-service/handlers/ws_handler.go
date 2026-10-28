package handlers

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"sync"
	"time"

	"distributed-service/models"
	"distributed-service/service"
	"distributed-service/storage"

	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool { return true },
}

type WSHandler struct {
	registry *service.NodeRegistry
	redis    *storage.RedisStorage
	clients  map[*websocket.Conn]string // Conn -> NodeID
	mu       sync.Mutex
}

func NewWSHandler(registry *service.NodeRegistry, rdb *storage.RedisStorage) *WSHandler {
	h := &WSHandler{
		registry: registry,
		redis:    rdb,
		clients:  make(map[*websocket.Conn]string),
	}

	// Lắng nghe broadcast từ các Pod khác qua Redis Pub/Sub
	if rdb != nil {
		rdb.SubscribeBroadcast(context.Background(), "distributed:broadcast", func(msg []byte) {
			h.broadcastLocal(websocket.TextMessage, msg)
		})
	}

	return h
}

// broadcastLocal gửi tin nhắn xuống các kết nối WebSocket đang kết nối trực tiếp vào pod này
func (h *WSHandler) broadcastLocal(messageType int, msg []byte) {
	h.mu.Lock()
	defer h.mu.Unlock()

	for client := range h.clients {
		if err := client.WriteMessage(messageType, msg); err != nil {
			client.Close()
			delete(h.clients, client)
		}
	}
}

// HandleWebSocket kết nối thời gian thực với Python Worker và giao diện React
func (h *WSHandler) HandleWebSocket(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println("[DISTRIBUTED WS] Upgrade failed:", err)
		return
	}

	nodeID := r.URL.Query().Get("nodeId")
	token := r.URL.Query().Get("token")

	// Nếu truyền token, tìm NodeID tương ứng
	if token != "" {
		if node, found := h.registry.GetNodeByToken(token); found {
			nodeID = node.ID
		}
	}
	if nodeID == "" {
		nodeID = "guest_worker_" + conn.RemoteAddr().String()
	}

	h.mu.Lock()
	h.clients[conn] = nodeID
	h.mu.Unlock()

	// Đánh dấu session online trên Redis
	if h.redis != nil {
		go func(nid string) {
			ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
			defer cancel()
			_ = h.redis.SetNodeOnline(ctx, nid, 60*time.Second)
		}(nodeID)
	}

	log.Printf("[DISTRIBUTED WS] Client connected (NodeID: %s, Remote: %s)\n", nodeID, conn.RemoteAddr())

	defer func() {
		h.mu.Lock()
		nid := h.clients[conn]
		delete(h.clients, conn)
		h.mu.Unlock()

		conn.Close()
		log.Printf("[DISTRIBUTED WS] Client disconnected (NodeID: %s)\n", nid)
		h.registry.MarkNodeOffline(nid)
	}()

	for {
		messageType, msg, err := conn.ReadMessage()
		if err != nil {
			log.Println("[DISTRIBUTED WS] Read error:", err)
			break
		}

		// Xử lý gói tin JSON nhận được
		var payload map[string]interface{}
		if err := json.Unmarshal(msg, &payload); err == nil {
			msgType, _ := payload["type"].(string)

			// Gói tin quét tải phần cứng từ Python Worker (hỗ trợ cả SYSTEM_INFO lẫn HARDWARE_STATS)
			if msgType == "SYSTEM_INFO" {
				if hwMap, ok := payload["hardware"].(map[string]interface{}); ok {
					var cpuP, ramP, diskP float64
					if cpuMap, ok := hwMap["cpu"].(map[string]interface{}); ok {
						cpuP, _ = cpuMap["percent"].(float64)
					}
					if memMap, ok := hwMap["memory"].(map[string]interface{}); ok {
						ramP, _ = memMap["percent"].(float64)
					}
					if disks, ok := hwMap["disk"].([]interface{}); ok && len(disks) > 0 {
						if d0, ok := disks[0].(map[string]interface{}); ok {
							diskP, _ = d0["percent"].(float64)
						}
					}

					stats := models.TelemetryStats{
						CPUPercent:  cpuP,
						RAMPercent:  ramP,
						DiskPercent: diskP,
						Timestamp:   time.Now(),
					}
					h.registry.UpdateTelemetry(nodeID, stats)
				}
			} else if msgType == "HARDWARE_STATS" || payload["cpu_percent"] != nil {
				cpuP, _ := payload["cpu_percent"].(float64)
				ramP, _ := payload["ram_percent"].(float64)
				diskP, _ := payload["disk_percent"].(float64)
				gpuP, _ := payload["gpu_percent"].(float64)
				gpuTemp, _ := payload["gpu_temp"].(float64)

				stats := models.TelemetryStats{
					CPUPercent:     cpuP,
					RAMPercent:     ramP,
					DiskPercent:    diskP,
					GPUPercent:     gpuP,
					GPUTemperature: gpuTemp,
					Timestamp:      time.Now(),
				}

				h.registry.UpdateTelemetry(nodeID, stats)
			}
		}

		// BROADCAST:
		// 1. Nếu có Redis: Phát qua Redis Pub/Sub để các node/cluster khác cùng nhận được
		if h.redis != nil {
			go func(m []byte) {
				ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
				defer cancel()
				_ = h.redis.PublishBroadcast(ctx, "distributed:broadcast", m)
			}(msg)
		} else {
			// Nếu không có Redis: broadcast local trực tiếp
			h.broadcastLocal(messageType, msg)
		}
	}
}
