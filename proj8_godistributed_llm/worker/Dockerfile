FROM golang:1.26-alpine AS builder
WORKDIR /src

COPY shared/go.mod shared/go.sum ./shared/
COPY worker/go.mod worker/go.sum ./worker/
RUN cd worker && go mod download

COPY shared ./shared
COPY worker ./worker
RUN cd worker && CGO_ENABLED=0 GOOS=linux go build -o /worker ./cmd/worker

FROM alpine:3.20
WORKDIR /app
COPY --from=builder /worker /app/worker
COPY worker/configs/worker.yaml /app/configs/worker.yaml

EXPOSE 9091
ENTRYPOINT ["/app/worker", "-config", "/app/configs/worker.yaml"]

