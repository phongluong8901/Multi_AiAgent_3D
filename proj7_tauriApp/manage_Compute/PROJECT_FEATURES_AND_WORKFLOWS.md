# COMPUTE STUDIO & AUTOGUARD - TÀI LIỆU TÍNH NĂNG & WORKFLOW PIPELINE

Tài liệu kỹ thuật tổng hợp toàn bộ các tính năng, kiến trúc đồ thị Workflow (Auto-Guard Canvas) và các kịch bản tự động hóa đã được triển khai trong dự án.

10. **Thanh Theo Dõi Tiến Trình Thực Thi Từng Bước (Interactive Simulation Tracer & Node Visualizer)**:
    - Khi bấm **Test Live** hoặc **Simulate Breach**, hệ thống tự động kích hoạt chế độ trực quan hóa từng bước (Step-by-Step Tracer):
      - **Thanh Điều Khiển Nổi (Floating Tracer Bar)**: Xuất hiện ở đáy canvas hiển thị rõ bước hiện tại (`Step 1/4`, `Step 2/4`...), tên node đang chạy, mô tả chi tiết và thanh tiến trình phần trăm (%).
      - **Hiệu Ứng Chiếu Sáng Node Thời Gian Thực**: Node đang được xử lý sẽ phát sáng với viền vàng hổ phách nhấp nháy (`ring-4 ring-amber-400 animate-pulse`), giúp người dùng quan sát chính xác luồng dữ liệu đang đi tới đâu trên sơ đồ.
      - **Đồng Bộ Nhật Ký Terminal**: Từng bước duyệt node được ghi nhận trực tiếp vào ngăn kéo Console với định dạng `[SIMULATION STEP X/Y]`.
      - **Tự Động Kết Thúc An Toàn**: Khi duyệt hết đồ thị, thanh tracer chuyển sang màu xanh lá (`Completed`) và tự động ẩn sau khi hoàn tất.

---

## 1. TỔNG QUAN KIẾN TRÚC DỰ ÁN

Dự án là nền tảng máy trạm quản lý tài nguyên tính toán (Compute Resource Supervisor) và tự động hóa hệ thống (System Auto-Guard), hoạt động độc lập cả ở chế độ Web lẫn Desktop Shell:
- **Frontend**: React 18, TypeScript, Tailwind CSS, Zustand Store (hỗ trợ LocalStorage Persistence), XYFlow (`@xyflow/react`), Lucide React.
- **Backend**: FastAPI (Python), Uvicorn, psutil, ctypes (Win32 Kernel/PSAPI), pynvml (GPU Nvidia), WebSocket Telemetry Stream.
- **Desktop Shell**: Tauri Rust Shell (hỗ trợ đóng gói desktop app `.exe` và chạy ngầm dưới System Tray).

10. **Thanh Theo Dõi Tiến Trình Thực Thi Từng Bước (Interactive Simulation Tracer & Node Visualizer)**:
    - Khi bấm **Test Live** hoặc **Simulate Breach**, hệ thống tự động kích hoạt chế độ trực quan hóa từng bước (Step-by-Step Tracer):
      - **Thanh Điều Khiển Nổi (Floating Tracer Bar)**: Xuất hiện ở đáy canvas hiển thị rõ bước hiện tại (`Step 1/4`, `Step 2/4`...), tên node đang chạy, mô tả chi tiết và thanh tiến trình phần trăm (%).
      - **Hiệu Ứng Chiếu Sáng Node Thời Gian Thực**: Node đang được xử lý sẽ phát sáng với viền vàng hổ phách nhấp nháy (`ring-4 ring-amber-400 animate-pulse`), giúp người dùng quan sát chính xác luồng dữ liệu đang đi tới đâu trên sơ đồ.
      - **Đồng Bộ Nhật Ký Terminal**: Từng bước duyệt node được ghi nhận trực tiếp vào ngăn kéo Console với định dạng `[SIMULATION STEP X/Y]`.
      - **Tự Động Kết Thúc An Toàn**: Khi duyệt hết đồ thị, thanh tracer chuyển sang màu xanh lá (`Completed`) và tự động ẩn sau khi hoàn tất.

---

## 2. HỆ THỐNG MÀN HÌNH & GIAO DIỆN (WORKBENCH TABS)

1. **Tab Compute Dashboard (Telemetry & Hardware Metrics)**:
   - Biểu đồ thời gian thực: Tải CPU tổng, biểu đồ chi tiết từng Core/Thread, Bộ nhớ RAM (Used/Free/Percent).
   - Card GPU Nvidia: Nhiệt độ (°C), Tỷ lệ sử dụng GPU, Tỷ lệ VRAM.
   - Card Đĩa & Mạng: Dung lượng ổ đĩa khả dụng, tốc độ đọc/ghi Disk IO, băng thông mạng Upload/Download.
   - Luồng WebSocket `:14200/ws/telemetry` cập nhật liên tục mỗi 500ms.

2. **Tab Process Manager & Service Inspector**:
   - Bảng danh sách tiến trình thời gian thực, sắp xếp theo CPU hoặc Memory.
   - Hiệu ứng tương tác trực quan (Hover State): Từng hàng tiến trình và các nút điều khiển có hiệu ứng hover đổi màu nổi bật (`hover:bg-rose-950/90`, border highlight, shadow).
   - Hộp thoại xác nhận an toàn (Confirmation Modal): Khi ấn nút Terminate/Kill, một modal cảnh báo chi tiết sẽ xuất hiện hiển thị tên tiến trình, PID, dung lượng RAM, mức tiêu thụ CPU hiện tại, đồng thời cho phép lựa chọn giữa `Terminate (Graceful - SIGTERM)` và `Force Kill (Immediate - SIGKILL)` để ngăn chặn việc tắt nhầm các tác vụ quan trọng.
   - Nút **Trim RAM** nhanh: Gọi Win32 `EmptyWorkingSet` thu hồi RAM dư thừa của tiến trình ngay lập tức.
   - Nút **Resource Quota & Cores**: Mở modal gán nhân CPU Core Affinity, đặt trần RAM và chính sách xử lý khi vi phạm.
   - Spawn Service: Khởi chạy tiến trình hoặc script nền trực tiếp từ ứng dụng.

