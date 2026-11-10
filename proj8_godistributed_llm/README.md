# Go Distributed LLM

Hệ thống suy luận **Local LLM phân tán** viết bằng **Go** theo kiến trúc **Hexagonal (Ports & Adapters)**, đi kèm giao diện **Next.js (React + Tailwind + Lucide)** cho User Chat (SSE real-time) và Admin Cluster Monitor.

---

## Tài Liệu Kiến Trúc

- Tổng quan & Quick Start: [docs/overview.md](file:///d:/A_Self_Proj/learn_mlflow/proj8_godistributed_llm/docs/overview.md)
- Tech Stack & Cơ chế kỹ thuật: [docs/tech-stack.md](file:///d:/A_Self_Proj/learn_mlflow/proj8_godistributed_llm/docs/tech-stack.md)
- Cấu trúc thư mục: [docs/structure.md](file:///d:/A_Self_Proj/learn_mlflow/proj8_godistributed_llm/docs/structure.md)
- Luồng hoạt động chi tiết (End-to-End): [docs/workflow.md](file:///d:/A_Self_Proj/learn_mlflow/proj8_godistributed_llm/docs/workflow.md)

---

## Khởi Chạy Nhanh (Local)

### 1. Bật Redis (& PostgreSQL tùy chọn)
```powershell
cd backend/deployments
docker compose up -d
```

### 2. Chạy API Gateway (`:8088` HTTP, `:50051` gRPC)
```powershell
cd backend
go run cmd/gateway/main.go -config configs/gateway.yaml
```

### 3. Chạy Worker Node (Ollama Local)
```powershell
cd backend
go run cmd/worker/main.go -config configs/worker.yaml
```

### 4. Chạy Frontend (`:3000`)
```powershell
cd frontend
pnpm dev
```

---

## Kiểm Thử & Test API

- Chạy Go unit/integration tests: `cd backend && go test -v -count=1 ./...`
- Chạy Next.js typecheck & build: `cd frontend && pnpm run typecheck && pnpm run build`
- Test HTTP API mẫu: [backend/scripts/test_api.http](file:///d:/A_Self_Proj/learn_mlflow/proj8_godistributed_llm/backend/scripts/test_api.http) hoặc `.\backend\scripts\test_api.ps1`

