.PHONY: all help tidy build run-gateway run-worker docker-up docker-down clean

BINARY_GATEWAY=bin/gateway.exe
BINARY_WORKER=bin/worker.exe

all: help

help:
	@echo ========================================================
	@echo Multi-Protocol Benchmark Testbench
	@echo ========================================================
	@echo make tidy         - Download and sync Go dependencies
	@echo make run-gateway  - Start the Gateway Control Plane (Port :8080)
	@echo make run-worker   - Start the Distributed Worker (Redis Streams)
	@echo make build        - Build binaries for Gateway and Worker
	@echo make docker-up    - Start Redis and MediaMTX containers
	@echo make docker-down  - Stop Docker containers
	@echo make clean        - Remove generated binaries
	@echo ========================================================

tidy:
	go mod tidy

build:
	@if not exist "bin" mkdir bin
	go build -o $(BINARY_GATEWAY) ./cmd/gateway
	go build -o $(BINARY_WORKER) ./cmd/worker

run-gateway:
	go run ./cmd/gateway/main.go

run-worker:
	go run ./cmd/worker/main.go

docker-up:
	docker compose up -d

docker-down:
	docker compose down

clean:
	@if exist "bin" rmdir /s /q bin