3. **Tab Process Detail Live Chart (Đồ thị riêng của từng Tiến trình)**:
   - Mở tab độc lập cho từng PID cụ thể (ví dụ: `chrome.exe [PID 1892] Chart`).
   - Biểu đồ Sparkline thời gian thực, lưu trữ lịch sử tải RAM (MB) và CPU (%) của riêng tiến trình đó.

4. **Tab Auto-Guard Studio (Canvas n8n / Airflow-Style)**:
   - Trọng tâm của hệ thống tự động hóa: Kéo thả các node, nối dây logic, cấu hình ngưỡng bảo vệ và triển khai Watchdog chạy ngầm.

5. **Tab Incident Audit Trail (Nhật Ký Sự Cố Chuyên Sâu & Xuất Báo Cáo)**:
   - Theo dõi toàn bộ lịch sử các sự cố vi phạm ngưỡng bảo vệ an toàn (OOM, High Temp, Port Collision, Process Crash).
   - Bộ lọc đa chiều: Lọc theo mức độ nghiêm trọng (`CRITICAL`, `WARNING`, `INFO`) và thanh tìm kiếm từ khóa thời gian thực.
   - Thẻ thống kê tổng quan (Total Incidents, Critical Alarms, Active Warnings, Resolved Count).
   - Xuất báo cáo chuyên nghiệp: Xuất tức thì ra định dạng **CSV** (cho Excel) hoặc **JSON** (cho SIEM / Logstash).
   - Nút **Capture Diagnostic Frame**: Chụp ảnh màn hình Desktop bằng PowerShell .NET và lưu file trực tiếp vào kho lưu trữ sự cố `backend/app/dumps/`.

6. **Tab System Health Score & AI Advisor (Phân Tích Sức Khỏe & Gợi Ý Tối Ưu)**:
   - Chỉ số sức khỏe tổng quát **System Health Index (0 - 100 điểm)** kèm huy hiệu trạng thái (`OPTIMAL`, `HEALTHY`, `WARNING`, `CRITICAL`).
   - Bảng phân tích chi tiết các yếu tố bị trừ điểm (Score Deductions) như quá tải CPU, bão hòa RAM, hoặc quá nhiệt GPU.
   - Khuyến nghị tối ưu thông minh (AI Remediation Actions): Đề xuất các hành động cụ thể kèm nút bấm thực thi 1-click (ví dụ: Kích hoạt Win32 `EmptyWorkingSet`, hạ độ ưu tiên CPU, gán core affinity).

7. **Tab API & Network Traffic Inspector (Quản Lý & Giám Sát Đường Truyền API Tiến Trình)**:
   - Theo dõi toàn bộ các socket kết nối ra ngoài (Outbound Sockets) và cổng lắng nghe (Listening Ports) của các tiến trình.
   - **Phân giải Hostname & Tên miền (Reverse DNS Lookup)**: Tự động phân giải IP đích sang Domain thật (`api.openai.com`, `cdn.huggingface.co`, `github.com`, `localhost:8000`).
   - **Phân loại Dịch vụ Thông minh (Service Classifier)**:
     - `AI_LLM`: Nhận diện các kết nối tới OpenAI, Anthropic Claude, Hugging Face, DeepSeek, Ollama (`:11434`), vLLM (`:8000`).
     - `CLOUD_API`: Google Cloud, AWS, Microsoft Azure, GitHub API, Cloudflare.
     - `DATABASE`: PostgreSQL (`:5432`), MySQL (`:3306`), Redis (`:6379`), MongoDB (`:27017`).
     - `LOCAL_SERVICE`: Compute Studio Daemon (`:14200`), MLflow (`:5000`), Vite Dev Server (`:5173`).
     - `HTTPS_API`: Kết nối API an toàn cổng 443.
   - **Bản Đồ Kết Nối & Top Contacted Endpoints**: Thống kê các tên miền/API được các tiến trình liên lạc nhiều nhất.
   - **Inspect Sockets 1-Click**: Mở modal chi tiết socket của bất kỳ tiến trình nào ngay trong bảng Process Manager hoặc trong màn hình Network Traffic.

8. **Ngăn Kéo Console Dưới Đáy (Bottom Console & Telemetry Stream)**:
   - **Hỗ trợ Copy Toàn Diện**:
     - Cho phép bôi đen chuột để chọn và copy text trực tiếp (`select-text cursor-text`).
     - Nút **Copy All**: Sao chép toàn bộ nhật ký telemetry vào Clipboard chỉ với 1 click kèm trạng thái `Copied`.
     - Nút **Copy Từng Dòng**: Tự động hiển thị icon sao chép khi rê chuột (hover) vào từng dòng log riêng lẻ.
   - Tích hợp **MiniMap** bên phải chung hàng khi đang làm việc trên Canvas.

10. **Thanh Theo Dõi Tiến Trình Thực Thi Từng Bước (Interactive Simulation Tracer & Node Visualizer)**:
    - Khi bấm **Test Live** hoặc **Simulate Breach**, hệ thống tự động kích hoạt chế độ trực quan hóa từng bước (Step-by-Step Tracer):
      - **Thanh Điều Khiển Nổi (Floating Tracer Bar)**: Xuất hiện ở đáy canvas hiển thị rõ bước hiện tại (`Step 1/4`, `Step 2/4`...), tên node đang chạy, mô tả chi tiết và thanh tiến trình phần trăm (%).
      - **Hiệu Ứng Chiếu Sáng Node Thời Gian Thực**: Node đang được xử lý sẽ phát sáng với viền vàng hổ phách nhấp nháy (`ring-4 ring-amber-400 animate-pulse`), giúp người dùng quan sát chính xác luồng dữ liệu đang đi tới đâu trên sơ đồ.
      - **Đồng Bộ Nhật Ký Terminal**: Từng bước duyệt node được ghi nhận trực tiếp vào ngăn kéo Console với định dạng `[SIMULATION STEP X/Y]`.
      - **Tự Động Kết Thúc An Toàn**: Khi duyệt hết đồ thị, thanh tracer chuyển sang màu xanh lá (`Completed`) và tự động ẩn sau khi hoàn tất.

