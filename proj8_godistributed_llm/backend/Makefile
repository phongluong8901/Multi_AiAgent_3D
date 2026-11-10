.PHONY: proto tidy build test build-gateway build-worker run-gateway run-worker

# Biên dịch file gRPC Protobuf thành code Go trong api/proto/
proto:
	protoc --go_out=. --go_opt=paths=source_relative \
	       --go-grpc_out=. --go-grpc_opt=paths=source_relative \
	       api/proto/llm_stream.proto

tidy:
	go mod tidy

build:
	go build ./...

test:
	go test -v -count=1 ./...

build-gateway:
	go build -o bin/gateway.exe ./cmd/gateway

build-worker:
	go build -o bin/worker.exe ./cmd/worker

run-gateway:
	go run cmd/gateway/main.go -config configs/gateway.yaml

run-worker:
	go run cmd/worker/main.go -config configs/worker.yaml
