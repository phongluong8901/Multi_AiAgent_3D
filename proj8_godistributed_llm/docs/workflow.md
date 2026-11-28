# Luồng Hoạt Động Chi Tiết Hệ Thống (End-to-End Workflow)

Tài liệu mô tả 4 luồng vận hành thực tế trong [backend](file:///d:/A_Self_Proj/learn_mlflow/proj8_godistributed_llm/backend) và [frontend](file:///d:/A_Self_Proj/learn_mlflow/proj8_godistributed_llm/frontend).

Tham chiếu: [docs/overview.md](file:///d:/A_Self_Proj/learn_mlflow/proj8_godistributed_llm/docs/overview.md) | [docs/tech-stack.md](file:///d:/A_Self_Proj/learn_mlflow/proj8_godistributed_llm/docs/tech-stack.md) | [docs/structure.md](file:///d:/A_Self_Proj/learn_mlflow/proj8_godistributed_llm/docs/structure.md)

---

## A. Khi User / External Service Gửi Câu Hỏi

1. [chat_handler.go](file:///d:/A_Self_Proj/learn_mlflow/proj8_godistributed_llm/backend/internal/handlers/chat_handler.go) nhận `POST /api/v1/chat/stream` (SSE) hoặc `POST /api/v1/chat` (REST JSON đồng bộ), đi qua middleware kiểm tra API Key tại [middleware.go](file:///d:/A_Self_Proj/learn_mlflow/proj8_godistributed_llm/backend/internal/handlers/middleware.go).
2. Handler gọi [`ChatService.EnqueueChat`](file:///d:/A_Self_Proj/learn_mlflow/proj8_godistributed_llm/backend/internal/services/chat_service.go#L59-L106):
   - Lưu prompt của User vào DB qua `ports.Repository` ([chat_repo.go](file:///d:/A_Self_Proj/learn_mlflow/proj8_godistributed_llm/backend/internal/repositories/postgres/chat_repo.go)).
   - Đăng ký channel nhận token trên [sse_hub.go](file:///d:/A_Self_Proj/learn_mlflow/proj8_godistributed_llm/backend/internal/services/sse_hub.go) **trước khi** enqueue.
   - Đẩy `models.JobPayload` (kèm `ReplyToGrpcAddr` và `ReplyToHTTPAddr`) vào Redis Stream `jobs:model:<model>` qua [stream_queue.go](file:///d:/A_Self_Proj/learn_mlflow/proj8_godistributed_llm/backend/internal/repositories/redis/stream_queue.go).
3. Gateway flush token liên tục qua SSE (hoặc gom chuỗi trả JSON với `ChatSync`). Nếu Client ngắt kết nối hoặc gọi `POST /api/v1/chat/:id/stop`, Gateway bắn `PublishCancel` qua [pubsub_bus.go](file:///d:/A_Self_Proj/learn_mlflow/proj8_godistributed_llm/backend/internal/repositories/redis/pubsub_bus.go).

---

## B. Khi Worker Nhận Việc & Gọi Local LLM

1. [engine.go](file:///d:/A_Self_Proj/learn_mlflow/proj8_godistributed_llm/backend/internal/worker/engine.go) giữ slot `Semaphore`, kiểm tra cờ `IsNodeDraining` (nếu Admin đã bấm **Drain** thì tạm dừng kéo job mới), sau đó gọi `PullJobFromModels` (`XREADGROUP`). Song song đó chạy `XAUTOCLAIM` mỗi `15s` để cứu các job bị treo quá `45s`.
2. [processor.go](file:///d:/A_Self_Proj/learn_mlflow/proj8_godistributed_llm/backend/internal/worker/processor.go):
   - Đăng ký lắng nghe `SubscribeCancel` để hủy `jobCtx` ngay khi nhận lệnh `STOP`.
   - Gọi Local LLM Engine qua [clients/llm/factory.go](file:///d:/A_Self_Proj/learn_mlflow/proj8_godistributed_llm/backend/internal/clients/llm/factory.go) ([ollama_adapter.go](file:///d:/A_Self_Proj/learn_mlflow/proj8_godistributed_llm/backend/internal/clients/llm/ollama_adapter.go) hoặc [llamacpp_adapter.go](file:///d:/A_Self_Proj/learn_mlflow/proj8_godistributed_llm/backend/internal/clients/llm/llamacpp_adapter.go)).
   - Stream từng `TokenChunk` về đúng Gateway qua [grpc_client_pool.go](file:///d:/A_Self_Proj/learn_mlflow/proj8_godistributed_llm/backend/internal/clients/grpc/grpc_client_pool.go) (khi `transport: "grpc"`) hoặc [token_client.go](file:///d:/A_Self_Proj/learn_mlflow/proj8_godistributed_llm/backend/internal/clients/http/token_client.go) (khi `transport: "http"`).

---

## C. Khi Token Bay Về Gateway & Lưu Lịch Sử

1. Gateway nhận token qua [grpc_server.go](file:///d:/A_Self_Proj/learn_mlflow/proj8_godistributed_llm/backend/internal/clients/grpc/grpc_server.go) hoặc [internal_handler.go](file:///d:/A_Self_Proj/learn_mlflow/proj8_godistributed_llm/backend/internal/handlers/internal_handler.go), gọi `SSEHub.PushToUser`.
2. Khi nhận `Done = true`, Gateway gọi `SaveAssistantResult` lưu câu trả lời & `UsageLog` vào DB; Worker gọi `AckJob` (`XACK`) hoàn tất job.

---

## D. Luồng Quản Trị Admin (Telemetry & Drain Node)

1. [heartbeat.go](file:///d:/A_Self_Proj/learn_mlflow/proj8_godistributed_llm/backend/internal/worker/heartbeat.go) mỗi `5s` gọi [pkg/utils/sysinfo.go](file:///d:/A_Self_Proj/learn_mlflow/proj8_godistributed_llm/backend/pkg/utils/sysinfo.go) đo CPU/RAM và gửi lên Redis với `TTL = 12s` qua [node_registry.go](file:///d:/A_Self_Proj/learn_mlflow/proj8_godistributed_llm/backend/internal/repositories/redis/node_registry.go).
2. [admin_handler.go](file:///d:/A_Self_Proj/learn_mlflow/proj8_godistributed_llm/backend/internal/handlers/admin_handler.go) + [admin_service.go](file:///d:/A_Self_Proj/learn_mlflow/proj8_godistributed_llm/backend/internal/services/admin_service.go) phục vụ Frontend `AdminDashboard`:
   - `GET /api/v1/admin/nodes` & `GET /api/v1/admin/queues`
   - `POST /api/v1/admin/nodes/:id/drain` & `POST /api/v1/admin/nodes/:id/resume`
