# Hệ thống Microservices - Tài liệu kiến trúc & Tính năng

Tài liệu này mô tả chi tiết kiến trúc tổng quan và các tính năng cốt lõi đã được tích hợp trong hệ thống Microservices hiện tại (bao gồm `API Gateway` và `User Service`).

---

## 0. API Gateway (`gateway-service`)
Cổng giao tiếp tập trung (Entrypoint) chịu trách nhiệm điều hướng request, bảo mật biên và kiểm soát tải cho toàn bộ hệ thống.

* **Routing & Proxy Management:**
  * Định tuyến thông minh các đường dẫn request từ phía client tới đúng microservice tương ứng (`user-service`, `room-service`, `chat-service`, `agent-service`).
  * Tích hợp proxy cho các kết nối Real-time WebSocket (`/socket.io`).
* **Global Rate Limiting:**
  * Sử dụng `express-rate-limit` kết hợp với `Redis` để giới hạn tần suất request theo IP trên toàn hệ thống (Global Layer).
  * Bảo vệ hệ thống khỏi các cuộc tấn công quét dữ liệu, spam hoặc DDoS ngay từ tầng biên.
* **Gateway Authentication Middleware:**
  * Kiểm tra và xác thực tính hợp lệ của token JWT trước khi cho phép request đi sâu vào các service nội bộ.
* **Header Propagation (Chuyển tiếp định danh):**
  * Tự động bóc tách thông tin người dùng từ JWT và đính kèm vào các headers nội bộ (`x-user-id`, `x-user-role`) để forward xuống các microservices bên dưới, giúp giảm tải việc giải mã token lặp lại ở các service con.

---

## 1. User & Identity Service (`user-service`)
Dịch vụ cốt lõi quản lý định danh người dùng, xác thực, phân quyền và các nghiệp vụ tài khoản bảo mật cao.

### 1.1. Xác thực & Quản lý phiên (Authentication & Session)
* **OAuth 2.0 & Social Login:** Hỗ trợ đăng nhập nhanh chóng, an toàn thông qua tài khoản **Google** và **GitHub**.
* **Account Lifecycle Management:** Cung cấp đầy đủ các API cho việc Đăng ký, Đăng nhập, Quên mật khẩu và Đổi mật khẩu.
* **HttpOnly Cookies:** Lưu trữ bảo mật cho Refresh Token qua HttpOnly Cookies nhằm ngăn chặn tấn công XSS lấy cắp token.
* **Token Rotation & Management:** Cơ chế cấp phát lại access token thông qua refresh token, kết hợp tính năng đăng xuất (`logout`) để vô hiệu hóa phiên làm việc.

### 1.2. Phân quyền hệ thống (Authorization - RBAC)
Hệ thống phân chia quyền hạn rõ ràng theo 4 cấp độ người dùng:
* `guest` (Khách vãng lai): Chỉ được truy cập vào các tài nguyên và thông tin công khai.
* `user` (Người dùng): Có quyền thuê hoặc tự vận hành các mô hình AI cá nhân.
* `seller` (Người bán model): Chịu trách nhiệm cung cấp, đăng tải và vận hành các mô hình AI.
* `admin` (Quản trị viên): Có toàn quyền giám sát, quản lý và kiểm soát toàn bộ hệ thống.

### 1.3. Bảo mật & Hiệu năng (Security & Caching)
* **Service-Level Rate Limiting:** 
  * Áp dụng `authLimiter` cực kỳ nghiêm ngặt (chống Brute-force) cho các endpoint nhạy cảm như Login, Register, Verify OTP, Reset Password.
  * Áp dụng `generalLimiter` cho các API thao tác profile thông thường để chống spam request.
* **Redis Integration:**
  * Lưu trữ và kiểm tra vòng đời của Refresh Token.
  * Quản lý danh sách đen (`Blacklist`) khi người dùng thực hiện đăng xuất để thu hồi quyền truy cập ngay lập tức.

### 1.4. Giao tiếp bất đồng bộ & Nhật ký (Messaging & Auditing)
* **Asynchronous Messaging (RabbitMQ):**
  * Đẩy các tác vụ nặng hoặc cần độ trễ thấp (như gửi email kích hoạt tài khoản, gửi mã xác thực OTP khi quên mật khẩu) vào message queue để xử lý bất đồng bộ, tối ưu hóa thời gian phản hồi cho client.
* **Audit Logging:**
  * Ghi nhận và lưu vết toàn bộ các hành động quan trọng hoặc thay đổi trạng thái của người dùng nhằm phục vụ cho công tác kiểm tra, giám sát bảo mật hệ thống.