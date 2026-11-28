.PHONY: help tidy vet build test build-gateway run-gateway up-infra down-infra up-cluster down-cluster test-api

help:
	@echo "Cac lenh ho tro trong backend/ (API Gateway):"
	@echo "  make tidy           - Tai va dong bo Go dependencies"
	@echo "  make build          - Bien dich API Gateway"
	@echo "  make test           - Chay unit/integration tests cua Gateway"
	@echo "  make run-gateway    - Chay API Gateway (HTTP :8088, gRPC :50051)"
	@echo "  make build-gateway  - Build binary bin/gateway.exe"
	@echo "  make up-infra       - Bat Redis + PostgreSQL bang Docker"
	@echo "  make up-cluster     - Bat full cum Docker (Gateway + 2 Ollama + 2 Worker)"
	@echo "  make test-api       - Chay script test_api.ps1"

tidy:
	go mod tidy

vet:
	go vet ./...

build:
	go build ./...

test:
	go test -v -count=1 ./...

build-gateway:
	go build -o bin/gateway.exe ./cmd/gateway

run-gateway:
	go run cmd/gateway/main.go -config configs/gateway.yaml

up-infra:
	docker compose -f deployments/docker-compose.yml up -d

down-infra:
	docker compose -f deployments/docker-compose.yml down

up-cluster:
	docker compose -f deployments/docker-compose.yml --profile cluster up -d --build

down-cluster:
	docker compose -f deployments/docker-compose.yml --profile cluster down

test-api:
	powershell -ExecutionPolicy Bypass -File scripts/test_api.ps1
