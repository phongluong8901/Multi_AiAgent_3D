.PHONY: help proto up-infra down-infra up-cluster down-cluster run-gateway run-worker run-worker-2 build-worker run-worker-desktop build-worker-desktop run-frontend test-backend test-worker test-all test-frontend test-api

help:
	@echo "Lenh nhanh tu thu muc goc:"
	@echo "  make proto                - Sinh code gRPC trong shared/api/proto"
	@echo "  make up-infra             - Bat Redis + PostgreSQL"
	@echo "  make run-gateway          - Chay API Gateway (:8088)"
	@echo "  make run-worker           - Chay Worker CLI + Local Web UI (:9091)"
	@echo "  make run-worker-2         - Chay Worker Node 2 + Local Web UI (:9092)"
	@echo "  make build-worker         - Build CLI worker/bin/worker.exe (kem Web UI go:embed)"
	@echo "  make run-worker-desktop   - Chay giao dien App PC (Wails dev)"
	@echo "  make build-worker-desktop - Build app PC worker-desktop.exe (frontend-worker/build/bin)"
	@echo "  make run-frontend         - Chay Next.js Frontend (:3000)"
	@echo "  make test-all             - Chay Go test cho shared, backend, worker va frontend-worker"
	@echo "  make test-frontend        - Chay TypeScript check"
	@echo "  make test-api             - Chay script test API"

proto:
	cd shared && protoc --go_out=. --go_opt=paths=source_relative --go-grpc_out=. --go-grpc_opt=paths=source_relative api/proto/llm_stream.proto

up-infra:
	cd backend && docker compose -f deployments/docker-compose.yml up -d

down-infra:
	cd backend && docker compose -f deployments/docker-compose.yml down

up-cluster:
	cd backend && docker compose -f deployments/docker-compose.yml --profile cluster up -d --build

down-cluster:
	cd backend && docker compose -f deployments/docker-compose.yml --profile cluster down

run-gateway:
	cd backend && go run cmd/gateway/main.go -config configs/gateway.yaml

run-worker:
	cd worker && go run cmd/worker/main.go -config configs/worker.yaml

run-worker-2:
	cd worker && powershell -NoProfile -Command "$$env:WORKER_ID='worker-node-02'; $$env:WORKER_UI_ADDR=':9092'; $$env:LLM_BASE_URL='http://127.0.0.1:11435'; go run cmd/worker/main.go -config configs/worker.yaml"

build-worker:
	cd worker && go build -o bin/worker.exe ./cmd/worker

run-worker-desktop:
	cd frontend-worker && wails dev

build-worker-desktop:
	cd frontend-worker && wails build

run-frontend:
	pnpm --dir frontend dev

test-backend:
	cd backend && go test -v -count=1 ./...

test-worker:
	cd worker && go test -v -count=1 ./...

test-all:
	cd shared && go test ./... && cd ../backend && go test -v -count=1 ./... && cd ../worker && go test -v -count=1 ./... && cd ../frontend-worker && go test -v -count=1 ./...

test-frontend:
	pnpm --dir frontend run typecheck

test-api:
	cd backend && powershell -ExecutionPolicy Bypass -File scripts/test_api.ps1
