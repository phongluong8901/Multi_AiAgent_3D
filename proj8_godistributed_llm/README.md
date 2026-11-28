# Go Distributed LLM

Hệ thống suy luận **Local LLM phân tán** viết bằng **Go** theo kiến trúc **Layered + Ports/Factory** (`handlers`, `services`, `models`, `ports`, `repositories`, `clients`, `worker`), đi kèm giao diện **Next.js (React + Tailwind + Lucide)** cho User Chat (SSE real-time) và Admin Cluster Monitor.

---

## Tài Liệu Kiến Trúc

- Tổng quan & Quick Start: [docs/overview.md](file:///d:/A_Self_Proj/learn_mlflow/proj8_godistributed_llm/docs/overview.md)
- Tech Stack & Cơ chế kỹ thuật: [docs/tech-stack.md](file:///d:/A_Self_Proj/learn_mlflow/proj8_godistributed_llm/docs/tech-stack.md)
- Cấu trúc thư mục: [docs/structure.md](file:///d:/A_Self_Proj/learn_mlflow/proj8_godistributed_llm/docs/structure.md)
- Luồng hoạt động chi tiết (End-to-End): [docs/workflow.md](file:///d:/A_Self_Proj/learn_mlflow/proj8_godistributed_llm/docs/workflow.md)
- Độ ổn định, sức chịu tải & tối ưu scale: [docs/scalability-and-reliability.md](file:///d:/A_Self_Proj/learn_mlflow/proj8_godistributed_llm/docs/scalability-and-reliability.md)

---

## Khởi Chạy Nhanh (Local)

*(Có thể dùng trực tiếp `make` ở thư mục gốc qua [Makefile](file:///d:/A_Self_Proj/learn_mlflow/proj8_godistributed_llm/Makefile) hoặc chạy thủ công từng bước.)*

### 1. Bật Redis (& PostgreSQL tùy chọn)
```powershell
make up-infra
# Hoặc: cd backend/deployments && docker compose up -d
```

### 2. Chạy API Gateway (`:8088` HTTP, `:50051` gRPC)
```powershell
make run-gateway
# Hoặc: cd backend && go run cmd/gateway/main.go -config configs/gateway.yaml
```

### 3. Chạy Worker Node (CLI + Web UI `:9091` hoặc Desktop App PC Wails)
```powershell
# Cách A: Chạy CLI + Web UI cục bộ (http://localhost:9091)
make run-worker

# Cách B: Chạy giao diện App PC (Wails Desktop)
make run-worker-desktop
# Hoặc build ra file cài chạy PC độc lập (.exe):
make build-worker-desktop
```

Hoặc build bản CLI `.exe` không cần cửa sổ desktop:
```powershell
make build-worker
# Chạy .\worker\bin\worker.exe -config .\worker\configs\worker.yaml
```

### 4. Chạy Frontend Gateway (`:3000`)
```powershell
make run-frontend
# Hoặc: cd frontend && pnpm dev
```

---

## Kiểm Thử & Test API

- Chạy Go unit/integration tests cho toàn cụm (`shared` + `backend` + `worker`): `make test-all`
- Chạy Next.js typecheck & build: `make test-frontend` và `cd frontend && pnpm run build`
- Test HTTP API mẫu: `make test-api` hoặc mở [backend/scripts/test_api.http](file:///d:/A_Self_Proj/learn_mlflow/proj8_godistributed_llm/backend/scripts/test_api.http)

# --- run service
- t0
make proto
- t1
make run-gateway
- t2
make run-worker

hoac build
make build-worker

- t3
make run-frontend

- t4 wail desktop dev
make run-worker-desktop


# --- setup wails cho go worker
go install github.com/wailsapp/wails/v2/cmd/wails@latest

wails doctor

wails init -n frontend-worker -t react-ts

--- set up frontend-worker vao go work
go work use .

--- run
cd frontend-worker
wails dev