# Hướng Dẫn Dành Cho Seller (Người Cho Thuê GPU & Local LLM)

Tài liệu này hướng dẫn chi tiết từng bước dành cho **Seller** (Đối tác cung ứng tài nguyên tính toán) để kết nối máy tính cá nhân/máy chủ GPU, chạy mô hình ngôn ngữ lớn (Local LLM như Qwen, Llama, DeepSeek) và cho người dùng/Owner thuê kiếm lợi nhuận thông qua mạng lưới phân tán AI.

---

## 1. Kiến Trúc Luồng Hoạt Động Của Seller

```
+------------------------------------------------------------------------------------+
|                                 MÁY TÍNH CỦA SELLER                                |
|                                                                                    |
|  +------------------------+             +---------------------------------------+  |
|  |  Local LLM Engine      |             |  Electron Desktop Worker (.exe)       |  |
|  |  (Ollama / LM Studio)  |<---HTTP---->|  (Thu thập Telemetry, RAM/GPU/Ping,   |  |
|  |  Port 11434 / 1234     |  Streaming  |   Quản lý ngưỡng tài nguyên)          |  |
|  +------------------------+             +-------------------+-------------------+  |
+-------------------------------------------------------------|----------------------+
                                                              | WebSocket Heartbeat
                                                              | & Proxy Streaming
                                                              v
                                              +-------------------------------+
                                              | Distributed Service (:5010)   |
                                              | Quản lý Nodes & Điều hướng    |
                                              +---------------+---------------+
                                                              |
                                                              v
+-------------------------------+             +-------------------------------+
| Web Dashboard (:3000)         |<---HTTP---->| Seller Service (:5011)        |
| - /node-checker (Ping, bật/tắt)|             | Quản lý Gói Cho Thuê & Tiền  |
| - /seller (Doanh thu, rút tiền)|             +-------------------------------+
+-------------------------------+
```

---

## 2. Yêu Cầu Chuẩn Bị (Prerequisites)

1. **Phần cứng đề xuất:**
   - **GPU:** NVIDIA RTX 3060 trở lên (VRAM >= 8GB) hoặc Apple Silicon (M1/M2/M3 >= 16GB RAM Unified).
   - **RAM:** Tối thiểu 16GB (khuyến nghị 32GB nếu chạy model 14B trở lên).
   - **Ổ cứng:** Còn trống tối thiểu 20GB SSD để chứa checkpoint model.
