package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"
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
	registry    *service.NodeRegistry
	redis       *storage.RedisStorage
	clients     map[*websocket.Conn]string // Conn -> NodeID
	writeMu     map[*websocket.Conn]*sync.Mutex
	mu          sync.Mutex
	pendingReqs map[string]chan map[string]interface{}
	reqMu       sync.Mutex
}

func NewWSHandler(registry *service.NodeRegistry, rdb *storage.RedisStorage) *WSHandler {
	h := &WSHandler{
		registry:    registry,
		redis:       rdb,
		clients:     make(map[*websocket.Conn]string),
		writeMu:     make(map[*websocket.Conn]*sync.Mutex),
		pendingReqs: make(map[string]chan map[string]interface{}),
	}

	// Lắng nghe broadcast từ các Pod khác qua Redis Pub/Sub
	if rdb != nil {
		rdb.SubscribeBroadcast(context.Background(), "distributed:broadcast", func(msg []byte) {
			h.broadcastLocal(websocket.TextMessage, msg)
		})
	}

	return h
}

func (h *WSHandler) safeWriteMessage(conn *websocket.Conn, messageType int, data []byte) error {
	h.mu.Lock()
	wmu, ok := h.writeMu[conn]
	h.mu.Unlock()
	if !ok || wmu == nil {
		return fmt.Errorf("connection closed")
	}
	wmu.Lock()
	defer wmu.Unlock()
	return conn.WriteMessage(messageType, data)
}

// broadcastLocal gửi tin nhắn xuống các kết nối WebSocket đang kết nối trực tiếp vào pod này
func (h *WSHandler) broadcastLocal(messageType int, msg []byte) {
	h.mu.Lock()
	conns := make([]*websocket.Conn, 0, len(h.clients))
	for client := range h.clients {
		conns = append(conns, client)
	}
	h.mu.Unlock()

	for _, client := range conns {
		if err := h.safeWriteMessage(client, messageType, msg); err != nil {
			h.mu.Lock()
			client.Close()
			delete(h.clients, client)
			delete(h.writeMu, client)
			h.mu.Unlock()
		}
	}
}

// HandleInferenceRelay cho phép seller-service / ower-service đẩy lệnh suy luận qua đường hầm WebSocket xuống máy Seller (NAT Traversal)
func (h *WSHandler) HandleInferenceRelay(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if r.Method != http.MethodPost {
		http.Error(w, `{"success":false,"message":"Method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		NodeID       string  `json:"nodeId"`
		Model        string  `json:"model"`
		Prompt       string  `json:"prompt"`
		SystemPrompt string  `json:"systemPrompt"`
		Temperature  float64 `json:"temperature"`
		MaxTokens    int     `json:"maxTokens"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Prompt == "" {
		w.WriteHeader(http.StatusBadRequest)
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"message": "Invalid inference request payload",
		})
		return
	}

	// Tìm kết nối WebSocket của worker tương ứng với nodeId (hoặc fallback sang worker đang online)
	var targetConn *websocket.Conn
	var targetNodeID string

	h.mu.Lock()
	for conn, nid := range h.clients {
		if req.NodeID != "" && (nid == req.NodeID || strings.Contains(nid, req.NodeID) || strings.Contains(req.NodeID, nid)) {
			targetConn = conn
			targetNodeID = nid
			break
		}
	}
	// Nếu không khớp chính xác ID, ưu tiên chọn worker thực đang kết nối (không phải trình duyệt chỉ lắng nghe)
	if targetConn == nil {
		for conn, nid := range h.clients {
			targetConn = conn
			targetNodeID = nid
			if !strings.HasPrefix(nid, "web_listener_") {
				break
			}
		}
	}
	h.mu.Unlock()

	if targetConn == nil {
		w.WriteHeader(http.StatusServiceUnavailable)
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"message": "Hiện không có Desktop Worker nào đang kết nối WebSocket để nhận lệnh suy luận.",
		})
		return
	}

	requestID := fmt.Sprintf("inf_%d", time.Now().UnixNano())
	respChan := make(chan map[string]interface{}, 1)

	h.reqMu.Lock()
	h.pendingReqs[requestID] = respChan
	h.reqMu.Unlock()

	defer func() {
		h.reqMu.Lock()
		delete(h.pendingReqs, requestID)
		h.reqMu.Unlock()
	}()

	cmdPayload := map[string]interface{}{
		"type":         "INFERENCE_REQUEST",
		"requestId":    requestID,
		"nodeId":       targetNodeID,
		"model":        req.Model,
		"prompt":       req.Prompt,
		"systemPrompt": req.SystemPrompt,
		"temperature":  req.Temperature,
		"maxTokens":    req.MaxTokens,
	}
	cmdBytes, _ := json.Marshal(cmdPayload)

	if err := h.safeWriteMessage(targetConn, websocket.TextMessage, cmdBytes); err != nil {
		w.WriteHeader(http.StatusBadGateway)
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"message": fmt.Sprintf("Gửi lệnh xuống Worker qua WebSocket thất bại: %v", err),
		})
		return
	}

	select {
	case resData := <-respChan:
		errMsg, _ := resData["error"].(string)
		output, _ := resData["output"].(string)
		if errMsg != "" && output == "" {
			w.WriteHeader(http.StatusBadGateway)
			_ = json.NewEncoder(w).Encode(map[string]interface{}{
				"success": false,
				"message": errMsg,
			})
			return
		}
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"success":      true,
			"requestId":    requestID,
			"nodeId":       targetNodeID,
			"output":       output,
			"relayedViaWs": true,
		})
	case <-time.After(25 * time.Second):
		w.WriteHeader(http.StatusGatewayTimeout)
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"message": "Quá thời gian chờ (25s) phản hồi từ Desktop Worker.",
		})
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
	h.writeMu[conn] = &sync.Mutex{}
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
		delete(h.writeMu, conn)
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

			// 1. Nếu là gói tin phản hồi suy luận từ Worker -> trả về cho HTTP handler đang đợi
			if msgType == "INFERENCE_RESPONSE" {
				reqID, _ := payload["requestId"].(string)
				if reqID != "" {
					h.reqMu.Lock()
					ch, exists := h.pendingReqs[reqID]
					h.reqMu.Unlock()
					if exists {
						select {
						case ch <- payload:
						default:
						}
					}
				}
				continue
			}

			// Đính kèm nodeId chuẩn xác vào gói tin trước khi broadcast
			if payload["nodeId"] == nil || payload["nodeId"] == "" {
				payload["nodeId"] = nodeID
				if enrichedBytes, mErr := json.Marshal(payload); mErr == nil {
					msg = enrichedBytes
				}
			}

			// 2. Gói tin quét tải phần cứng từ Python Worker (hỗ trợ cả SYSTEM_INFO lẫn HARDWARE_STATS)
			if msgType == "SYSTEM_INFO" {
				if hwMap, ok := payload["hardware"].(map[string]interface{}); ok {
					var cpuP, ramP, diskP, gpuP, gpuTemp float64
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
					if gpuMap, ok := hwMap["gpu"].(map[string]interface{}); ok {
						gpuP, _ = gpuMap["load_percent"].(float64)
						gpuTemp, _ = gpuMap["temperature"].(float64)
					}

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
