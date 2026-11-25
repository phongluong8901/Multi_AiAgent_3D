1. Giao diện tổng hợp Dashboard (Grafana)
Link truy cập: http://localhost:3000

Tài khoản mặc định: admin / admin (Hệ thống sẽ yêu cầu đổi mật khẩu ở lần đăng nhập đầu tiên, bạn có thể bấm Skip).

Công dụng: Đây là nơi bạn xem toàn bộ biểu đồ Metrics (Prometheus), Logs (Loki) và Traces (Tempo) trên cùng một màn hình qua tính năng Explore hoặc Dashboards.

2. Giao diện kiểm tra trực tiếp Metrics (Prometheus)
Link truy cập: http://localhost:9090

Công dụng: Dùng để kiểm tra nhanh trạng thái các target (xem các microservice như user-service đã được Prometheus cào dữ liệu thành công chưa qua mục Status -> Targets) và test các biểu đồ metrics dạng thô.

3. Giao diện quản lý Database & Cache nội bộ
Redis Commander (Quản lý Redis): http://localhost:8081

RabbitMQ Management (Quản lý Queue, Exchange): http://localhost:15672 (Tài khoản: admin / admin123)

Cách xem Traces và Metrics của user-service:
Mở Grafana tại http://localhost:3000.

Vào phần Explore (biểu tượng chiếc la bàn ở menu bên trái).

Xem Traces: Chọn Data Source là Tempo, sau đó bấm Search để xem các luồng request HTTP đi qua user-service mất bao nhiêu mili-giây.

Xem Metrics: Chọn Data Source là Prometheus, gõ các câu lệnh truy vấn như user_service_http_request_duration_seconds_count để xem số lượng request gọi vào service.