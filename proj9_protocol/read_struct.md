protocol-testbench/
├── cmd/
│   ├── gateway/
│   │   ├── main.go                 # Registry, 10 protocol plugins, Dashboard & Worker Monitor (:8080)
│   │   └── main_test.go            # Unit/Integration test tat ca 10 protocol, Swap, Bench & Reset
│   └── worker/
│       └── main.go                 # Worker doc lap (:8090, fallback :8091) qua Redis Streams / HTTP
├── internal/
│   ├── core/
│   │   ├── metrics.go              # LatencyMeter & Counters (hỗ trợ Reset)
│   │   ├── packet.go               # UnifiedPacket & WireJSON
│   │   ├── plugin.go               # ProtocolPlugin, InboundSimulator, StatsResetter
│   │   └── registry.go             # Quan ly Enable/Disable, Broadcast, Swap, Simulate, ResetAllStats
│   ├── bus/
│   │   ├── memory_bus.go           # Go Channel Bus (trong RAM)
│   │   └── redis_bus.go            # Redis Streams + Pub/Sub Bus
│   ├── netutil/
│   │   └── netutil.go              # HTTPServer, SafeWS, CORS, WSFrameOverhead
│   └── protocols/                  # MOI GIAO THUC LA 1 PACKAGE DOC LAP
│       ├── sse/plugin.go           # (:8081) Server-Sent Events
│       ├── websocket/plugin.go     # (:8082) WebSocket Full-Duplex
│       ├── socketio/plugin.go      # (:8083) Engine.IO v4 / Socket.IO v4
│       ├── http_rest/plugin.go     # (:8084) HTTP/1.1 REST Ingest & Outbox
│       ├── mjpeg/plugin.go         # (:8085) Camera MJPEG stream
│       ├── tcp_raw/plugin.go       # (:8086) TCP Raw 4-byte length-prefixed binary / JSON lines
│       ├── ndjson/plugin.go        # (:8087) HTTP NDJSON Chunked Stream (AI/LLM)
│       ├── rtp_udp/plugin.go       # (:8554) RTP v2 (RFC 3550) over UDP
│       ├── mqtt/plugin.go          # (:1883) Mochi-MQTT Broker 3.1.1 / 5.0
│       └── grpc_stream/plugin.go   # (:50051) gRPC Bidirectional Streaming
└── web/
    ├── index.html                  # Gateway Dashboard (10 giao thuc)
    ├── app.js                      # Dashboard controller & Live Traffic Inspector
    ├── style.css                   # Giao dien Dark UI
    └── worker.html                 # Worker Monitor Dashboard

# -------------------
| Giao thuc | Cong | Endpoint / Co che | Thu vien su dung | Tinh trang |
| --- | --- | --- | --- | --- |
| Control / Dashboard / Worker UI | `:8080` | `http://localhost:8080/` & `/worker.html` | `net/http` | [SAN SANG] |
| Worker Monitor Doc lap | `:8090` (`:8091`) | `http://localhost:8090/` | `net/http` | [SAN SANG] |
| SSE (Server-Sent Events) | `:8081` | `GET http://localhost:8081/events` | `net/http` | [SAN SANG] |
| WebSocket | `:8082` | `ws://localhost:8082/ws` | `gorilla/websocket` | [SAN SANG] |
| Socket.IO v4 | `:8083` | `http://localhost:8083/socket.io/` | `gorilla/websocket` | [SAN SANG] |
| HTTP REST | `:8084` | `POST /ingest`, `GET /outbox` | `net/http` | [SAN SANG] |
| MJPEG Video | `:8085` | `GET http://localhost:8085/video` | `net/http`, `image/jpeg` | [SAN SANG] |
| TCP Raw Binary | `:8086` | TCP 4B len-prefix / line JSON | `net` | [SAN SANG] |
| HTTP NDJSON Stream | `:8087` | `POST /ingest`, `GET /stream` | `net/http` | [SAN SANG] |
| RTP / UDP (RFC 3550) | `:8554` | UDP 12B RTP v2 + payload | `net` | [SAN SANG] |
| MQTT Broker | `:1883` | TCP MQTT 3.1.1 / 5.0 | `mochi-mqtt/server/v2` | [SAN SANG] |
| gRPC Stream | `:50051` | `/bench.Streamer/Pipe` | `google.golang.org/grpc` | [SAN SANG] |
