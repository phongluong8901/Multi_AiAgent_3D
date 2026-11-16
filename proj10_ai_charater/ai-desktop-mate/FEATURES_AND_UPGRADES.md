# AI Desktop Mate - Tổng Hợp Tính Năng & Lịch Sử Nâng Cấp

Tài liệu này tổng hợp toàn bộ kiến trúc, tính năng và các nâng cấp đã hoàn thiện cho ứng dụng **AI Desktop Mate** (Tauri v2 + Rust + Three.js + VRM + Ollama Local LLM + SQLite).

---

## 1. Kiến trúc Thư mục Dự án

### Frontend & Engine 3D (`src/`)
- **`src/core/`**: Trạng thái tập trung (`state.ts`), kiểu dữ liệu (`types.ts`), dựng cảnh Three.js & vòng sáng chân (`scene.ts`), hệ thống hạt 3D & sóng xung kích (`particles.ts`).
- **`src/characters/`**: Mô hình mặc định Cyber Idol 3D (`characterRig.ts`) và trình quản lý/hoạt ảnh xương cho VRM 0.0 / 1.0 + bộ nhớ đệm IndexedDB (`vrmManager.ts`).
- **`src/physics/`**: Mô phỏng vật lý 2D, nhảy parabol, tự động đi dạo (`physics.ts`) và tương tác đẩy/kéo cửa sổ Windows (`windowInteract.ts`).
- **`src/backend/`**: Cầu nối giao tiếp trợ lý AI Ollama, kiểm tra phần cứng/mạng/Bitcoin, điều khiển máy tính và bộ nhớ cá nhân SQLite (`assistant.ts`).
- **`src/frontend/`**: Quản lý giao diện HUD, bảng trái/phải, bong bóng chat, Studio Modal (`ui.ts`) và xử lý kéo thả, ném, xoa đầu, chọc (`input.ts`).
- **`src/main.ts`**: Điểm khởi chạy chính, kết nối các module và vòng lặp render.

### Backend Rust (`src-tauri/src/`)
- **`src-tauri/src/core/`**:
  - `hitbox.rs`: Theo dõi con trỏ chuột toàn cục qua `GetCursorPos` và bật/tắt xuyên chuột đa vùng (`ui_rects`) độc lập.
  - `windows.rs`: Quét cửa sổ đang mở (`EnumWindows`) và bắt cửa sổ đang Active (`GetForegroundWindow` + `GetAncestor`), hỗ trợ cả cửa sổ Maximized như Chrome.
- **`src-tauri/src/backend/`**:
  - `window_control.rs`: Điều khiển vị trí/kích thước cửa sổ Windows (`SetWindowPos`, `ShowWindow`).
  - `telemetry.rs`: Đo CPU, RAM, GPU, ổ đĩa (`check_hardware`), kiểm tra Internet & Ollama (`check_network`), và lấy giá Bitcoin trực tiếp từ Binance/CoinGecko (`check_bitcoin`).
  - `llm.rs`: Giao tiếp Local LLM Ollama (`ask_ollama`) qua `curl.exe` tránh lỗi CORS.
  - `pc_control.rs`: Mở web/ứng dụng (`open_web_or_app`), điều khiển âm lượng/nhạc (`control_media`), chụp ảnh màn hình (`take_screenshot`), khóa máy (`lock_pc_screen`).
  - `memory.rs`: Cơ sở dữ liệu **SQLite cục bộ** nạp trực tiếp `winsqlite3.dll` của Windows (`mate_memory.db`).

---

## 2. Các Tính năng Chính & Nâng cấp