---

## 3. DANH SÁCH CÁC LOẠI NODE TRONG AUTO-GUARD CANVAS

### 3.1. ScheduleTriggerNode (Thẻ Lập Lịch Định Kỳ - Periodic Watchdog)
- **Mục đích**: Điểm bắt đầu chu kỳ quét tự động của hệ thống.
- **Tính năng**:
  - Chọn chu kỳ quét linh hoạt (Interval): `1.0s` (Tức thời), `2.5s` (Tiêu chuẩn), `5.0s`, `10.0s`, hoặc nhập số giây tùy chỉnh.
  - Hỗ trợ biểu thức lập lịch Cron (ví dụ `*/5 * * * *`).
  - Hiệu ứng nhịp đập Pulse và hiển thị số chu kỳ quét thực tế (`Ticks: 148`).
  - Nút **Tick Now**: Kích hoạt thủ công 1 chu kỳ kiểm tra ngay lập tức.
  - Cổng ra (Right Handle) nối sang `ProcessNode`, `ConditionNode`, hoặc `AlertNode`.

### 3.2. ProcessNode (Thẻ Tiến Trình Hệ Thống)
- **Mục đích**: Gắn kết một tiến trình Windows cụ thể vào chuỗi giám sát.
- **Tính năng**:
  - Tự động nhận diện PID, Tên tiến trình, RAM (MB), CPU (%), Trạng thái và Cổng mạng (Port) đang lắng nghe.
  - Tích hợp biểu đồ Sparkline mini đo tải trực tiếp trên thân thẻ.
  - Nút điều khiển nhanh: Suspend, Resume, Terminate.
  - Nút **Trim RAM**: Kích hoạt giải phóng Working Set RAM của tiến trình qua Win32 API.
  - Click vào tiêu đề để mở ngay tab đồ thị chuyên sâu của tiến trình đó.

### 3.3. ConditionNode (Router - Rẽ Nhánh Điều Kiện If / Else)
- **Mục đích**: Điều hướng luồng logic theo điều kiện logic (chuẩn n8n/Node-RED).
- **Tính năng**:
  - So sánh theo `% Hệ Thống` (CPU, RAM, GPU) hoặc `Process Cụ Thể` (RAM MB, CPU %).
  - Toán tử so sánh: `>`, `>=`, `<`, `<=`, `==`.
  - Hai cổng ra riêng biệt:
    - **Nhánh TRUE (Xanh lá)**: Chuyển tiếp các hành động khi điều kiện thỏa mãn.
    - **Nhánh FALSE (Đỏ)**: Chuyển tiếp các hành động khi điều kiện không thỏa mãn.
  - Badge trạng thái live reading hiển thị rõ ràng nhánh đang được kích hoạt.

### 3.4. LogicGateNode (Cổng Gộp Tín Hiệu AND / OR)
- **Mục đích**: Kết hợp nhiều điều kiện cảnh báo từ nhiều nguồn khác nhau.
- **Tính năng**:
  - Hai cổng vào `In-A` và `In-B`, một cổng ra `Out`.
  - **Cổng AND**: Chỉ khi cả 2 điều kiện cùng vi phạm thì mới kích hoạt hành động can thiệp (lọc hiện tượng tải tăng đột biến tạm thời - Spike Filter).
  - **Cổng OR**: Bất kỳ điều kiện nào vi phạm đều chuyển tiếp hành động.

### 3.5. MetricTriggerNode (Alert Guard)
- **Mục đích**: Giám sát và kích hoạt sự kiện vi phạm ngưỡng bảo vệ an toàn.
- **Tính năng**:
  - Hỗ trợ 2 phạm vi đo lường:
    - **% Hệ Thống**: % CPU toàn máy, % RAM toàn máy, % VRAM GPU, Nhiệt độ GPU (°C).
    - **Process Tự Đặt**: RAM Tiến trình (MB) (ví dụ: `500` MB, `2048` MB), % CPU Tiến trình.
  - **Chẩn đoán Rò rỉ Bộ nhớ Sớm (`memory_leak_slope`)**: Thuật toán phân tích độ dốc RAM qua 5 chu kỳ liên tiếp, phát hiện sớm nguy cơ rò rỉ trước khi tràn RAM (OOM).
  - **Giám sát Xung đột Cổng mạng (`port_collision`)**: Socket probe kiểm tra cổng mạng dịch vụ (8000, 8080, 3000, 5000) có bị chiếm dụng không.
  - Hai chế độ hiển thị:
    - `Realtime`: Luôn hiện đồ thị thanh live meter và chỉ số thời gian thực.
    - `Alert Only`: Thu gọn thẻ khi an toàn, tự động bung ra cảnh báo khi bị vi phạm.
  - Nút **Test Breach**: Giả lập sự cố vượt ngưỡng tức thời để test toàn bộ hành động phía sau mà không cần làm lag máy.

### 3.6. ServiceActionNode (Hành Động Can Thiệp & Tối Ưu Hệ Thống)
- **Mục đích**: Tự động thực thi can thiệp lên tiến trình hoặc hệ thống.
- **Hành động hỗ trợ**:
  - **Thu Hồi RAM (`trim_memory`)**: Gọi Win32 `EmptyWorkingSet` giải phóng RAM thừa ngay mà không làm gián đoạn hay tắt ứng dụng.
  - **Đổi Mức Độ Ưu Tiên CPU (`set_priority`)**: Hạ mức ưu tiên xuống `IDLE` hoặc `BELOW_NORMAL` để tránh treo đơ desktop.
  - **Gán Core CPU (`set_affinity`)**: Giới hạn tiến trình chỉ chạy trên các nhân CPU được chỉ định (ví dụ Core 0, 1).
  - **Giải Phóng Cổng Mạng (`release_port`)**: Tự động giải phóng cổng mạng đang bị treo hoặc chiếm dụng.
  - **Điều Khiển OS**: `suspend_pid`, `terminate_pid`, `kill_pid`, `resume_pid`.
  - **Giám Sát**: Mở tab đồ thị (`open_dashboard`), Giám sát Socket Dạng Text (`live_log_stream`).
  - **Thực thi Lệnh**: `spawn_command` (chạy script fallback hoặc lệnh hệ thống).
  - Nút **Run Action**: Cho phép click test trực tiếp hành động ngay trên thẻ.

