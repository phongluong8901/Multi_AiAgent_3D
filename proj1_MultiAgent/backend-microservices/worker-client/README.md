# Multi-Agent Distributed Hardware Worker Client (Electron + React + Python)

Thư mục này là phiên bản độc lập hoàn chỉnh của Desktop Client phục vụ mạng lưới tính toán phân tán (Distributed Service), tương tự như `proj3_clientElectron` nhưng được tổ chức nội bộ trong `backend-microservices`.

---

## 🏗️ Cấu trúc hệ thống

```
worker-client/
├── main.js                  # Tiến trình Electron chính (Quản lý cửa sổ frameless & spawn Python worker)
├── package.json             # Cấu hình Electron và Electron-Builder
├── requirements.txt         # Thư viện Python cho worker
├── worker.py                # Python Daemon thu thập telemetry psutil
├── build_exe.bat            # Script 1-click đóng gói worker.py -> worker.exe
├── frontend/                # Giao diện người dùng React + Vite + TailwindCSS
│   ├── src/                 # Mã nguồn React (App.tsx hiển thị CPU/RAM/Bản đồ/Log trực tiếp)
│   └── dist/                # Bản build sẵn của React UI cho Electron
└── release/                 # Thư mục chứa các file đóng gói phân phối
    ├── worker.exe                                    # File worker chạy độc lập (9 MB)
    └── Go-Python Worker Monitor Setup 1.0.0.exe      # Bộ cài đặt Electron hoàn chỉnh (115 MB)
```

---

## 🚀 Hướng dẫn phát triển & Khởi chạy

### 1. Chạy ứng dụng Electron Desktop (Dev)
```powershell
# Chạy Electron app (tự động mở giao diện React và chạy ngầm Python worker):
npm install
npm start
```

### 2. Chạy riêng giao diện React Frontend (Vite Web)
```powershell
cd frontend
npm install
npm run dev
# Truy cập tại: http://localhost:5173
```

### 3. Chạy riêng Python Worker
```powershell
pip install -r requirements.txt
python worker.py
```

---

## 📦 Hướng dẫn đóng gói (Build Release)

### 1. Đóng gói Python Worker thành `worker.exe`:
* Nhấp đúp vào file `build_exe.bat` hoặc chạy:
  ```powershell
  pip install pyinstaller
  pyinstaller --clean --onefile --name "worker" --distpath "./release" worker.py
  ```

### 2. Đóng gói ứng dụng Electron Desktop thành Installer Setup `.exe`:
```powershell
# Bước 1: Build mã nguồn React
npm run build:react

# Bước 2: Đóng gói với Electron-Builder
npm run build:win
```
File cài đặt hoàn chỉnh `Go-Python Worker Monitor Setup 1.0.0.exe` sẽ được tạo vào thư mục `release/`.


# --- neu chay dev tren pc -> start electron online (workder phai build ra truoc, react cung phai build)

pyinstaller --clean --onefile --name "worker" --distpath "./release" worker.py

npm run build:react

npm start 