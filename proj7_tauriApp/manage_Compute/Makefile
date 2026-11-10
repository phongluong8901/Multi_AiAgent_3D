.PHONY: help install dev dev-web backend frontend tauri build-backend build clean

ifeq ($(OS),Windows_NT)
    SHELL := powershell.exe
    .SHELLFLAGS := -NoProfile -Command
    ENV_PREFIX := $$env:PATH = "C:\msys64\ucrt64\bin;" + $$env:PATH;
    RUN_BACKEND := cd backend; if (Test-Path .venv/Scripts/python.exe) { .venv/Scripts/python.exe main.py } else { python main.py }
    RUN_BUILD_BACKEND := Stop-Process -Name backend-engine, compute-studio-desktop -Force -ErrorAction SilentlyContinue; cd backend; if (-not (Test-Path .venv/Scripts/pyinstaller.exe)) { .venv/Scripts/pip.exe install pyinstaller }; .venv/Scripts/pyinstaller.exe --workpath "$$env:TEMP\pyi_build" --distpath dist -y backend-engine.spec; New-Item -ItemType Directory -Path ../desktop-shell/binaries -Force; $$target = (rustc -vV | Select-String "host:").ToString().Split(" ")[1].Trim(); Copy-Item -Force dist/backend-engine.exe "../desktop-shell/binaries/backend-engine-$$target.exe"; Copy-Item -Force dist/backend-engine.exe ../desktop-shell/binaries/backend-engine-x86_64-pc-windows-msvc.exe -ErrorAction SilentlyContinue; Copy-Item -Force dist/backend-engine.exe ../desktop-shell/binaries/backend-engine-x86_64-pc-windows-gnu.exe -ErrorAction SilentlyContinue; New-Item -ItemType Directory -Path ../desktop-shell/target/x86_64-pc-windows-gnu/release -Force; Copy-Item -Force dist/backend-engine.exe ../desktop-shell/target/x86_64-pc-windows-gnu/release/backend-engine.exe -ErrorAction SilentlyContinue; Copy-Item -Force dist/backend-engine.exe ../desktop-shell/target/x86_64-pc-windows-gnu/release/backend-engine-x86_64-pc-windows-gnu.exe -ErrorAction SilentlyContinue
    DEV_WEB_CMD := Start-Process powershell -ArgumentList '-NoExit', '-Command', 'cd backend; if (Test-Path .venv/Scripts/python.exe) { .venv/Scripts/python.exe main.py } else { python main.py }'; cd frontend; npm run dev
    INSTALL_CMD := cd backend; if (-not (Test-Path .venv)) { python -m venv .venv }; if (Test-Path .venv/Scripts/pip.exe) { .venv/Scripts/pip.exe install -r requirements.txt } else { pip install -r requirements.txt }; cd ../frontend; npm install
    CLEAN_CMD := Remove-Item -Recurse -Force frontend/dist, desktop-shell/target, backend/__pycache__, backend/app/**/__pycache__, backend/build, backend/dist, backend/*.spec -ErrorAction SilentlyContinue
    SEP := ;
else
    SHELL := /bin/bash
    .SHELLFLAGS := -c
    ENV_PREFIX :=
    RUN_BACKEND := cd backend && (test -f .venv/bin/python && .venv/bin/python main.py || python3 main.py)
    RUN_BUILD_BACKEND := pkill -f backend-engine || true; cd backend && (test -f .venv/bin/pyinstaller || .venv/bin/pip install pyinstaller) && .venv/bin/pyinstaller --clean -y --onefile --name backend-engine main.py && mkdir -p ../desktop-shell/binaries && cp dist/backend-engine ../desktop-shell/binaries/backend-engine-$$(rustc -Vv | grep host | cut -f2 -d' ')
    DEV_WEB_CMD := (cd backend && (test -f .venv/bin/python && .venv/bin/python main.py || python3 main.py)) & (cd frontend && npm run dev)
    INSTALL_CMD := cd backend && (test -d .venv || python3 -m venv .venv) && (test -f .venv/bin/pip && .venv/bin/pip install -r requirements.txt || pip3 install -r requirements.txt) && cd ../frontend && npm install
    CLEAN_CMD := rm -rf frontend/dist desktop-shell/target backend/__pycache__ backend/app/**/__pycache__ backend/build backend/dist backend/*.spec
    SEP := &&
endif

# Mặc định khi gõ 'make' sẽ hiện danh sách lệnh
help:
	@echo "=================================================="
	@echo "         COMPUTE STUDIO MAKEFILE COMMANDS         "
	@echo "=================================================="
	@echo "  make install       - Cài đặt toàn bộ dependencies (FE & BE)"
	@echo "  make dev-web       - Chạy đồng thời Backend + Frontend (Trình duyệt)"
	@echo "  make dev           - Chạy Desktop Shell chế độ Dev (Tauri + FE + BE)"
	@echo "  make build-backend - Đóng gói Python Backend thành backend-engine.exe"
	@echo "  make build         - Đóng gói toàn bộ thành file cài đặt Desktop .exe"
	@echo "  make backend       - Chỉ chạy riêng Python FastAPI Backend"
	@echo "  make frontend      - Chỉ chạy riêng Vite React Frontend"
	@echo "  make tauri         - Chỉ chạy riêng Tauri Desktop Shell"
	@echo "  make clean         - Dọn dẹp cache và các file build rác"
	@echo "=================================================="

# 1. Cài đặt thư viện cho cả 2 phía
install:
	@echo "==> Installing dependencies..."
	$(INSTALL_CMD)
	@echo "==> Setup completed successfully!"

# 2. Chạy riêng từng service
backend:
	$(RUN_BACKEND)

frontend:
	cd frontend $(SEP) npm run dev

tauri:
	$(ENV_PREFIX) cd desktop-shell $(SEP) cargo run --target x86_64-pc-windows-gnu

# 3. Chạy Desktop App Dev Mode:
dev:
	@echo "==> Starting Compute Studio Desktop App (Tauri + Frontend + Backend)..."
	$(ENV_PREFIX) cd desktop-shell $(SEP) cargo run --target x86_64-pc-windows-gnu

# Chạy song song Backend và Frontend trên trình duyệt
dev-web:
	@echo "==> Starting Web Dev Environment (Backend on :14200, Frontend on :5173)..."
	$(DEV_WEB_CMD)

# 4. Đóng gói Release Production (.exe)
build-backend:
	@echo "==> Building standalone Python backend sidecar binary..."
	$(RUN_BUILD_BACKEND)
	@echo "==> Backend engine packaged into desktop-shell/binaries/ successfully!"

build: build-backend
	@echo "==> Building Vite React Frontend..."
	cd frontend $(SEP) npm run build
	@echo "==> Building Compute Studio Desktop Release Package (.exe)..."
	$(ENV_PREFIX) cd desktop-shell $(SEP) cargo build --release --target x86_64-pc-windows-gnu
	@echo "==> Syncing backend binaries to release target directory..."
	powershell -Command "Copy-Item -Force backend/dist/backend-engine.exe desktop-shell/target/x86_64-pc-windows-gnu/release/backend-engine.exe -ErrorAction SilentlyContinue; Copy-Item -Force backend/dist/backend-engine.exe desktop-shell/target/x86_64-pc-windows-gnu/release/backend-engine-x86_64-pc-windows-gnu.exe -ErrorAction SilentlyContinue"
	@echo "==> Build complete! Check desktop-shell/target/x86_64-pc-windows-gnu/release/ for executable."

# 5. Dọn dẹp cache
clean:
	@echo "==> Cleaning up build artifacts and caches..."
	$(CLEAN_CMD)
