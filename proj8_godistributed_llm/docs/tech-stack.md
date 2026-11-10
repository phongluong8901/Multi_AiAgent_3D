# Kiến Trúc Tech Stack Hệ Thống Phân Tán LLM

Tài liệu chi tiết công nghệ, thư viện, giao thức truyền thông và cơ chế tách tầng cho hệ thống **Go Distributed LLM** theo chuẩn **Production Layered + Ports/Factory** (dễ đọc, dễ scale ngang và swap tự do Database, Queue, LLM Engine, Token Transport).

Tham chiếu: [docs/structure.md](file:///d:/A_Self_Proj/learn_mlflow/proj8_godistributed_llm/docs/structure.md) | [docs/overview.md](file:///d:/A_Self_Proj/learn_mlflow/proj8_godistributed_llm/docs/overview.md)

---

## 1. Sơ Đồ Kiến Trúc Luồng Dữ Liệu & Công Nghệ

```mermaid
flowchart TD
    subgraph CLIENT["[TẦNG 1] Client & Giao Diện"]
        direction LR
        UI_USER["User Web App (Next.js / Tailwind)"]
        UI_ADMIN["Admin Portal (Next.js / Tailwind)"]
    end

    subgraph GATEWAY["[TẦNG 2] API Gateway (Golang 1.26)"]
        HAND["handlers/ (Gin REST + SSE + API Key Auth)"]
        SVC["services/ (ChatService, AdminService, SSEHub)"]
        GRPC_SRV["clients/grpc/ (gRPC Server)"]
    end

    subgraph BROKER["[TẦNG 3] Điều Phối & Hàng Đợi (Redis 7+)"]
        R_STREAM["Redis Streams\n(Job Queue: jobs:model:*)"]
        R_PUBSUB["Redis Pub/Sub\n(Broadcast Cancel)"]
        R_REG["Redis KV + TTL 12s\n(Heartbeat & Drain Flags)"]
    end

    subgraph WORKERS["[TẦNG 4] Cụm Worker Nodes (Golang)"]
        direction TB
        W_PULL["worker/engine.go (Semaphore + XREADGROUP + XAUTOCLAIM)"]
        W_PROC["worker/processor.go (Cancel Listener + Stream)"]
        W_METRICS["pkg/utils/sysinfo.go (gopsutil CPU/RAM)"]
    end

    subgraph ENGINES["[TẦNG 5] Local LLM Inference Engines"]
        direction LR
        ENG_OLLAMA["Ollama Service (HTTP API)"]
        ENG_LLAMACPP["llama.cpp server (/completion API)"]
    end

    subgraph PERSIST["[TẦNG 6] Lưu Trữ Dữ Liệu"]
        DB_PG["PostgreSQL (repositories/postgres + migrations/001_init.sql)"]
    end

    UI_USER -->|"POST /chat/stream hoặc /chat"| HAND
    UI_ADMIN -->|"GET /admin/nodes, /queues, POST /drain"| HAND
    HAND --> SVC
    SVC -->|"Ghi Session & Message"| DB_PG
    SVC -->|"XADD JobPayload"| R_STREAM
    SVC -->|"PUBLISH Cancel"| R_PUBSUB
    SVC -.->|"SSE / REST JSON"| UI_USER

    R_STREAM -->|"Pull Job"| W_PULL
    W_PULL --> W_PROC
    R_PUBSUB -.->|"Listen Cancel"| W_PROC
    W_METRICS -->|"Heartbeat 5s (TTL 12s)"| R_REG

    W_PROC -->|"Inference Stream"| ENGINES
    ENGINES -->|"<-chan TokenChunk"| W_PROC
    W_PROC ==>|"gRPC Stream hoặc HTTP NDJSON"| GRPC_SRV
    GRPC_SRV -->|"PushToUser"| SVC
```

---

## 2. Bảng Tổng Hợp Tech Stack & Điểm Swap

| Tầng (Layer) | Công nghệ / Thư viện | Vai trò trong hệ thống | Điểm Swap & File phụ trách |
| :--- | :--- | :--- | :--- |
| **Handlers** | **Gin** (`internal/handlers`) | Tiếp nhận HTTP REST, SSE, Internal Token Stream; xác thực API Key (`X-API-Key` / `Bearer`). | [router.go](file:///d:/A_Self_Proj/learn_mlflow/proj8_godistributed_llm/backend/internal/handlers/router.go), [middleware.go](file:///d:/A_Self_Proj/learn_mlflow/proj8_godistributed_llm/backend/internal/handlers/middleware.go) |
| **Services** | **Pure Go** (`internal/services`) | Điều phối nghiệp vụ Chat (`EnqueueChat`, `CancelJob`, `SaveAssistantResult`), Admin (`DrainNode`) và `SSEHub`. | [chat_service.go](file:///d:/A_Self_Proj/learn_mlflow/proj8_godistributed_llm/backend/internal/services/chat_service.go), [admin_service.go](file:///d:/A_Self_Proj/learn_mlflow/proj8_godistributed_llm/backend/internal/services/admin_service.go), [sse_hub.go](file:///d:/A_Self_Proj/learn_mlflow/proj8_godistributed_llm/backend/internal/services/sse_hub.go) |
| **Models & Ports** | **Pure Go** (`internal/models`, `internal/ports`) | Định nghĩa struct thực thể và interface chuẩn cho toàn bộ DB, Queue, LLM, Streamer. | [internal/ports](file:///d:/A_Self_Proj/learn_mlflow/proj8_godistributed_llm/backend/internal/ports), [internal/models](file:///d:/A_Self_Proj/learn_mlflow/proj8_godistributed_llm/backend/internal/models) |
| **Repositories (DB)** | **PostgreSQL** (`jackc/pgx/v5`) | Lưu tin nhắn, usage log; quản lý schema qua `migrations/001_init.sql`. | Swap driver (`postgres` / `noop` / mở rộng `mysql`, `sqlite`) tại [repositories/factory.go](file:///d:/A_Self_Proj/learn_mlflow/proj8_godistributed_llm/backend/internal/repositories/factory.go) |
| **Repositories (Queue)** | **Redis 7+** (`redis/go-redis/v9`) | Redis Streams (hàng đợi), Pub/Sub (cancel), KV TTL 12s (heartbeat & drain flag). | Swap qua `ports.JobQueue`, `ports.EventBus`, `ports.NodeRegistry` tại [repositories/redis](file:///d:/A_Self_Proj/learn_mlflow/proj8_godistributed_llm/backend/internal/repositories/redis) |
| **Clients (LLM)** | **Ollama** / **llama.cpp server** | Gọi inference stream local trên CPU/GPU của từng Worker. | Swap qua `LLM_PROVIDER=ollama` hoặc `llamacpp` tại [clients/llm/factory.go](file:///d:/A_Self_Proj/learn_mlflow/proj8_godistributed_llm/backend/internal/clients/llm/factory.go) |
| **Clients (Transport)** | **gRPC + Protobuf** / **HTTP NDJSON** | Stream token từ Worker về đúng Gateway. | Swap qua `WORKER_TRANSPORT=grpc` hoặc `http` ([clients/grpc](file:///d:/A_Self_Proj/learn_mlflow/proj8_godistributed_llm/backend/internal/clients/grpc), [clients/http](file:///d:/A_Self_Proj/learn_mlflow/proj8_godistributed_llm/backend/internal/clients/http)) |
| **Frontend** | **Next.js 15 + Tailwind + Lucide** | User Chat SSE + Stop + Load History; Admin Telemetry + Drain/Resume Node. | [frontend](file:///d:/A_Self_Proj/learn_mlflow/proj8_godistributed_llm/frontend) |