2. **Phần mềm:**
   - Đã cài đặt **Ollama** ([https://ollama.com](https://ollama.com)) hoặc **LM Studio**.
   - Ứng dụng **Electron Desktop Worker** của nền tảng (file `.exe` tải từ giao diện Web).

---

## 3. Quy Trình Vận Hành 5 Bước Dành Cho Seller

### Bước 1: Khởi Chạy Mô Hình LLM Cục Bộ (Local LLM)

Mở Terminal trên máy tính của bạn và kéo model mong muốn về chạy (khuyên dùng dòng Qwen):

```bash
# Tải và chạy Qwen 2.5 7B (nhanh, nhẹ, thông minh)
ollama run qwen2.5:7b

# Hoặc nếu máy bạn có GPU mạnh (VRAM >= 12GB):
ollama run qwen2.5:14b
```

Kiểm tra xem Ollama đã lắng nghe tại cổng mặc định `http://localhost:11434` hay chưa:
```bash
curl http://localhost:11434/api/tags
```

---

### Bước 2: Tải Ứng Dụng Electron Desktop Worker

1. Đăng nhập vào hệ thống Web Dashboard: `http://localhost:3000`.
2. Truy cập vào trang **"Kiểm Tra Node AI"** (`/node-checker`).
3. Nhấp vào nút **"Tải App Desktop (.exe)"** hoặc **"Gia Nhập Đối Tác"** để tải bộ Worker về máy.
   *(Nếu đang phát triển từ mã nguồn, chạy lệnh tại thư mục `proj3_clientElectron`: `npm run dev`)*.

---

### Bước 3: Cấu Hình Và Kết Nối Worker Lên Mạng Phân Tán

Mở ứng dụng Electron Desktop Worker trên máy tính:
1. **Node Name:** Đặt tên định danh cho máy của bạn (Ví dụ: `Worker-Hanoi-RTX4090`).
2. **Server WS URL:** Điền địa chỉ Distributed Service:
   ```
   ws://localhost:5010/api/v1/distributed/ws
   ```
   *(Trường hợp hệ thống chạy trên Cloud/VPS, thay bằng domain/IP của máy chủ).*
3. **Local LLM Endpoint:** Điền địa chỉ Ollama:
   ```
   http://localhost:11434
   ```
4. **Cấu hình giới hạn tài nguyên:**
   - Điều chỉnh thanh trượt **Max VRAM / RAM cho phép** (ví dụ: giới hạn 80% để không làm đơ máy khi bạn làm việc khác).
5. Nhấp nút **"Bắt đầu kết nối" (Start Worker)**.
   - Ứng dụng sẽ tự động kích hoạt tiến trình đo lường phần cứng (`psutil`), ping mạng và gửi gói tin đăng ký (`register`) lên `distributed-service`.

---

### Bước 4: Kiểm Tra Trạng Thái Trực Tiếp Trên Web

Mở trang **"Kiểm Tra Node AI"** (`/node-checker`):
1. **Kiểm tra Ping & Heartbeat:**
   - Mục **"Trạng Thái Electron Desktop Worker"** sẽ hiển thị thẻ xanh: `Worker Đang Trực Tuyến`.
   - Độ trễ Ping hiển thị trực tiếp (thông thường từ `5ms` – `15ms` trên mạng local).
2. **Kiểm tra thông số phần cứng được đồng bộ:**
   - CPU Usage, RAM Usage, Tên Model (`qwen2.5:7b`), VRAM thực tế từ máy bạn sẽ được cập nhật liên tục.
3. **Bật / Tắt trạng thái nhận việc:**
   - Bạn có thể nhấn nút **"Tạm Dừng"** hoặc **"Tiếp Tục Online"** ngay trên giao diện Web hoặc trên app Electron. Khi tạm dừng, các Owner sẽ không thể gửi yêu cầu suy luận mới vào máy bạn.

---

### Bước 5: Cấu Hình Gói Cho Thuê & Nhận Doanh Thu

1. Truy cập vào trang **"Trung Tâm Đối Tác Cung Ứng"** (`/seller`).
2. **Tạo gói cho thuê:**
   - Chọn loại tài nguyên: GPU Compute hoặc Local LLM Streaming.
   - Nhập đơn giá cho thuê theo giờ (Ví dụ: `15,000 VND / giờ` hoặc `0.5 USD / giờ`).
   - Chọn model cung ứng tương ứng với node đang online.
3. **Theo dõi phiên làm việc:**
   - Bảng **"Phiên Cho Thuê Đang Hoạt Động"** sẽ hiển thị các Owner đang kết nối vào máy bạn.
   - Theo dõi số lượng Token mà máy bạn đã tạo ra (Token Generation Rate) và tiền tích lũy tăng dần theo thời gian thực.
4. **Rút doanh thu:**
   - Khi phiên hoàn tất, doanh thu sẽ được cộng vào số dư khả dụng của Seller để thực hiện lệnh rút.

---

## 4. Xử Lý Sự Cố Thường Gặp (Troubleshooting)

| Tình trạng | Nguyên nhân có thể | Cách khắc phục |
| :--- | :--- | :--- |
| Worker báo `Connection Refused` | Distributed Service chưa chạy hoặc sai cổng | Đảm bảo Docker container `distributed-service` đang chạy trên cổng `5010`. |
| Web hiển thị `Chưa phát hiện Worker nào kết nối` | Chưa bấm Start trên app Desktop hoặc khác User ID | Mở app Desktop, kiểm tra nút trạng thái đã chuyển sang `Connected` màu xanh lá chưa. |
| Owner thuê nhưng báo `LLM Timeout` | Ollama bị tắt hoặc đầy bộ nhớ VRAM | Kiểm tra xem `ollama serve` còn chạy ngầm không; kiểm tra lệnh `ollama ps`. |
| Muốn tắt máy để dùng việc cá nhân | Máy tính cần reboot hoặc chơi game | Nhấn **"Tạm Dừng"** trên Web hoặc tắt app Electron trước để hệ thống điều phối sang Seller khác mà không bị trừ điểm uy tín. |
