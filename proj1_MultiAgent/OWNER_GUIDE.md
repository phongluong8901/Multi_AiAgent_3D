# Hướng Dẫn Dành Cho Owner (Người Thuê GPU & Nạp Local LLM Cho Multi-Agent)

Tài liệu này hướng dẫn chi tiết dành cho **Owner** (Người cần sử dụng tài nguyên AI) để tìm kiếm các máy tính GPU phân tán từ mạng lưới Seller, thuê mô hình ngôn ngữ cục bộ (như Qwen, Llama, DeepSeek) với chi phí thấp, và nạp trực tiếp mô hình vào các AI Agent trong văn phòng ảo 3D.

---

## 1. Lợi Ích Của Việc Thuê Local LLM Thay Vì Dùng API Đám Mây

- **Chi Phí Tối Ưu:** Tiết kiệm lên tới 70% so với việc gọi API thương mại độc quyền (OpenAI GPT-4, Claude Opus).
- **Bảo Mật & Riêng Tư:** Luồng câu lệnh và dữ liệu được mã hóa truyền tải theo cơ chế P2P Stream qua cổng điều hướng, không bị các tập đoàn lớn lưu trữ để huấn luyện lại.
- **Tốc Độ Xử Lý Trực Tuyến:** Mô hình nạp trực tiếp vào bộ nhớ VRAM của Seller chuyên dụng, phản hồi dạng streaming mượt mà cho Multi-Agent Team.

---

## 2. Kiến Trúc Luồng Hoạt Động Của Owner

```
+------------------------------------------------------------------------------------+
|                                    GIAO DIỆN OWNER                                 |
|                                                                                    |
|  +----------------------------+              +----------------------------------+  |
|  | /user-models               |              | /teams & Phòng 3D Văn Phòng Ảo   |  |
|  | - Khám phá Topo 3D         |              | - Ra lệnh chéo (@agent_ml, @all) |  |
|  | - So sánh VRAM/Ping/Giá    |              | - Đồng bộ bong bóng thoại 3D     |  |
|  +--------------+-------------+              +-----------------+----------------+  |
+-----------------|----------------------------------------------|-------------------+
                  | 1. Chọn & Thuê Node                          | 3. Gửi Prompt / Task
                  v                                              v
  +-------------------------------+              +-------------------------------+
  | Owner Service (:5012)         |              | Agent Service (:8000)         |
  | Quản lý Hợp Đồng & Chi Phí    |              | LangGraph Multi-Agent Team    |
  +---------------+---------------+              +---------------+---------------+
                  |                                              |
                  | 2. Kích hoạt phiên P2P                       | 4. Gọi suy luận
                  v                                              v
+------------------------------------------------------------------------------------+
|                            DISTRIBUTED SERVICE (:5010)                             |
|         Định tuyến gói tin Streaming từ Seller Worker (.exe) về cho Owner          |
+------------------------------------------------------------------------------------+
```

---

## 3. Quy Trình 5 Bước Dành Cho Owner

### Bước 1: Kiểm Tra Số Dư Và Quản Lý Ví Thuê

1. Đăng nhập vào hệ thống Web Dashboard: `http://localhost:3000`.
2. Truy cập vào trang **"Bảng Điều Khiển Người Thuê (Owner)"** (`/owner`).
3. Kiểm tra mục **Số Dư Khả Dụng** (Available Balance).
   - Nếu số dư chưa đủ, tiến hành nạp tiền vào tài khoản để sẵn sàng mở phiên thuê.
   - Hệ thống tính phí linh hoạt theo đơn vị giây/giờ thực tế sử dụng.

---

### Bước 2: Khám Phá Mạng Lưới Node Phân Tán Trên Trang Đối Tác

Truy cập vào trang **"Đối Tác Mô Hình"** (`/user-models`):

1. **Khám phá qua Đồ Thị Topo 3D Chiều Sâu:**
   - Chọn tab **"Đồ Thị Topo 3D"**: Xem toàn bộ các máy chủ Seller đang trực tuyến dưới dạng khối đa diện Neon phát sáng trong không gian đa chiều Three.js.
   - Nhấp vào từng Node để xem chi tiết: Tên máy, Địa điểm, Cấu hình GPU, Dung lượng VRAM, Model đang chạy (`qwen2.5:7b`, `deepseek-r1`, ...), và độ trễ Ping mạng.
