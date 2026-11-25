# Kiến Trúc Dự Án: Multi-User & Multi-Agent Virtual 3D Office

## 1. Tổng Quan Hệ Thống

Hệ thống cho phép **nhiều User** tham gia vào các **Phòng làm việc chung (Team Rooms)**, kết nối và điều phối một **Nhóm AI Agent tự chủ** hoạt động trong không gian 3D tương tác. Người dùng có thể ra lệnh chéo cho bất kỳ Agent nào, và các Agent có khả năng tự bàn giao nhiệm vụ (autonomous handoff) cho nhau để hoàn thành mục tiêu phức tạp.

```
                          +------------------------+
                          |   Next.js Frontend     |
                          |  (3D Three.js + SSE)   |
                          +-----------+------------+
                                      | HTTP / SSE / WS
                                      v
                          +------------------------+
                          |      API Gateway       | (Port 4000)
                          +---+--------+--------+--+
                              |        |        |
        +---------------------+        |        +---------------------+
        |                              |                              |
        v                              v                              v
+---------------+             +----------------+             +-----------------+
| User Service  |             |  Room Service  |             |  Chat Service   |
| (Port 5001)   |             |  (Port 5002)   |             |  (Port 5003)    |
| (Auth, Users) |             | (Teams, Rooms) |             | (SSE/WS, Pres)  |
+-------+-------+             +--------+-------+             +--------+--------+
        |                              |                              |
        | Mongo                        | Mongo                        | Mongo
        v                              v                              v
+---------------+             +----------------+             +--------+--------+
|   MongoDB     |             | RabbitMQ Event |<----------->| Agent Service   |
| (27017)       |             | Broker (5672)  |             | (Port 8000)     |
+---------------+             +----------------+             | (LangGraph, AI) |
                                                              +---+--------+----+
                                                                  |        |
                                                                  v        v
                                                             Postgres    Redis
                                                              (5432)     (6379)
```

---

## 2. Các Tính Năng Đã Hoàn Thiện & Nâng Cấp

### A. Làm việc nhóm Đa Agent (Multi-Agent Teamwork)
1. **Phân vai chuyên biệt trong không gian 3D**:
   - `agent_manager` (**Manager Agent**): Nhạc trưởng phân tích yêu cầu, chia nhỏ mục tiêu và điều phối luồng làm việc.
   - `agent_ml` (**ML Expert**): Chuyên gia thuật toán, tính toán số liệu và mô hình máy học.
   - `agent_analyst` (**Data Analyst**): Phân tích hệ thống, cấu trúc dữ liệu và thống kê.
   - `agent_search` (**Search Expert**): Tra cứu tài liệu, kiến thức và thông tin web thời gian thực.
   - `agent_summarizer` (**Summarizer Agent**): Tổng hợp báo cáo, cô đọng ngữ cảnh hội thoại.

2. **Cơ chế Bàn giao Tự chủ (Autonomous Handoff)**:
   - Khi một Agent hoàn thành bước việc của mình và cần sự trợ giúp, nó có thể tag `@agent_id` của đồng nghiệp (ví dụ: Manager tag `@agent_search tra cứu thông tin`, sau đó Search tag `@agent_analyst phân tích`).
   - Hệ thống `AgentDispatcher` tự động phát hiện tag `@agent_id` trong phản hồi và kích hoạt tiếp Agent tương ứng (có giới hạn độ sâu tối đa 3 lượt để tránh lặp vô tận).

### B. Nhiều User vào chung Room (Multi-User Collaboration)
1. **Quản lý Room và Đội ngũ Agent**:
   - Người dùng có thể tạo phòng mới, đặt tên, mô tả và chọn các Agent sẽ làm việc trong phòng đó.
   - Bất kỳ thành viên nào trong phòng cũng có thể thêm hoặc bớt Agent linh hoạt.
2. **Theo dõi Hiện diện Thời gian Thực (Real-Time Presence)**:
   - Hiển thị danh sách người dùng đang online trong phòng qua kết nối Server-Sent Events (SSE) và Socket.IO.
   - Thông báo tức thì khi có đồng đội tham gia hoặc rời phòng.

### C. Ra lệnh Chéo (Cross-Commanding)
1. **Mọi người dùng có quyền chỉ đạo mọi Agent**:
   - Bất kỳ User nào trong phòng đều có thể gán việc trực tiếp cho bất kỳ Agent nào bằng cách gõ `@agent_id` (hỗ trợ menu popup tự động khi gõ `@`).
   - Chọn mục tiêu nhanh qua thanh công cụ: `@all` (cả nhóm) hoặc Agent cụ thể.
2. **Quy trình Team Pipeline 1-Click**:
   - Nút **"🚀 Chạy Team Pipeline"**: Kích hoạt Manager Agent lập kế hoạch, phân công cho Search Expert, ML Expert và Summarizer Agent hoàn thành chuỗi công việc tự động.

### D. Đồng Bộ Trạng Thái 3D Thời Gian Thực
- Khi Agent đang tiếp nhận câu hỏi: Trạng thái hiển thị `thinking` (vòng tròn vàng nhấp nháy).
- Khi Agent đang chạy Tool: Trạng thái hiển thị `working` (vòng tròn xanh lam nhấp nháy, ngồi vào bàn làm việc).
- Khi Agent trả lời: Trạng thái `speaking` (bong bóng thoại 3D hiển thị nội dung trên đầu Agent trong canvas Three.js).

---

## 3. Khởi Chạy Hệ Thống

### Cách 1: Chạy toàn bộ qua Docker Compose (Khuyên dùng)
```bash
cd proj1_MultiAgent/backend-microservices
docker compose up --build -d
```

### Cách 2: Chạy trực tiếp từng service (Development mode)
```bash
# 1. Gateway Service
cd backend-microservices/gateway-service
npm run dev

# 2. User Service
cd backend-microservices/user-service
npm run dev

# 3. Room Service
cd backend-microservices/room-service
npm run dev

# 4. Chat Service
cd backend-microservices/chat-service
npm run dev

# 5. Agent Service
cd backend-microservices/agent-service
.venv\Scripts\activate
uvicorn app.agent_services:app --reload --port 8000

# 6. Frontend
cd frontend-microservices
npm run dev
```

Truy cập giao diện: `http://localhost:3000` (hoặc cổng hiển thị của Next.js).