### 3.7. AutomationNode (PC Automation Card)
- **Mục đích**: Tự động hóa tác vụ trên Windows Desktop khi xảy ra sự cố.
- **Hành động hỗ trợ**:
  - **Mở Chrome Tra Cứu Sự Cố (`search_google`)**: Tự động bật trình duyệt Google Chrome với từ khóa tìm nguyên nhân lỗi chính xác theo tên tiến trình (ví dụ: `How to fix chrome.exe memory leak Windows`).
  - **Mở Thư Mục Windows Explorer (`open_folder`)**: Mở thư mục logs, dump hoặc thư mục làm việc của tiến trình.
  - **Mở Task Manager (`open_taskmgr`)**: Khởi chạy Windows Task Manager.
  - **Chạy Lệnh PowerShell (`spawn_command`)**: Chạy script Windows PowerShell / Batch.
  - Nút **Test Action**: Kiểm thử trực tiếp hành động, mở trình duyệt hoặc folder thật và ghi log chi tiết.

### 3.8. WebhookNotificationNode (Thẻ Thông Báo Tự Động Từ Xa - Remote Webhook Alert)
- **Mục đích**: Tự động gửi cảnh báo khẩn cấp đến thiết bị di động của người dùng khi hệ thống xảy ra sự cố (vượt ngưỡng nhiệt độ GPU, tràn RAM OOM, xung đột cổng mạng).
- **Nền tảng hỗ trợ**:
  - **Discord Webhook**: Gửi tin nhắn Rich Embed trực tiếp vào server/channel quản trị.
  - **Telegram Bot**: Nhập Bot Token & Chat ID, gửi tin nhắn cảnh báo tức thì về điện thoại qua Telegram Bot API.
  - **Slack Incoming Webhook**: Gửi thông báo đến kênh Slack của đội ngũ vận hành.
- **Tính năng**:
  - Tự động đính kèm thông tin: Tên tiến trình, PID, loại sự cố (Memory Leak, High CPU, GPU Thermal), thời điểm xảy ra.
  - Nút **Test Webhook**: Bấm nút gửi thử nghiệm trực tiếp ngay trên canvas mà không cần chờ sự cố thật.
  - Tùy biến nội dung tin nhắn cảnh báo và tùy chọn bật/tắt gửi thông báo khi có sự cố.

### 3.9. ResourceQuotaNode (Thẻ Phân Bổ & Giới Hạn Tài Nguyên - Resource Quota & Sandbox Jail)
- **Mục đích**: Giới hạn và phân chia tài nguyên độc quyền (CPU Cores, RAM Cap, CPU Bandwidth, GPU Index) cho từng tiến trình cụ thể.
- **Tính năng & Giám Sát Thời Gian Thực (Live Hardware Allocation Monitor)**:
  - **Hiển Thị Tài Nguyên Thực Tế Khi Đang Chạy**: Khi được kết nối với tiến trình, thẻ tự động hiển thị bảng đồng hồ thời gian thực:
    - **Active CPU Cores**: Liệt kê các nhân CPU được chỉ định (`C0, C1...`), tỷ lệ % CPU hiện tại và thanh tải trực quan so với trần Max CPU %.
    - **Current RAM Used vs Cap**: Hiển thị chính xác dung lượng RAM tiến trình đang chiếm dụng (`420 MB / 2048 MB (21%)`) kèm thanh tiến trình màu động (xanh lá an toàn, vàng cảnh báo > 80%, đỏ khi vượt trần).
    - **GPU Allocation**: Nhận diện card GPU chỉ định (ví dụ: `NVIDIA GeForce RTX (51°C | 1240MB VRAM)`) hoặc chế độ chia sẻ `All GPUs`.
    - **Huy hiệu Trạng Thái**: `BOUND TO PID <number>` (chấm xanh nhấp nháy) hoặc `STANDBY`.
  - **Gán Nhân CPU Độc Quyền (Dedicated Cores)**: Chọn checklist nhân (Core 0, 1, 2, 3...) cách ly tiến trình nặng không làm đơ giật các nhân OS khác.
  - **Giới Hạn Trần RAM (Max RAM Cap MB)**: Đặt hạn mức bộ nhớ vật lý tối đa (ví dụ `2048 MB`, `4096 MB`).
  - **Giới Hạn Băng Thông CPU (Max CPU %)**: Đặt trần công suất CPU (ví dụ tối đa `40%`).
  - **Chỉ Định GPU (GPU Device Assignment)**: Gán GPU 0 / GPU 1 (`CUDA_VISIBLE_DEVICES`).
  - **Chính Sách Khi Vi Phạm (Breach Policy)**:
    - `TRIM_AND_THROTTLE`: Tự động thu hồi RAM dư thừa bằng Win32 `EmptyWorkingSet` và hạ mức ưu tiên CPU xuống `IDLE`.
    - `SUSPEND`: Tạm dừng tiến trình cho đến khi tài nguyên an toàn.
    - `KILL`: Cưỡng chế dừng tiến trình vi phạm.
    - `LOG_ONLY`: Chỉ ghi nhận sự cố và gửi thông báo.
  - Nút **Enforce Quota Now**: Áp dụng hạn mức tức thời ngay trên canvas.
  - Nút **Clear Limits**: Gỡ bỏ giới hạn và trả lại 100% tài nguyên cho tiến trình.

---

## 4. CÁC TÍNH NĂNG NÂNG CAO TRÊN CANVAS

