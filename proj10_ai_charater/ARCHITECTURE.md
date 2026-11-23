# Kiến Trúc Hệ Thống Duck ai Manager

Dự án được tổ chức thành 4 thành phần độc lập tại thư mục gốc để dễ nâng cấp, kiểm thử và bảo trì:

## 1. Cấu trúc Workspace
- `ai-desktop-mate/` — **Ứng dụng Desktop chính** (Tauri v2 + Rust + Three.js + SQLite cục bộ). Chạy độc lập 100% ở chế độ offline/guest.
  - `src/core/`: State toàn cục, Three.js scene, particles, sound FX, P2P arena, animation binder.
  - `src/characters/`: Rig 3D (MicroDuck, Cyber Idol, VRM).
  - `src/physics/`: Vật lý cửa sổ Windows, tương tác icon desktop.
  - `src/backend/`: Logic AI Assistant (`assistant.ts`), Tool Forge (`toolForge.ts`), Cloud Hub Client (`cloudHubClient.ts`), Notification.
  - `src/frontend/components/`: Các modal/panel HTML tách riêng.
  - `src/frontend/dialogs/`: Helper kéo-thả hộp thoại (`dragHelper.ts`).
  - `src/frontend/features/`: Module tính năng tách riêng (`voiceAndErrorWatcher.ts`).
  - `src/frontend/styles/`: CSS phân tách theo vai trò (`base.css`, `panels.css`, `bubble-studio.css`, `animations.css`).
  - `src-tauri/src/backend/`: Rust commands (`llm.rs`, `cloud_hub.rs`, `tool_forge.rs`, `memory.rs`, `telemetry.rs`, `pc_control.rs`, `window_control.rs`, `mini_screen.rs`, `p2p.rs`, `tarot.rs`, `notification.rs`, `desktop_icons.rs`).
  - `src-tauri/tests/`: Bộ integration test Rust.
- `cloud-hub-backend/` — **Backend Online** (TypeScript + Express + MongoDB + SSE).
  - Xác thực Google OAuth 2.0 token phía server.
  - Lưu trữ `community_skills` (tìm kiếm, publish, star, xóa chính chủ, đếm lượt tải) và `chat_sync` (đồng bộ + stream token SSE 2 chiều giữa Desktop và Web Chat).
- `model_local_cloud/` — **Client kết nối GPU Colab qua Cloudflare Tunnel**.
  - Lưu cấu hình `colab_config.json` và client quét `/api/tags`, stream `/api/chat` NDJSON.
- `gpu_colab/` — Tài liệu & script mẫu triển khai Ollama trên Google Colab GPU L4.

## 2. Quy tắc bảo mật & Build
- Không commit file `.env` chứa secret; chỉ đưa `.env.example` vào gói phân phối.
- Không dùng emoji trong code/UI/log; không dùng `backdrop-filter: blur` trong CSS.