### A. Nhân vật 3D & Hoạt ảnh VRM
- Hỗ trợ nạp trực tiếp **VRM 0.0 và VRM 1.0** qua 1-click preset (Alicia Solid, Avatar Sample A), dán URL `.vrm`, chọn file từ máy (`F4`), hoặc kéo thả file trực tiếp vào màn hình. Tự động lưu model vào IndexedDB.
- Nhân vật mặc định **Cyber Idol 3D** có khuôn mặt vẽ động theo biểu cảm (`neutral`, `happy`, `surprised`, `blink`, `talk`), tóc hai chùm lắc lư theo gia tốc.
- Hiệu ứng 3D đi kèm: **Squash & Stretch** khi bật nhảy/tiếp đất, **vòng sáng hào quang** đổi màu theo trạng thái, **sóng xung kích** khi chạm đất và **hạt confetti/trail**.

### B. Vật lý & Tương tác Cửa sổ Active
- **Bắt cửa sổ đang Active**: Tự động nhận diện cửa sổ bạn vừa click (Chrome, VS Code, Explorer...) kể cả khi đang phóng to toàn màn hình.
- **Đẩy & Kéo vật lý thực tế**: Nhân vật tự chạy bộ hoặc nhảy tới đúng cạnh cửa sổ mục tiêu, chuyển sang tư thế **PUSHING** (nghiêng người, hai tay duỗi đẩy) hoặc **PULLING** (ngả người bám kéo) để dịch chuyển hoặc co giãn cửa sổ từng nhịp.
- **Tương tác trực tiếp**: Nắm kéo và ném nhân vật (tính động lượng và độ nảy vào tường/Taskbar), xoa đầu (`Headpat`), chọc nhẹ (`Poke`), nhảy parabol lên mép cửa sổ đang mở.

### C. Bố cục UI/UX Bám theo Nhân vật
- Toàn bộ các cụm giao diện bám theo vị trí nhân vật mượt mà và tự động né mép màn hình:
  - **Trên đầu**: Bong bóng chat gọn gàng với hiệu ứng Typewriter và nút gợi ý `Đồng ý / Để sau`.
  - **Bên phải**: Bảng **Hành động & Tương tác** (điều khiển cửa sổ Active, hành động nhân vật, hỏi nhanh, điều khiển máy tính).
  - **Bên trái (Mặc định ẩn)**: Bảng **Thông số & Cảnh báo** chỉ mở và hiển thị đúng thẻ được hỏi (**Phần cứng**, **Mạng**, **Giá BTC**, **Trí nhớ**) hoặc khi có cảnh báo bất thường.
  - **Dưới chân**: Thanh Dock mini bật/tắt nhanh từng cụm và mở Studio 3D.

### D. Trợ lý Cá nhân Local LLM (`qwen2.5:1.5b`) & Điều khiển Máy tính
- Trò chuyện tiếng Việt có dấu trực tiếp với **Ollama `qwen2.5:1.5b`** (tự động nạp số liệu phần cứng, mạng, giá BTC nếu được hỏi).
- Ra lệnh mở web/ứng dụng bằng ngôn ngữ tự nhiên (*"mở youtube"*, *"mở youtube nhạc lofi"*, *"tìm google ..."*, *"mở notepad"*, *"mở máy tính"*).
- Điều khiển máy tính nhanh: tăng/giảm âm lượng, mute, phát/dừng nhạc, chụp ảnh màn hình lưu vào `Pictures\AI_Desktop_Mate`, khóa màn hình.

### E. Bộ nhớ Cục bộ SQLite & Học Thói quen Cá nhân
- Lưu trữ tại `mate_memory.db` với 4 bảng:
  1. `user_profile`: Tự động ghi nhớ tên, sở thích, công việc khi bạn trò chuyện.
  2. `chat_memory`: Lưu lịch sử hội thoại xuyên suốt các lần khởi động lại.
  3. `activity_logs`: Tự động thu thập thời gian bạn sử dụng từng ứng dụng theo khung giờ (mỗi 15 giây).
  4. `suggestion_feedback`: Ghi nhớ tỷ lệ `Đồng ý` / `Để sau` cho từng loại gợi ý để đưa ra gợi ý phù hợp theo khung giờ và không làm phiền lặp lại.