1. **Thanh Co Giãn Kích Thước (NodeResizer)**:
   - Tất cả các thẻ trên canvas đều có thể kéo thả viền và góc để co giãn kích thước to nhỏ tự do theo ý muốn.
2. **Tự Động Căn Chỉnh Sơ Đồ (Auto-Layout DAG)**:
   - Nút Auto Layout trên thanh Toolbar tự động tính toán bậc phụ thuộc của đồ thị và sắp xếp các node thành hàng lối khoa học, ngăn nắp.
3. **Sao Lưu & Phục Hồi (Export & Import JSON)**:
   - Nút Export JSON tải toàn bộ cấu hình đồ thị về máy tính dưới dạng file `.json`.
   - Nút Import JSON đọc file JSON và khôi phục lại cấu hình pipeline bất cứ lúc nào.
4. **Bản Đồ Thu Nhỏ (MiniMap Tích Hợp Cùng Hàng Với Log)**:
   - MiniMap được chuyển xuống bố trí cùng hàng bên phải của ngăn kéo `Bottom Console`, chia sẻ không gian với luồng Terminal Logs khi đang mở tab Workflow Canvas.
   - Giúp toàn bộ bề mặt Canvas bên trên hoàn toàn thông thoáng, không còn bị MiniMap đè hay che khuất các node và cổng nối dây.
   - Khi chuyển sang các tab khác (Dashboard, Process Inspector), ngăn kéo Console tự động mở rộng 100% chiều ngang cho Log.
5. **Lưu Trữ Bền Vững (LocalStorage Persistence)**:
   - Toàn bộ vị trí node, dây nối, tham số cấu hình được lưu tự động. Người dùng chuyển qua lại giữa các tab (Dashboard, Process Chart, Canvas) mà không bao giờ bị mất trạng thái.
6. **Xóa Dây Nối Nhanh**:
   - Nhấp chuột trực tiếp vào bất kỳ đường dây nối nào trên màn hình để xóa liên kết ngay lập tức.
7. **Hai Chế Độ Kiểm Thử (Test Live vs Simulate Breach)**:
   - `Test Live`: Đánh giá trạng thái thực tế xem máy tính có đang vượt ngưỡng hay không.
   - `Simulate Breach`: Ép kích hoạt sự kiện vượt ngưỡng để kiểm tra trọn vẹn toàn bộ chuỗi hành động và tự động hóa.
8. **Triển Khai Watchdog Chạy Ngầm (Deploy Watchdog)**:
   - Nút Deploy Watchdog kích hoạt vòng lặp nền trong backend với chu kỳ Polling đã chọn, liên tục giám sát và tự can thiệp khi có sự cố.
9. **Bảng Danh Mục Node Bên Phải (Collapsible Node Palette Sidebar)**:
   - Toàn bộ danh mục tạo thẻ (Triggers, Logic, Monitors, Actions, Webhooks) được chuyển gọn vào Sidebar bên phải có thể thu phóng linh hoạt.
   - Thanh công cụ phía trên thu gọn hoàn toàn, không còn hiện tượng tràn ngang màn hình hay phải cuộn ngang.
   - Tích hợp thanh tìm kiếm thẻ thông minh (Search Filter), huy hiệu màu theo vai trò và khu vực Quick Tabs (Dashboard, Incidents, Health, Clear Canvas).

10. **Thanh Theo Dõi Tiến Trình Thực Thi Từng Bước (Interactive Simulation Tracer & Node Visualizer)**:
    - Khi bấm **Test Live** hoặc **Simulate Breach**, hệ thống tự động kích hoạt chế độ trực quan hóa từng bước (Step-by-Step Tracer):
      - **Thanh Điều Khiển Nổi (Floating Tracer Bar)**: Xuất hiện ở đáy canvas hiển thị rõ bước hiện tại (`Step 1/4`, `Step 2/4`...), tên node đang chạy, mô tả chi tiết và thanh tiến trình phần trăm (%).
      - **Hiệu Ứng Chiếu Sáng Node Thời Gian Thực**: Node đang được xử lý sẽ phát sáng với viền vàng hổ phách nhấp nháy (`ring-4 ring-amber-400 animate-pulse`), giúp người dùng quan sát chính xác luồng dữ liệu đang đi tới đâu trên sơ đồ.
      - **Đồng Bộ Nhật Ký Terminal**: Từng bước duyệt node được ghi nhận trực tiếp vào ngăn kéo Console với định dạng `[SIMULATION STEP X/Y]`.
      - **Tự Động Kết Thúc An Toàn**: Khi duyệt hết đồ thị, thanh tracer chuyển sang màu xanh lá (`Completed`) và tự động ẩn sau khi hoàn tất.

---

## 5. CÁC KỊCH BẢN TỰ ĐỘNG HÓA MẪU (PIPELINE PROFILES / PRESETS)

Dự án đã tích hợp sẵn các kịch bản mẫu trong menu **Presets**:

1. **Smart Leak Trend & Auto Trim**:
   - `chrome.exe` &rarr; `Alert (Slope Trend tăng 5 chu kỳ)` &rarr; `Win32 EmptyWorkingSet Trim RAM` &rarr; `Mở Chrome tra cứu fix`.
   - Ứng dụng: Tự động thu hồi RAM rò rỉ của trình duyệt hoặc worker mà không cần tắt ứng dụng.

2. **Production Scheduled Watchdog (Setup Thực Tế Cho Dự Án)**:
   - `Schedule (2s)` &rarr; `chrome.exe` &rarr; `Alert (RAM > 2000 MB)` &rarr; `Live Socket Stream` &rarr; `Mở Chrome tìm giải pháp`.
   - Ứng dụng: Mô hình chuẩn dự án giám sát định kỳ tiến trình tải nặng.

3. **Conditional Router (If/Else True & False Branching)**:
   - `chrome.exe` &rarr; `Condition Router (RAM >= 2000 MB)`:
     - Nhánh True: `Terminate Process` &rarr; `Chrome Search Fix`.
     - Nhánh False: `Live Socket Stream`.
   - Ứng dụng: Phân nhánh hành vi xử lý tùy theo mức độ nghiêm trọng của tài nguyên.

