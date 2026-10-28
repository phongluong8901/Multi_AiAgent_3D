package main

import (
	"encoding/json"
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

// Lưu data mới nhất để gửi cho client mới kết nối
var latestData json.RawMessage
var latestMu sync.RWMutex

func wsHandler(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println("Lỗi upgrade:", err)
		return
	}

	mu.Lock()
	clients[conn] = true
	mu.Unlock()
	log.Println("[GO SERVER] Client đã kết nối!")

	// Gửi data mới nhất ngay khi client mới kết nối
	latestMu.RLock()
	if latestData != nil {
		conn.WriteMessage(websocket.TextMessage, latestData)
	}
	latestMu.RUnlock()

	defer func() {
		mu.Lock()
		delete(clients, conn)
		mu.Unlock()
		conn.Close()
		log.Println("[GO SERVER] Client đã ngắt kết nối.")
	}()

	for {
		messageType, msg, err := conn.ReadMessage()
		if err != nil {
			log.Println("Lỗi đọc message:", err)
			break
		}

		log.Printf("[GO SERVER RECV] %s", string(msg))

		// Lưu data mới nhất
		latestMu.Lock()
		latestData = msg
		latestMu.Unlock()

		// Broadcast cho tất cả client
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
	// WebSocket
	http.HandleFunc("/ws", wsHandler)

	// Frontend Admin của Go (trang đơn giản)
	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.Write([]byte(adminHTML))
	})

	log.Println("[GO SERVER] Đang chạy tại http://localhost:8082")
	log.Println("[GO SERVER] WebSocket: ws://localhost:8082/ws")
	log.Println("[GO SERVER] Admin Dashboard: http://localhost:8082")

	err := http.ListenAndServe(":8082", nil)
	if err != nil {
		log.Fatal("Lỗi server: ", err)
	}
}

// HTML đơn giản cho Admin Frontend của Go
const adminHTML = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8" />
  <title>Go Admin – System Monitor</title>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { background:#0f0f0f; color:#ddd; font-family:system-ui,sans-serif; }
    header { background:#1a1a1a; padding:12px 20px; border-bottom:1px solid #333; display:flex; justify-content:space-between; align-items:center; }
    .status { padding:4px 10px; border-radius:4px; font-size:12px; font-weight:bold; }
    .connected { background:#1c3321; color:#4ade80; }
    .disconnected { background:#3b1d1d; color:#f87171; }
    .grid { display:grid; grid-template-columns:1fr 1fr; gap:16px; padding:16px; }
    .card { background:#1a1a1a; border:1px solid #333; border-radius:8px; padding:16px; }
    .card h3 { margin-bottom:12px; color:#ff6c37; font-size:14px; }
    #map { height:400px; border-radius:8px; }
    pre { background:#111; padding:12px; border-radius:6px; font-size:12px; overflow:auto; max-height:300px; }
    .metric { display:flex; justify-content:space-between; margin:6px 0; font-size:13px; }
    .bar { height:6px; background:#333; border-radius:3px; margin-top:4px; overflow:hidden; }
    .bar > div { height:100%; background:#ff6c37; transition:width 0.3s; }
  </style>
</head>
<body>
  <header>
    <div><strong>Go Admin Dashboard</strong> – System Monitor</div>
    <div id="wsStatus" class="status disconnected">DISCONNECTED</div>
  </header>

  <div class="grid">
    <div class="card">
      <h3>Hardware</h3>
      <div id="hw"></div>
    </div>
    <div class="card">
      <h3>Location Map</h3>
      <div id="map"></div>
    </div>
    <div class="card" style="grid-column:1 / -1">
      <h3>Raw Data</h3>
      <pre id="raw">Waiting for data...</pre>
    </div>
  </div>

  <script>
    let map, marker;
    const statusEl = document.getElementById('wsStatus');
    const hwEl = document.getElementById('hw');
    const rawEl = document.getElementById('raw');

    function initMap() {
      map = L.map('map').setView([21.0285, 105.8542], 5);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap'
      }).addTo(map);
    }

    function updateMap(lat, lon, city) {
      if (!map) return;
      if (marker) map.removeLayer(marker);
      marker = L.marker([lat, lon]).addTo(map)
        .bindPopup(city || 'Current Location').openPopup();
      map.setView([lat, lon], 10);
    }

    function renderHW(data) {
      if (!data || !data.hardware) return;
      const h = data.hardware;
      let html = '';
      if (h.cpu) {
        html += '<div class="metric"><span>CPU</span><span>' + h.cpu.percent + '%</span></div>';
        html += '<div class="bar"><div style="width:' + h.cpu.percent + '%"></div></div>';
      }
      if (h.memory) {
        html += '<div class="metric"><span>RAM</span><span>' + h.memory.percent + '%</span></div>';
        html += '<div class="bar"><div style="width:' + h.memory.percent + '%;background:#38bdf8"></div></div>';
      }
      if (h.battery) {
        html += '<div class="metric"><span>Battery</span><span>' + h.battery.percent + '% ' + (h.battery.plugged ? '(Plugged)' : '') + '</span></div>';
      }
      if (data.os) {
        html += '<div class="metric" style="margin-top:12px"><span>Hostname</span><span>' + data.os.hostname + '</span></div>';
        html += '<div class="metric"><span>OS</span><span>' + data.os.platform + ' ' + data.os.release + '</span></div>';
      }
      if (data.location) {
        html += '<div class="metric" style="margin-top:12px"><span>City</span><span>' + (data.location.city || '') + ', ' + (data.location.country || '') + '</span></div>';
      }
      hwEl.innerHTML = html;
    }

    const ws = new WebSocket('ws://' + location.host + '/ws');
    ws.onopen = () => {
      statusEl.textContent = 'CONNECTED';
      statusEl.className = 'status connected';
    };
    ws.onclose = () => {
      statusEl.textContent = 'DISCONNECTED';
      statusEl.className = 'status disconnected';
    };
    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        rawEl.textContent = JSON.stringify(data, null, 2);
        renderHW(data);
        if (data.location && data.location.lat && data.location.lon) {
          updateMap(data.location.lat, data.location.lon, data.location.city);
        }
      } catch (err) {}
    };

    initMap();
  </script>
</body>
</html>`
