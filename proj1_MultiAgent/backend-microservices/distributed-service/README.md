# Distributed Service (Golang)

Dịch vụ vi mô phân phối ứng dụng Desktop Client (Electron + React + Python Worker) và điều phối mạng lưới Đối tác Mô hình AI phân tán (Distributed Model Compute Partners).

## [TÍNH NĂNG CHÍNH]
1. **Model Partner Onboarding & Benchmark Engine**:
   - Tự động tiếp nhận và đánh giá thông số RAM, CPU Cores, GPU/WebGPU, VRAM của máy đối tác.
   - Tính toán mức độ tương thích đối với các mô hình AI lớn: DeepSeek-R1 (7B), Llama 3.3 (8B), Qwen 2.5 (7B), Mistral, SDXL Turbo, Whisper.
   - Đưa ra đề xuất cấu hình cho thuê tối ưu và ước tính thu nhập SaveCoin / giờ.

2. **Compute Resource Leasing Configuration**:
   - Cho phép người dùng tùy biến số Core CPU, dung lượng RAM, và tỷ lệ GPU cam kết cho thuê.
   - Cung cấp token xác thực node độc nhất (`authToken`).

3. **Desktop Client App Distribution Hub**:
   - Phân phối file cài đặt ứng dụng Electron Desktop tích hợp sẵn Go WebSocket server và Python hardware telemetry daemon.
   - Tự động tạo và phát file `worker-config.json` cá nhân hóa.

4. **Real-time Telemetry & Native In-Memory WebSocket Relay**:
   - Lắng nghe WebSocket (`/api/v1/distributed/ws` hoặc `/ws`) trực tiếp từ Python Worker (`worker.py` / `worker.exe`).
   - Định tuyến suy luận P2P trực tiếp qua Go in-memory channels (không phụ thuộc Redis/RabbitMQ trung gian).
   - Cập nhật tải CPU %, RAM %, Disk % và tích lũy SaveCoin cho người dùng theo thời gian thực.
   - Phát tán (Broadcast) dữ liệu xuống React UI.

## [KHỞI CHẠY LOCAL]
```bash
cd backend-microservices/distributed-service
go run main.go
```
Cổng mặc định: `http://localhost:5010`
WebSocket: `ws://localhost:5010/api/v1/distributed/ws` (hoặc `ws://localhost:5010/ws`)