4. **Port Collision Watchdog**:
   - `Schedule (2s)` &rarr; `Alert (Cổng 8000 bị chiếm)` &rarr; `Service Action (Release Port 8000)`.
   - Ứng dụng: Giám sát và giải phóng cổng mạng dịch vụ khi bị treo hoặc xung đột.

5. **GPU Thermal & VRAM Guard**:
   - `HeavyMLWorker.exe` &rarr; `Alert (Nhiệt độ GPU >= 80°C)` &rarr; `Suspend PID` &rarr; `Chrome Search Fix`.
   - Ứng dụng: Bảo vệ an toàn nhiệt độ phần cứng khi train model Machine Learning / Deep Learning.

6. **PC Automation: Chrome Search & Folder Dump**:
   - `MemoryLeakService.exe` &rarr; `Alert (RAM Hệ thống >= 85%)` &rarr; `Terminate PID` &rarr; `Mở Folder Logs & Search Google`.

10. **Thanh Theo Dõi Tiến Trình Thực Thi Từng Bước (Interactive Simulation Tracer & Node Visualizer)**:
    - Khi bấm **Test Live** hoặc **Simulate Breach**, hệ thống tự động kích hoạt chế độ trực quan hóa từng bước (Step-by-Step Tracer):
      - **Thanh Điều Khiển Nổi (Floating Tracer Bar)**: Xuất hiện ở đáy canvas hiển thị rõ bước hiện tại (`Step 1/4`, `Step 2/4`...), tên node đang chạy, mô tả chi tiết và thanh tiến trình phần trăm (%).
      - **Hiệu Ứng Chiếu Sáng Node Thời Gian Thực**: Node đang được xử lý sẽ phát sáng với viền vàng hổ phách nhấp nháy (`ring-4 ring-amber-400 animate-pulse`), giúp người dùng quan sát chính xác luồng dữ liệu đang đi tới đâu trên sơ đồ.
      - **Đồng Bộ Nhật Ký Terminal**: Từng bước duyệt node được ghi nhận trực tiếp vào ngăn kéo Console với định dạng `[SIMULATION STEP X/Y]`.
      - **Tự Động Kết Thúc An Toàn**: Khi duyệt hết đồ thị, thanh tracer chuyển sang màu xanh lá (`Completed`) và tự động ẩn sau khi hoàn tất.

---

7. **Remote Webhook Notifier & Incident Screen Capture**:
   - `Schedule (2s)` &rarr; `chrome.exe` &rarr; `Alert (RAM >= 2000 MB)` &rarr; `Win32 EmptyWorkingSet Trim RAM` &rarr; `Webhook Notifier (Discord / Telegram)`.
   - Ứng dụng: Giám sát máy tính qua đêm khi train model ML, render đồ họa 3D hoặc chạy bot tự động; khi có sự cố, hệ thống tự động xử lý và gửi thông báo về điện thoại kèm nhật ký sự cố.

10. **Thanh Theo Dõi Tiến Trình Thực Thi Từng Bước (Interactive Simulation Tracer & Node Visualizer)**:
    - Khi bấm **Test Live** hoặc **Simulate Breach**, hệ thống tự động kích hoạt chế độ trực quan hóa từng bước (Step-by-Step Tracer):
      - **Thanh Điều Khiển Nổi (Floating Tracer Bar)**: Xuất hiện ở đáy canvas hiển thị rõ bước hiện tại (`Step 1/4`, `Step 2/4`...), tên node đang chạy, mô tả chi tiết và thanh tiến trình phần trăm (%).
      - **Hiệu Ứng Chiếu Sáng Node Thời Gian Thực**: Node đang được xử lý sẽ phát sáng với viền vàng hổ phách nhấp nháy (`ring-4 ring-amber-400 animate-pulse`), giúp người dùng quan sát chính xác luồng dữ liệu đang đi tới đâu trên sơ đồ.
      - **Đồng Bộ Nhật Ký Terminal**: Từng bước duyệt node được ghi nhận trực tiếp vào ngăn kéo Console với định dạng `[SIMULATION STEP X/Y]`.
      - **Tự Động Kết Thúc An Toàn**: Khi duyệt hết đồ thị, thanh tracer chuyển sang màu xanh lá (`Completed`) và tự động ẩn sau khi hoàn tất.

---

8. **Resource Partitioning (CPU Cores & RAM Hard Quota)**:
   - `Schedule (2s)` &rarr; `HeavyMLWorker.exe` &rarr; `Resource Quota (Cores [0,1,2,3], RAM Max 2500MB, CPU 45%, Policy: TRIM_AND_THROTTLE)` &rarr; `Webhook Notifier`.
   - Ứng dụng: Giới hạn không gian tài nguyên cho tiến trình nặng, ngăn ngừa vắt kiệt máy tính và cảnh báo từ xa khi vượt ngưỡng.

10. **Thanh Theo Dõi Tiến Trình Thực Thi Từng Bước (Interactive Simulation Tracer & Node Visualizer)**:
    - Khi bấm **Test Live** hoặc **Simulate Breach**, hệ thống tự động kích hoạt chế độ trực quan hóa từng bước (Step-by-Step Tracer):
      - **Thanh Điều Khiển Nổi (Floating Tracer Bar)**: Xuất hiện ở đáy canvas hiển thị rõ bước hiện tại (`Step 1/4`, `Step 2/4`...), tên node đang chạy, mô tả chi tiết và thanh tiến trình phần trăm (%).
      - **Hiệu Ứng Chiếu Sáng Node Thời Gian Thực**: Node đang được xử lý sẽ phát sáng với viền vàng hổ phách nhấp nháy (`ring-4 ring-amber-400 animate-pulse`), giúp người dùng quan sát chính xác luồng dữ liệu đang đi tới đâu trên sơ đồ.
      - **Đồng Bộ Nhật Ký Terminal**: Từng bước duyệt node được ghi nhận trực tiếp vào ngăn kéo Console với định dạng `[SIMULATION STEP X/Y]`.
      - **Tự Động Kết Thúc An Toàn**: Khi duyệt hết đồ thị, thanh tracer chuyển sang màu xanh lá (`Completed`) và tự động ẩn sau khi hoàn tất.

