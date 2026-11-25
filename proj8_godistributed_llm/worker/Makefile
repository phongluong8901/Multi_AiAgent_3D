.PHONY: help build build-exe test run run-node2

help:
	@echo "Cac lenh cho thu muc worker/:"
	@echo "  make run        - Chay Worker Node 1 + Local Web UI (:9091)"
	@echo "  make run-node2  - Chay Worker Node 2 + Local Web UI (:9092)"
	@echo "  make build-exe  - Build 1 file doc lap bin/worker.exe (kem Web UI go:embed)"
	@echo "  make test       - Chay unit test cua worker"

build:
	go build ./...

build-exe:
	go build -o bin/worker.exe ./cmd/worker

test:
	go test -v -count=1 ./...

run:
	go run cmd/worker/main.go -config configs/worker.yaml

run-node2:
	powershell -NoProfile -Command "$$env:WORKER_ID='worker-node-02'; $$env:WORKER_UI_ADDR=':9092'; $$env:LLM_BASE_URL='http://127.0.0.1:11435'; go run cmd/worker/main.go -config configs/worker.yaml"

