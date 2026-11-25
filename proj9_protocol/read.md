# Multi-Protocol Benchmark & Swap Testbench

He thong Gateway va Benchmark danh gia truyen thong 10 giao thuc (SSE, WebSocket, Socket.IO, HTTP REST, MJPEG, RTP/UDP RFC 3550, MQTT, gRPC, TCP Raw Binary, HTTP NDJSON Stream) kem Worker Monitor theo doi xu ly thoi gian thuc.

## 1. Huong dan khoi chay voi Makefile

Mo terminal tai thu muc `proj9_protocol`:

### Buoc 1: Build hoac chay Gateway Control Plane
```bash
# Chay truc tiep
make run-gateway

# Hoac bien dich ra bin/gateway.exe va bin/worker.exe
make build
```
Sau khi Gateway bat thanh cong, mo trinh duyet truy cap:
```text
http://localhost:8080
```
Mo Worker Monitor tich hop ngay tai:
```text
http://localhost:8080/worker.html
```

### Buoc 2 (Tuy chon): Khoi chay Worker Doc lap
Worker doc lap nhan goi tin qua Redis Streams (khi bat Docker) hoac qua HTTP Bridge (`:8090/ingest` / tu fallback `:8091` hoac bien moi truong `WORKER_ADDR`):
```bash
make run-worker
```

### Buoc 3 (Tuy chon): Khoi chay Redis & MediaMTX voi Docker
```bash
make docker-up
```

### Cac lenh Make khac
- `make help`: Xem danh sach lenh.
- `make tidy`: Dong bo module Go (can ket noi mang khi them package moi).
- `make build`: Bien dich ma nguon thanh `bin/gateway.exe` va `bin/worker.exe`.
- `make docker-down`: Dung cac container Docker.
- `make clean`: Xoa thu muc build `bin/`.

## 2. Danh sach Port va Endpoint (10 Giao thuc + Control Plane)

| Giao thuc | Port | Endpoint / Co che | Overhead Header |
| :--- | :--- | :--- | :--- |
| Gateway Dashboard & Worker Monitor | `:8080` | `http://localhost:8080/` & `/worker.html` | - |
| Control API Stats / Reset / Bench | `:8080` | `/control/stats`, `/control/reset`, `/control/bench` | - |
| Worker Doc lap (Fallback `:8091`) | `:8090` | `http://localhost:8090/` | - |
| SSE Stream | `:8081` | `GET http://localhost:8081/events` | 8 B (`data: ...\n\n`) |
| WebSocket | `:8082` | `ws://localhost:8082/ws` | 2-6 B frame WS |
| Socket.IO v4 | `:8083` | `http://localhost:8083/socket.io/` (`websocket` + `polling` handshake) | 13 B (`42["packet",...]`) |
| HTTP REST Ingest | `:8084` | `POST http://localhost:8084/ingest`, `GET /outbox` | ~550 B HTTP header |
| MJPEG Camera | `:8085` | `GET http://localhost:8085/video` | 64 B multipart boundary |
| TCP Raw Binary | `:8086` | TCP 4B Big-Endian len + payload (hoac JSON + `\n`) | 4 B |
| HTTP NDJSON Stream | `:8087` | `POST /ingest`, `GET /stream` (`application/x-ndjson`) | 1 B (`\n`) |
| RTP / UDP Media Stream | `:8554` | UDP datagram (header RTP v2 RFC 3550 12B + UDP 8B) | 20 B (hoac 8 B UDP tho) |
| MQTT Broker | `:1883` | TCP MQTT 3.1.1 / 5.0 (`SUBSCRIBE gateway/out/#`) | 2 B + topic len |
| gRPC Stream | `:50051` | `/bench.Streamer/Pipe` (codec `benchjson` HTTP/2) | 14 B (9B H2 + 5B gRPC) |