---

## 6. DANH SÁCH REST API & WEBSOCKET ENDPOINTS

### 6.1. Quản lý Tiến trình & Hạn Mức Tài Nguyên (Process & Resource Quota Routes - `/api/rest/processes`)
- `GET /api/rest/processes?limit=30&sort_by=memory`: Lấy danh sách tiến trình đang chạy.
- `POST /api/rest/processes/{pid}/{action}`: Gửi tín hiệu điều khiển (`kill`, `terminate`, `suspend`, `resume`).
- `POST /api/rest/processes/{pid}/trim-memory`: Thu hồi RAM Working Set bằng Win32 API.
- `POST /api/rest/processes/{pid}/priority`: Điều chỉnh độ ưu tiên CPU (`idle`, `below_normal`, `normal`, `high`).
- `POST /api/rest/processes/{pid}/affinity`: Gán danh sách nhân CPU (Cores Affinity).
- `POST /api/rest/processes/{pid}/quota`: Áp dụng hạn mức tài nguyên (Cores, RAM Cap, CPU Limit, Policy) cho PID.
- `GET /api/rest/processes/{pid}/quota`: Lấy thông tin hạn mức tài nguyên đang áp dụng của PID.
- `DELETE /api/rest/processes/{pid}/quota`: Gỡ bỏ hạn mức tài nguyên và khôi phục hoạt động bình thường.
- `GET /api/rest/processes/quotas/list`: Danh sách tất cả các tiến trình đang bị giám sát theo Quota.
- `POST /api/rest/processes/quotas/enforce`: Quét và ép thực thi ngay các hành động can thiệp nếu có tiến trình vượt Quota.
- `POST /api/rest/processes/ports/release`: Quét và giải phóng cổng mạng đang bị chiếm dụng.
- `POST /api/rest/processes/spawn`: Khởi chạy tiến trình mới.

### 6.2. Workflow Engine, Incidents & Webhook Routes - `/api/rest/workflows`
- `GET /api/rest/workflows/guard/status`: Lấy trạng thái Auto-Guard, số lần can thiệp, số chu kỳ Ticks và danh sách Schedule đang chạy.
- `POST /api/rest/workflows/guard/toggle`: Bật/Tắt chế độ khiên bảo vệ Auto-Guard.
- `POST /api/rest/workflows/run-once`: Thực thi thử nghiệm 1 chu kỳ kiểm tra đồ thị (hỗ trợ cờ `force_breach: true`).
- `POST /api/rest/workflows/deploy`: Triển khai đồ thị thành luồng Watchdog chạy ngầm liên tục theo chu kỳ.
- `POST /api/rest/workflows/{workflow_id}/stop`: Dừng luồng Watchdog chạy ngầm.
- `POST /api/rest/workflows/action/test`: Kiểm thử thực thi tức thời một hành động can thiệp hoặc PC automation.
- `GET /api/rest/workflows/logs`: Lấy lịch sử 50 sự kiện can thiệp gần nhất.
- `GET /api/rest/workflows/incidents`: Lấy danh sách nhật ký sự cố chi tiết (hỗ trợ lọc theo mức độ `CRITICAL`, `WARNING`, `INFO`).
- `GET /api/rest/workflows/incidents/export?format=csv|json`: Xuất file báo cáo sự cố định dạng CSV hoặc JSON.
- `POST /api/rest/workflows/incidents/capture-screen`: Chụp ảnh màn hình Desktop bằng PowerShell .NET và lưu vào `backend/app/dumps/`.
- `POST /api/rest/workflows/notifications/test`: Gửi tin nhắn kiểm thử đến Telegram, Discord Webhook, hoặc Slack.

### 6.3. Telemetry Stream, Health Advisor & Memory Partitions - `/api/rest/system`
- `GET /api/rest/system/info`: Thông tin tĩnh về CPU, GPU, OS, RAM.
- `GET /api/rest/system/health`: Điểm số sức khỏe toàn diện (0 - 100), các yếu tố trừ điểm và danh sách đề xuất khắc phục từ AI Advisor.
- `GET /api/rest/system/partitions`: Truy vấn trạng thái toàn diện các phân vùng bộ nhớ và lưu trữ hệ thống (RAM Working Set, Standby List Cache, Kernel Paged/Nonpaged Pool, Swap Pagefile, SSD/HDD Disks, %TEMP% Cache, Crash Dumps).
- `POST /api/rest/system/partitions/purge`: Kích hoạt hành động dọn dẹp an toàn theo từng vùng nhớ (`flush_standby_list`, `trim_all_working_sets`, `purge_temp_dir`, `purge_dumps_dir`).
- `WS /ws/telemetry`: Kênh WebSocket phát sóng liên tục gói dữ liệu phần cứng và tiến trình mỗi 500ms.

---

## 7. CÁC TÍNH NĂNG MỚI ĐÃ HOÀN TẤT VÀ KIỂM ĐỊNH