2. **Tab Kết Nối Seller ⇄ Owner (P2P Streams):**
   - Xem trực quan các phiên làm việc đang truyền tải dữ liệu giữa các máy Seller và Agent của các Owner khác trên mạng lưới.
3. **So sánh thông số:**
   - Lựa chọn Node có **Độ trễ Ping thấp nhất (< 20ms)** và **VRAM đáp ứng đủ nhu cầu** của công việc.

---

### Bước 3: Thuê Tài Nguyên & Khởi Tạo Phiên Làm Việc (Rental Session)

1. Quay lại trang **"Bảng Điều Khiển Người Thuê"** (`/owner`).
2. Chọn gói tài nguyên hoặc Node Seller đã chọn ở Bước 2.
3. Chọn khoảng thời gian thuê dự kiến (hoặc chọn chế độ *Trả theo thời gian thực*).
4. Nhấn **"Xác Nhận Thuê Tài Nguyên"**.
   - Hợp đồng thuê (`RentalSession`) được khởi tạo ngay lập tức.
   - Trạng thái phiên chuyển sang `ACTIVE` kèm theo một phiên làm việc mã hóa được đồng bộ đến Seller.

---

### Bước 4: Nạp Mô Hình Local Vào Nhóm Multi-Agent (Virtual 3D Office)

1. Truy cập vào mục **"Phòng Làm Việc Nhóm"** (`/teams`) hoặc chọn một phòng làm việc 3D hiện có.
2. Mở hộp thoại cấu hình Agent trong phòng:
   - Tại mục **Mô Hình Suy Luận (Inference Engine)**: Thay vì chọn các API mặc định, chọn **"Local LLM (Gói Thuê Đang Hoạt Động)"**.
   - Chọn phiên thuê của bạn (ví dụ: `Session #RS-8402 - Qwen 2.5 7B`).
3. **Thực hiện tương tác:**
   - Ra lệnh cho các Agent: Gõ `@agent_manager lập kế hoạch phân tích dữ liệu quý 4`, hoặc nhấn nút **"Chạy Team Pipeline"**.
   - Agent Manager sẽ tự động suy luận thông qua mô hình Qwen từ máy Seller, sau đó bàn giao tiếp cho `agent_ml`, `agent_search` xử lý.
   - Trên không gian 3D, Agent sẽ hiển thị trạng thái phát sáng (`thinking` vàng, `working` xanh lam) và bong bóng thoại thời gian thực (`speaking`).

---

### Bước 5: Giám Sát Chi Phí & Kết Thúc Phiên Thuê

1. Xem trực tiếp mức tiêu thụ tại trang `/owner`:
   - **Thời gian đã dùng:** Tính theo phút và giây thực tế.
   - **Tổng Token đã sinh:** Lượng token do máy Seller sinh ra và phản hồi về.
   - **Chi phí phát sinh:** Hiển thị minh bạch theo từng phiên.
2. Khi không còn nhu cầu sử dụng:
   - Nhấn nút **"Kết Thúc Phiên"** (Terminate Session) để giải phóng tài nguyên cho Seller.
   - Hệ thống lập tức chốt số tiền thực tế và hoàn trả lại số dư thừa chưa sử dụng vào ví của bạn.

---

## 4. Xử Lý Sự Cố Thường Gặp (Troubleshooting)

| Tình trạng | Nguyên nhân có thể | Cách xử lý |
| :--- | :--- | :--- |
| Thuê thành công nhưng Agent không phản hồi | Node Seller bị mất mạng hoặc Worker bị tắt đột ngột | Kiểm tra tab *Active Rentals* tại `/owner`; nếu Node báo `UNHEALTHY`, hệ thống sẽ tự động hoàn tiền và bạn có thể chuyển sang Node khác. |
| Phản hồi của Agent bị giật / chậm | Node Seller đang chịu tải cao hoặc Ping mạng cao | Chọn các Node có ký hiệu Ping xanh lá (< 30ms) và VRAM còn trống nhiều trên bản đồ Topo 3D. |
| Không tìm thấy Model mong muốn | Hiện chưa có Seller nào chạy model đó | Kiểm tra danh sách trên trang `/user-models`; bạn có thể đăng yêu cầu cấu hình mong muốn lên cộng đồng đối tác. |
