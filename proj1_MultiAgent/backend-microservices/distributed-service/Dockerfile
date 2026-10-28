# Multi-stage build for Go Distributed Service
FROM golang:alpine AS builder

WORKDIR /app

# Cache dependencies
COPY go.mod go.sum* ./
RUN go mod download || true

# Copy source code
COPY . .
RUN go mod tidy
RUN CGO_ENABLED=0 GOOS=linux go build -o distributed-service main.go

# Minimal runtime stage
FROM alpine:latest

RUN apk --no-cache add ca-certificates tzdata

WORKDIR /app

COPY --from=builder /app/distributed-service .
COPY .env.example .env

EXPOSE 5010

CMD ["./distributed-service"]
