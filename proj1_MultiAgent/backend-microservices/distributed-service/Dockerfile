# Multi-stage build for Go Distributed Service
FROM golang:alpine AS builder

WORKDIR /app

# Cấu hình GOPROXY đa máy chủ dự phòng (chỉ dùng nếu không có thư mục vendor)
ENV GOPROXY=https://goproxy.cn,https://goproxy.io,https://proxy.golang.org,direct
ENV GOSUMDB=off

# Copy source code và thư mục vendor đã đóng gói sẵn trên máy host
COPY . .

# Nếu đã có sẵn thư mục vendor thì build offline ngay lập tức (không cần tải mạng tránh lỗi TLS timeout)
RUN if [ -d "vendor" ]; then \
        CGO_ENABLED=0 GOOS=linux go build -mod=vendor -o distributed-service main.go; \
    else \
        go mod download && CGO_ENABLED=0 GOOS=linux go build -o distributed-service main.go; \
    fi

# Minimal runtime stage
FROM alpine:latest

RUN apk --no-cache add ca-certificates tzdata

WORKDIR /app

COPY --from=builder /app/distributed-service .
COPY .env.example .env

EXPOSE 5010
EXPOSE 8083

CMD ["./distributed-service"]