### 7.1. Quản Trị Phân Vùng Bộ Nhớ Hệ Thống (Memory & Storage Partition Manager)
- **Vị trí tab**: `Memory & Partitions` (truy cập từ Sidebar Explorer hoặc TabBar).
- **8 phân vùng được phân loại chi tiết**:
  1. `RAM Working Set`: Bộ nhớ vật lý đang hoạt động trực tiếp của các ứng dụng người dùng. Hỗ trợ 1-click thu hồi (Trim Working Sets).
  2. `RAM Standby Cache`: Vùng đệm cache Windows Standby List. Hỗ trợ giải phóng an toàn giải phóng dung lượng RAM chờ mà không làm crash ứng dụng.
  3. `RAM Kernel Paged Pool`: Vùng nhớ nhân hệ điều hành có thể swap ra đĩa.
  4. `RAM Kernel Non-Paged Pool`: Vùng nhớ nhân tối quan trọng, luôn khóa trong RAM vật lý.
  5. `Swap / Virtual Memory`: Bộ nhớ ảo Pagefile trên đĩa cứng.
  6. `Physical Storage Disks (SSD/HDD)`: Danh sách các ổ đĩa `C:`, `D:`, dung lượng tổng, dung lượng trống và tỉ lệ chiếm dụng (%).
  7. `%TEMP% Files Cache`: Bộ nhớ tạm thời của các ứng dụng và trình cài đặt trong thư mục `%TEMP%`. Hỗ trợ dọn dẹp an toàn các file cũ hơn 1 giờ.
  8. `Crash Dumps & Error Logs`: File kết xuất sự cố `.dmp` và nhật ký lỗi. Hỗ trợ xóa hoàn toàn để lấy lại dung lượng lưu trữ.
- **Hộp thoại xác nhận an toàn (Purge Confirmation Modal)**: Cảnh báo chi tiết mức độ tác động trước khi thực hiện dọn dẹp, đảm bảo an toàn tuyệt đối cho hệ thống.

### 7.2. Hiển Thị Địa Chỉ URL Đích / Endpoint Trong Socket Inspector
- Trong cả 2 màn hình **OS Process & Port Inspector** và **API & Network Traffic**, khi mở modal kiểm tra kết nối mạng (Socket Inspector):
  - Bổ sung cột **TARGET URL / ENDPOINT** với liên kết click mở URL trực tiếp.
  - Tự động nhận diện giao thức và phân loại endpoint: `https://...` (Cloud / External API), `http://...` (Local Service / Dev Server), `postgres://...`, `redis://...`, `tcp://...`.
  - Hiển thị vai trò của kết nối: `Outbound API Call`, `Listening Service`, hoặc `Peer Connection`.

### 7.3. Trực Quan Hóa Tiến Trình Thực Thi Trực Tiếp Trên Thẻ Card & Dây Nối (Card-Level Execution Progress)
- **Hiển thị trực tiếp trên đầu mỗi thẻ (Direct Card Header Banner)**:
  - Khi node đang được đánh giá (`running`): Xuất hiện thanh banner màu vàng hổ phách nhấp nháy `EVALUATING IN PROGRESS...` cùng icon spinner `Activity`, viền card phát sáng với hiệu ứng `ring-4 ring-amber-400`.
  - Khi node thỏa mãn điều kiện hoặc hoàn tất hành động (`success`): Banner chuyển sang xanh ngọc `STEP PASSED & TRIGGERED` kèm icon `CheckCircle2` và viền xanh lục.
  - Khi điều kiện không thỏa mãn hoặc rẽ nhánh an toàn (`skipped`): Banner hiển thị `EVALUATED: SAFE / SKIPPED` với icon khiên bảo vệ `ShieldCheck`.
  - Khi phát sinh lỗi (`failed`): Banner hiển thị `STEP EXECUTION FAILED` với icon `AlertTriangle` và viền đỏ cảnh báo.
- **Chiếu sáng dây nối theo luồng thời gian thực (Active Wire Illumination)**:
  - Dây dẫn dẫn tín hiệu vào node đang xử lý sẽ đổi màu vàng cam rực rỡ (`stroke: #f59e0b`, `strokeWidth: 3`) và chạy xung động `animated`.
  - Sau khi node hoàn tất, dây chuyển sang màu xanh ngọc (`stroke: #10b981`), tạo cảm giác như dòng điện đang chạy sống động qua từng mắt xích.
  - Tự động hoàn nguyên trạng thái ban đầu sau 6 giây hoặc khi người dùng đóng tracer bar.

### 7.4. Phân Tầng Kiến Trúc DAG (START - MIDDLE - END) & Kiểm Định Chống Nối Sai
- **Phân nhóm rõ rệt trong Node Palette bên phải**:
  - **TẦNG 1: START (Khởi đầu / Triggers & Sources - Badge Cyan)**: `Schedule Trigger` (Xung nhịp định kỳ), `OS Process Source` (Tiến trình hệ thống), `Metric Alert Guard` (Ngưỡng cảnh báo).
  - **TẦNG 2: MIDDLE (Xử lý trung gian / Logic & Quotas - Badge Amber)**: `Condition Router` (Rẽ nhánh If/Else), `Logic Gate` (Ghép tín hiệu AND/OR), `Resource Quota Sandbox` (Giới hạn CPU/RAM/GPU).
  - **TẦNG 3: END (Hành động đích / Actions & Notifications - Badge Rose)**: `Service Action` (Trim RAM, Kill, Cores), `PC Automation Card` (Google search, Explorer), `Webhook Notifier` (Push alert về Telegram/Discord).
- **Bộ lọc theo tầng (Tier Filters)**: Nút chuyển nhanh `TẤT CẢ`, `START`, `MIDDLE`, `END` trong Node Palette.
- **Huy hiệu tầng trên thẻ (Card-Level Tier Badge)**: Mỗi node trên Canvas hiển thị huy hiệu cố định `[START]`, `[MIDDLE]`, `[END]` ở góc header để dễ nhận biết cấu trúc.
- **Bộ kiểm định chống nối sai (Connection Validator - `validateNodeConnection`)**:
  - Chặn triệt để việc nối ngược: `END -> START`, `END -> MIDDLE`, `MIDDLE -> START`.
  - Chặn kết nối bất kỳ node nào vào `Schedule Trigger` (Schedule Trigger là nguồn phát xung nhịp, không nhận input).
  - Chặn tự nối vào chính mình (Self-loop error).
  - Khi người dùng kéo dây sai quy tắc, hệ thống từ chối tạo edge và hiển thị thông báo lỗi nổi màu đỏ (Toast banner) kèm hướng dẫn giải thích cụ thể vì sao kết nối bị chặn.

---

Tài liệu được cập nhật tự động đồng bộ theo codebase mới nhất của dự án.

