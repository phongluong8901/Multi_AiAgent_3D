package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"math"
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

// SendMessageToNode gửi thông điệp điều khiển xuống kết nối WebSocket của worker cụ thể
func (h *WSHandler) SendMessageToNode(nodeID string, msg map[string]interface{}) bool {
	h.mu.Lock()
	defer h.mu.Unlock()

	sent := false
	for conn, nid := range h.clients {
		if !strings.HasPrefix(nid, "web_listener_") && (nid == nodeID || strings.Contains(nid, nodeID) || strings.Contains(nodeID, nid)) {
			b, err := json.Marshal(msg)
			if err == nil {
				_ = h.safeWriteMessage(conn, websocket.TextMessage, b)
				sent = true
			}
		}
	}
	return sent
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

func (h *WSHandler) broadcastJSON(payload map[string]interface{}) {
	b, err := json.Marshal(payload)
	if err != nil {
		return
	}
	if h.redis != nil {
		go func(m []byte) {
			ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
			defer cancel()
			_ = h.redis.PublishBroadcast(ctx, "distributed:broadcast", m)
		}(b)
	} else {
		h.broadcastLocal(websocket.TextMessage, b)
	}
}

// HandleInferenceRelay cho phép đẩy lệnh suy luận qua đường hầm WebSocket xuống máy Seller (hỗ trợ SSE stream hoặc JSON)
func (h *WSHandler) HandleInferenceRelay(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodOptions {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Accept, Authorization")
		w.WriteHeader(http.StatusOK)
		return
	}

	var req struct {
		NodeID       string  `json:"nodeId"`
		Model        string  `json:"model"`
		Prompt       string  `json:"prompt"`
		SystemPrompt string  `json:"systemPrompt"`
		Temperature  float64 `json:"temperature"`
		MaxTokens    int     `json:"maxTokens"`
		Stream       bool    `json:"stream"`
	}

	if r.Method == http.MethodGet {
		req.NodeID = r.URL.Query().Get("nodeId")
		req.Model = r.URL.Query().Get("model")
		req.Prompt = r.URL.Query().Get("prompt")
		req.SystemPrompt = r.URL.Query().Get("systemPrompt")
		req.Stream = r.URL.Query().Get("stream") == "true"
	} else if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Prompt == "" {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"message": "Cần cung cấp nội dung prompt hợp lệ.",
		})
		return
	}

	w.Header().Set("Access-Control-Allow-Origin", "*")

	// Tìm kết nối WebSocket của worker thực tế (bỏ qua web_listener_)
	var targetConn *websocket.Conn
	var targetNodeID string

	h.mu.Lock()
	for conn, nid := range h.clients {
		if strings.HasPrefix(nid, "web_listener_") {
			continue
		}
		if req.NodeID != "" && (nid == req.NodeID || strings.Contains(nid, req.NodeID) || strings.Contains(req.NodeID, nid)) {
			targetConn = conn
			targetNodeID = nid
			break
		}
	}
	if targetConn == nil {
		for conn, nid := range h.clients {
			if !strings.HasPrefix(nid, "web_listener_") {
				targetConn = conn
				targetNodeID = nid
				log.Printf("[DISTRIBUTED INFERENCE] Target node %s not found; falling back to active worker %s\n", req.NodeID, targetNodeID)
				break
			}
		}
	} else {
		log.Printf("[DISTRIBUTED INFERENCE] Found matching worker %s for inference (model: %s)\n", targetNodeID, req.Model)
	}
	h.mu.Unlock()

	if targetConn == nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusServiceUnavailable)
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"message": "Hiện không có Desktop Worker nào đang chạy và kết nối WebSocket để nhận lệnh suy luận.",
		})
		return
	}

	isSSE := req.Stream || r.Header.Get("Accept") == "text/event-stream" || r.URL.Query().Get("stream") == "true"
	var flusher http.Flusher
	if isSSE {
		w.Header().Set("Content-Type", "text/event-stream")
		w.Header().Set("Cache-Control", "no-cache")
		w.Header().Set("Connection", "keep-alive")
		w.Header().Set("X-Accel-Buffering", "no")
		flusher, _ = w.(http.Flusher)
	} else {
		w.Header().Set("Content-Type", "application/json")
	}

	requestID := fmt.Sprintf("inf_%d", time.Now().UnixNano())
	respChan := make(chan map[string]interface{}, 64)

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
		"stream":       true, // Luôn bật stream để Worker gửi chunk liên tục, chống nghẽn CPU
	}
	cmdBytes, _ := json.Marshal(cmdPayload)

	if err := h.safeWriteMessage(targetConn, websocket.TextMessage, cmdBytes); err != nil {
		if !isSSE {
			w.WriteHeader(http.StatusBadGateway)
			_ = json.NewEncoder(w).Encode(map[string]interface{}{
				"success": false,
				"message": fmt.Sprintf("Gửi lệnh xuống Worker thất bại: %v", err),
			})
		} else {
			fmt.Fprintf(w, "data: {\"error\": \"Gửi lệnh xuống Worker thất bại: %v\", \"done\": true}\n\n", err)
			if flusher != nil {
				flusher.Flush()
			}
		}
		return
	}

	if isSSE {
		// Luồng streaming Server-Sent Events (SSE) từng token
		timeout := time.After(120 * time.Second)
		for {
			select {
			case resData := <-respChan:
				mType, _ := resData["type"].(string)
				chunk, _ := resData["chunk"].(string)
				errMsg, _ := resData["error"].(string)
				done, _ := resData["done"].(bool)

				if errMsg != "" {
					errBytes, _ := json.Marshal(map[string]interface{}{
						"error":   errMsg,
						"done":    true,
						"success": false,
					})
					fmt.Fprintf(w, "data: %s\n\n", string(errBytes))
					if flusher != nil {
						flusher.Flush()
					}
					return
				}

				if mType == "INFERENCE_CHUNK" && chunk != "" {
					chunkBytes, _ := json.Marshal(map[string]interface{}{
						"chunk":   chunk,
						"done":    false,
						"success": true,
					})
					fmt.Fprintf(w, "data: %s\n\n", string(chunkBytes))
					if flusher != nil {
						flusher.Flush()
					}
				}

				if done || mType == "INFERENCE_RESPONSE" {
					fullOutput, _ := resData["output"].(string)
					modelUsed, _ := resData["model"].(string)
					doneBytes, _ := json.Marshal(map[string]interface{}{
						"output":  fullOutput,
						"model":   modelUsed,
						"done":    true,
						"success": true,
					})
					fmt.Fprintf(w, "data: %s\n\n", string(doneBytes))
					if flusher != nil {
						flusher.Flush()
					}
					return
				}
			case <-timeout:
				timeoutBytes, _ := json.Marshal(map[string]interface{}{
					"error":   "Quá thời gian chờ (120s) phản hồi LLM từ Worker.",
					"done":    true,
					"success": false,
				})
				fmt.Fprintf(w, "data: %s\n\n", string(timeoutBytes))
				if flusher != nil {
					flusher.Flush()
				}
				return
			case <-r.Context().Done():
				return
			}
		}
	} else {
		// Non-streaming response: thu thập toàn bộ chunk cho tới khi Worker hoàn tất
		timeout := time.After(120 * time.Second)
		var fullOutput strings.Builder
		var finalModel string
		finished := false

		for !finished {
			select {
			case resData := <-respChan:
				mType, _ := resData["type"].(string)
				errMsg, _ := resData["error"].(string)
				if errMsg != "" {
					w.WriteHeader(http.StatusBadGateway)
					_ = json.NewEncoder(w).Encode(map[string]interface{}{
						"success": false,
						"message": errMsg,
					})
					return
				}
				if mType == "INFERENCE_CHUNK" {
					if ch, ok := resData["chunk"].(string); ok {
						fullOutput.WriteString(ch)
					}
				}
				if mType == "INFERENCE_RESPONSE" || resData["done"] == true {
					if out, ok := resData["output"].(string); ok && out != "" {
						fullOutput.Reset()
						fullOutput.WriteString(out)
					}
					if m, ok := resData["model"].(string); ok {
						finalModel = m
					}
					finished = true
				}
			case <-timeout:
				w.WriteHeader(http.StatusGatewayTimeout)
				_ = json.NewEncoder(w).Encode(map[string]interface{}{
					"success": false,
					"message": "Quá thời gian chờ (120s) phản hồi từ Desktop Worker.",
				})
				return
			case <-r.Context().Done():
				return
			}
		}

		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"success":      true,
			"requestId":    requestID,
			"nodeId":       targetNodeID,
			"model":        finalModel,
			"output":       fullOutput.String(),
			"relayedViaWs": true,
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
	isWebListener := strings.HasPrefix(nodeID, "web_listener_")

	if !isWebListener && token != "" {
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

	log.Printf("[DISTRIBUTED WS] Client connected (NodeID: %s, WebListener: %v, Remote: %s)\n", nodeID, isWebListener, conn.RemoteAddr())

	// Nếu là giao diện Web kết nối lắng nghe, gửi ngay danh sách các Node hiện tại xuống
	if isWebListener {
		snapshot := map[string]interface{}{
			"type":  "ACTIVE_WORKERS_SNAPSHOT",
			"nodes": h.registry.GetAllNodes(),
		}
		if snapBytes, sErr := json.Marshal(snapshot); sErr == nil {
			_ = h.safeWriteMessage(conn, websocket.TextMessage, snapBytes)
		}
	}

	defer func() {
		h.mu.Lock()
		nid := h.clients[conn]
		delete(h.clients, conn)
		delete(h.writeMu, conn)
		h.mu.Unlock()

		conn.Close()
		log.Printf("[DISTRIBUTED WS] Client disconnected (NodeID: %s)\n", nid)

		// Chỉ đánh dấu OFFLINE và thông báo cho Web khi chính Electron Worker ngắt kết nối
		if !strings.HasPrefix(nid, "web_listener_") {
			h.registry.MarkNodeOffline(nid, false)
			h.broadcastJSON(map[string]interface{}{
				"type":   "WORKER_DISCONNECTED",
				"nodeId": nid,
				"status": "OFFLINE",
				"nodes":  h.registry.GetAllNodes(),
			})
		}
	}()

	for {
		messageType, msg, err := conn.ReadMessage()
		if err != nil {
			break
		}

		var payload map[string]interface{}
		if err := json.Unmarshal(msg, &payload); err == nil {
			msgType, _ := payload["type"].(string)

			// 1. Nếu là gói tin phản hồi hoặc streaming suy luận từ Worker -> chuyển tiếp cho HTTP/SSE handler
			if msgType == "INFERENCE_RESPONSE" || msgType == "INFERENCE_CHUNK" {
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

			// 2. Gói tin quét tải phần cứng từ Python Worker (SYSTEM_INFO / HARDWARE_STATS)
			if msgType == "SYSTEM_INFO" || msgType == "HARDWARE_STATS" || payload["cpu_percent"] != nil {
				if pNID, ok := payload["nodeId"].(string); ok && pNID != "" {
					if nodeID == "" || strings.HasPrefix(nodeID, "guest_worker_") {
						nodeID = pNID
					}
				}

				var cpuP, ramP, diskP, gpuP, gpuTemp float64
				var hwReport *models.HardwareReport
				var hostname string
				var ollamaModels []string

				if osMap, ok := payload["os"].(map[string]interface{}); ok {
					hostname, _ = osMap["hostname"].(string)
				}

				if rawModels, ok := payload["ollama_models"].([]interface{}); ok {
					for _, rm := range rawModels {
						if ms, ok := rm.(string); ok && ms != "" {
							ollamaModels = append(ollamaModels, ms)
						}
					}
				}

				if hwMap, ok := payload["hardware"].(map[string]interface{}); ok {
					hwReport = &models.HardwareReport{}
					if cpuMap, ok := hwMap["cpu"].(map[string]interface{}); ok {
						cpuP, _ = cpuMap["percent"].(float64)
						if cores, ok := cpuMap["count_logical"].(float64); ok {
							hwReport.CPUCores = int(cores)
						}
					}
					if memMap, ok := hwMap["memory"].(map[string]interface{}); ok {
						ramP, _ = memMap["percent"].(float64)
						if totalBytes, ok := memMap["total"].(float64); ok && totalBytes > 0 {
							hwReport.DeviceMemoryGB = math.Round(totalBytes / (1024 * 1024 * 1024))
						}
					}
					if disks, ok := hwMap["disk"].([]interface{}); ok && len(disks) > 0 {
						if d0, ok := disks[0].(map[string]interface{}); ok {
							diskP, _ = d0["percent"].(float64)
						}
					}
					if gpuMap, ok := hwMap["gpu"].(map[string]interface{}); ok && gpuMap != nil {
						gpuP, _ = gpuMap["load_percent"].(float64)
						gpuTemp, _ = gpuMap["temperature"].(float64)
						gpuName, _ := gpuMap["name"].(string)
						vramGB, _ := gpuMap["vram_gb"].(float64)
						if gpuName != "" {
							hwReport.GPUName = gpuName
							hwReport.HasWebGPU = true
							hwReport.VRAMGB = vramGB
						}
					}
				} else {
					cpuP, _ = payload["cpu_percent"].(float64)
					ramP, _ = payload["ram_percent"].(float64)
					diskP, _ = payload["disk_percent"].(float64)
					gpuP, _ = payload["gpu_percent"].(float64)
					gpuTemp, _ = payload["gpu_temp"].(float64)
				}

				hasGPU, _ := payload["has_gpu"].(bool)
				if !hasGPU && hwReport != nil && hwReport.HasWebGPU {
					hasGPU = true
				}
				gpuName, _ := payload["gpu_name"].(string)
				if gpuName == "" && hwReport != nil {
					gpuName = hwReport.GPUName
				}
				vramGB, _ := payload["vram_gb"].(float64)
				if vramGB == 0 && hwReport != nil {
					vramGB = hwReport.VRAMGB
				}

				isLLMRunning, _ := payload["is_llm_running"].(bool)
				if !isLLMRunning {
					if ollamaRunning, ok := payload["ollama_running"].(bool); ok && ollamaRunning {
						isLLMRunning = true
					} else if len(ollamaModels) > 0 {
						isLLMRunning = true
					}
				}
				llmProvider, _ := payload["llm_provider"].(string)
				if llmProvider == "" {
					llmProvider = "ollama"
				}

				var llmStats *models.LLMActivityStats
				if lsMap, ok := payload["llm_stats"].(map[string]interface{}); ok {
					llmStats = &models.LLMActivityStats{}
					if reqs, ok := lsMap["total_requests"].(float64); ok {
						llmStats.TotalRequests = int64(reqs)
					}
					if act, ok := lsMap["active_requests"].(float64); ok {
						llmStats.ActiveRequests = int(act)
					}
					if toks, ok := lsMap["total_tokens"].(float64); ok {
						llmStats.TotalTokens = int64(toks)
					}
					if pToks, ok := lsMap["prompt_tokens"].(float64); ok {
						llmStats.PromptTokens = int64(pToks)
					}
					if cToks, ok := lsMap["completion_tokens"].(float64); ok {
						llmStats.CompletionTokens = int64(cToks)
					}
					if tps, ok := lsMap["tokens_per_sec"].(float64); ok {
						llmStats.TokensPerSec = tps
					}
					if lat, ok := lsMap["last_latency_ms"].(float64); ok {
						llmStats.LastLatencyMs = int64(lat)
					}
					if cm, ok := lsMap["current_model"].(string); ok {
						llmStats.CurrentModel = cm
					}
					if busy, ok := lsMap["is_busy"].(bool); ok {
						llmStats.IsBusy = busy
					}
					if st, ok := lsMap["status"].(string); ok {
						llmStats.Status = st
					}
				}

				stats := models.TelemetryStats{
					CPUPercent:      cpuP,
					RAMPercent:      ramP,
					DiskPercent:     diskP,
					GPUPercent:      gpuP,
					GPUTemperature:  gpuTemp,
					HasGPU:          hasGPU,
					GPUName:         gpuName,
					VRAMGB:          vramGB,
					IsLLMRunning:    isLLMRunning,
					LLMProvider:     llmProvider,
					InstalledModels: ollamaModels,
					LLMStats:        llmStats,
					Timestamp:       time.Now(),
				}

				updatedNode := h.registry.UpsertWorkerTelemetry(nodeID, hostname, hwReport, ollamaModels, stats)
				if updatedNode != nil {
					h.mu.Lock()
					h.clients[conn] = updatedNode.ID
					nodeID = updatedNode.ID
					h.mu.Unlock()

					payload["nodeId"] = updatedNode.ID
					payload["node"] = updatedNode
					payload["status"] = updatedNode.Status
					if enrichedBytes, mErr := json.Marshal(payload); mErr == nil {
						msg = enrichedBytes
					}
				}
			}
		}

		// Broadcast gói tin xuống toàn bộ giao diện Web (Kiểm tra Node AI, Đối tác Mô hình, Electron UI)
		if h.redis != nil {
			go func(m []byte) {
				ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
				defer cancel()
				_ = h.redis.PublishBroadcast(ctx, "distributed:broadcast", m)
			}(msg)
		} else {
			h.broadcastLocal(messageType, msg)
		}
	}
}
