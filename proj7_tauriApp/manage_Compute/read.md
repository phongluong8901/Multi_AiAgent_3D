compute-manager-workspace/
├── README.md
├── Makefile                                  # Chứa lệnh chạy song song FE + BE + Tauri
│
├── backend/                                  # [1. PYTHON BACKEND] - Độc lập 100%
│   ├── pyproject.toml                        # Quản lý thư viện Python (Poetry / uv / pip)
│   ├── requirements.txt
│   ├── .env
│   ├── main.py                               # Entrypoint khởi chạy FastAPI Uvicorn
│   └── app/
│       ├── core/                             # Config, Logger, Security, Constants
│       │   └── config.py
│       ├── api/                              # Giao tiếp với Frontend (HTTP + WebSocket)
│       │   ├── rest/                         # Kiểu Postman Request/Response
│       │   │   ├── system_routes.py          # Lấy thông tin OS, CPU, GPU tĩnh
│       │   │   ├── process_routes.py         # Start / Stop / Kill / Inspect Services
│       │   │   └── workflow_routes.py        # Lưu / Chạy kịch bản tự động hóa
│       │   └── ws/                           # Stream realtime
│       │       ├── telemetry_ws.py           # Bắn thông số CPU/RAM/GPU mỗi 500ms
│       │       └── log_stream_ws.py          # Stream stdout/stderr của từng Service
│       ├── modules/                          # Các khối nghiệp vụ (Dễ dàng cắm thêm module mới)
│       │   ├── telemetry/                    # Thu thập tài nguyên máy
│       │   │   ├── cpu_ram.py                # psutil
│       │   │   ├── gpu_nvidia.py             # pynvml
│       │   │   └── disk_net.py
│       │   ├── service_manager/              # Quản lý tiến trình & Daemon
│       │   │   ├── os_process.py             # Quản lý PID, Port đang mở
│       │   │   └── systemd_winservice.py     # Quản lý Background Services
│       │   └── workflow_engine/              # Bộ thực thi Node-based (Kiểu n8n)
│       │       ├── dag_runner.py             # Giải mã JSON từ React Flow thành luồng chạy
│       │       ├── triggers.py               # Node kích hoạt (VD: GPU Temp > 80°C)
│       │       └── actions.py                # Node hành động (VD: Restart Service, Kill PID)
│       └── schemas/                          # Pydantic Models (Validate dữ liệu đầu vào/ra)
│           ├── telemetry_schema.py
│           └── workflow_schema.py
│
├── frontend/                                 # [2. REACT FRONTEND] - Độc lập 100%
│   ├── package.json                          # Chỉ chứa thư viện UI (React, Vite, Tailwind...)
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── index.html
│   └── src/
│       ├── main.tsx
│       ├── app/                              # Khung sườn ứng dụng
│       │   ├── App.tsx
│       │   └── WorkbenchLayout.tsx           # Chia khung Split-Pane kiểu Postman
│       ├── components/                       # UI dùng chung
│       │   ├── workbench/                    # Các thành phần mang đặc trưng Postman
│       │   │   ├── ActivityBar.tsx           # Thanh icon dọc bên trái
│       │   │   ├── SidebarTree.tsx           # Cây thư mục quản lý Services / Workflows
│       │   │   ├── TabManager.tsx            # Thanh mở nhiều Tab song song
│       │   │   └── BottomConsole.tsx         # Khung Terminal / Logs kéo lên từ đáy
│       │   └── ui/                           # Button, Input, Modal, Badge (Shadcn)
│       ├── features/                         # Tách theo từng màn hình tính năng (Dễ scale)
│       │   ├── dashboard-metrics/            # Tab 1: Biểu đồ CPU, RAM, VRAM realtime
│       │   ├── service-inspector/            # Tab 2: Giao diện quản lý Service giống Postman
│       │   │   ├── ControlHeader.tsx         # Thanh chọn Service + Nút Start/Stop/Restart
│       │   │   └── InspectorPanels.tsx       # Sub-tabs: Ports, Env Vars, Realtime Logs
│       │   └── n8n-canvas/                   # Tab 3: Màn hình kéo thả Node (React Flow)
│       │       ├── CanvasEditor.tsx
│       │       ├── NodePalette.tsx           # Thanh công cụ chọn Node để kéo vào màn hình
│       │       └── custom-nodes/
│       │           ├── TriggerMetricNode.tsx # Node điều kiện (CPU/GPU vượt ngưỡng)
│       │           └── ActionServiceNode.tsx # Node điều khiển (Chạy lệnh/Restart service)
│       ├── services/                         # Tầng kết nối xuống thư mục backend/
│       │   ├── httpClient.ts                 # Axios gọi vào http://127.0.0.1:14200/api
│       │   └── socketClient.ts               # WebSocket nhận stream từ ws://127.0.0.1:14200/ws
│       └── stores/                           # Zustand quản lý State toàn cục
│           ├── useTabsStore.ts               # Quản lý trạng thái các Tab đang mở
│           └── useTelemetryStore.ts          # Lưu trữ thông số phần cứng realtime
│
└── desktop-shell/                            # [3. TAURI SHELL] - Đóng gói App Desktop
    ├── Cargo.toml                            # Chỉ chứa code Rust đóng khung cửa sổ & gọi Sidecar
    ├── tauri.conf.json                       # Trỏ frontendDist sang "../frontend/dist"
    ├── icons/
    ├── binaries/                             # Nơi chứa file backend.exe sau khi build
    └── src/
        ├── main.rs                           # Khởi tạo cửa sổ Desktop & bật/tắt Backend
        └── tray.rs                           # Thu nhỏ App xuống System Tray (chạy ngầm)


# --- Cài đặt dependencies ban đầu
make install

# --- Chạy chế độ phát triển (Dev)
# Chạy cả Backend + Frontend trên trình duyệt Web (Không cần build Rust):
make dev-web

# Chạy cửa sổ Desktop Shell (Tauri + React + Python):
make dev

# Chạy riêng lẻ:
make backend   # FastAPI Backend
make frontend  # React Vite Frontend
make tauri     # Desktop Shell

# --- Đóng gói Release thành file cài đặt .exe
# Đóng gói tự động toàn bộ (Python backend.exe + React Frontend + Tauri Desktop App):
make build

# Đóng gói riêng Python sidecar backend-engine.exe:
make build-backend


# --- build frontend
cd frontend
npm run build

# --- build backend
make build-backend

# --- build dessktop shell
cd desktop-shell
cargo build --release --target x86_64-pc-windows-gnu


# --- chay tu build het FE, BE, taurri
make build