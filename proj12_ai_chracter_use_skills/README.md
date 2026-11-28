# Project 12 — `proj12_ai_chracter_use_skills` (Duck AI 3D Character + 9Router + Cognitive Memory OS + 209 Skills)

Dự án hợp nhất kiến trúc **Phương án A (Native Rust/TS Core + Direct Python Skill Pack Adapter)** từ hai nền tảng:
- **Engine 3D, Win32 Physics, P2P Arena & Cloud Hub** của `proj10_ai_charater` (`ai-desktop-mate` + `cloud-hub-backend`).
- **9Router Multi-Provider API Rotation, Windows DPAPI Vault, Cognitive Memory OS & Kho 209 Tools (6 Packs)** của `proj11_AI_use_Skills`.

---

## 1. Cấu trúc thư mục

```text
proj12_ai_chracter_use_skills/
├── ai-desktop-mate/               # App Desktop Tauri v2 (Rust + Three.js + TypeScript)
│   ├── src/
│   │   ├── backend/
│   │   │   ├── assistant.ts       # Điều phối 9Router + Cognitive Memory + Pack Skill Dispatch
│   │   │   ├── contextCompactor.ts# Topic-Clustered Fuzzy Session Memory + Anti-Spoofing Guard
│   │   │   ├── toolForge.ts       # Xưởng Skill Sandbox & Self-Healing
│   │   │   └── cloudHubClient.ts  # Đồng bộ Skill Cộng đồng, Chat & Cognitive Memory 2 chiều
│   │   └── frontend/
│   │       ├── components/workspaceChatModal.ts # Giao diện 2-Tab Workspace Chat + Skill Studio + Lightbox
│   │       └── features/
│   │           ├── proj12BrainUi.ts   # Quản lý 9Router DPAPI Vault, Sleep Consolidator & Tab 209 Skills
│   │           └── workspaceChatUi.ts # Đa phiên SQLite, Bảng CSV/TSV, Ảnh Base64, Trace & Tự Đẻ/Tự Vá Skill
│   └── src-tauri/src/backend/
│       ├── llm_router.rs          # 9Router (Gemini đa key / Groq / Cloudflare) + EWMA + DPAPI crypt32.dll
│       ├── cognitive_memory.rs    # Cognitive Memory OS + Multi-Session Workspace Chat (ws_chat_sessions)
│       ├── skill_pack_adapter.rs  # BM25 Sub-Goal Router + OS-Affinity + $mem_N Working Memory + Python Runner
│       ├── skill_evolver_bridge.rs# Cầu nối SkillEvolver (Coder/Fixer + AST Anti-Hacking + Pytest + Smoke + v1/v2/v3)
│       ├── memory.rs              # winsqlite3.dll WAL Storage
│       ├── tool_forge.rs          # PowerShell / Python Sandbox Verification
│       └── cloud_hub.rs           # Google OAuth 2.0 PKCE + Cloud Sync
├── cloud-hub-backend/             # Express + TypeScript + MongoDB Atlas Sync API
│   └── src/
│       ├── auth.ts                # OAuth Validation + Secret-Scrubbing Memory Validator
│       ├── mongo.ts               # Collections: community_skills, chat_sync, english_vocab, cognitive_memory_sync
│       └── server.ts              # REST + SSE (/api/skills, /api/chat, /api/memory/sync)
├── skills/                        # Kho 209 Tools qua 6 Packs từ proj11
│   ├── automationPc_skills/       # 70 tools (Chrome CDP ẩn, Gmail IMAP/SMTP, Zalo PC, Docker, File Ops...)
│   ├── search_skills/             # 65 tools (Crypto, Forex VND, Weather, ArXiv, GitHub, PDF/Excel Analyzer...)
│   ├── automationWeb_skills/      # 24 tools (Google Sheets/Docs thật, Cookie/Storage, YouTube, Table Scraper...)
│   ├── automationLinux_skills/    # 22 tools (Systemd, Nginx, UFW, Cron, SSH Audit — có OS-Affinity Guard)
│   ├── auto_skills/               # 17 tools (Chart Visualizer, ZingMP3, XSKT, Mouse Controller...)
│   └── new_skills/                # 11 tools (Datetime, AST Calculator, Workspace, Memory...)
├── agent_runtime/                 # Thư viện Python tham chiếu & tiện ích bổ trợ từ proj11
├── model_local_cloud/             # Cấu hình kết nối Colab GPU Cloud Tunnel
└── requirements.txt               # Thư viện Python cho kho 209 tools
```

---

## 2. Các nâng cấp lõi đã tích hợp (Phương án A)

1. **9Router Xoay Vòng Đa API & Windows DPAPI Vault (`llm_router.rs`)**:
   - Gọi trực tiếp `CryptProtectData` / `CryptUnprotectData` của `crypt32.dll` (0% plaintext trên ổ cứng tại `data/api_keys.enc.json` và `data/web_vault.enc.json`, không làm phình dung lượng `.exe`).
   - Tự động gộp khóa từ `.env` (`GEMINI_API_KEY`, `GEMINI_API_KEYS`, `GROQ_API_KEY`, `GROQ_API_KEYS`, `CLOUDFLARE_API_TOKEN`) và DPAPI Vault.
   - Chấm điểm động theo độ trễ **Adaptive EWMA** và tỷ lệ lỗi; tự động đưa key dính `429` vào trạng thái `cooldown` (60s RPM / 600s Daily) và chuyển tức thì sang key/nhà cung cấp kế tiếp.

2. **Cognitive Memory OS & Context Compactor (`cognitive_memory.rs` + `contextCompactor.ts`)**:
   - Bổ sung 6 bảng nhận thức trên `winsqlite3.dll`: `cognitive_facts` (Time Decay), `user_fact_history` (lưu lịch sử xung đột), `cognitive_rules` (Auto-Profile & Implicit Contrastive Habit Miner 0 tốn API), `tool_antipatterns`, `episodic_logs`, `tool_playbooks`, `recent_entities`.
   - **Sleep Consolidation tự động**: Khi nhân vật MicroDuck chuyển sang trạng thái ngủ đông (`SLEEP`), hệ thống tự động tổng hợp `episodic_logs` thành `tool_playbooks` và dọn dẹp log quá 14 ngày.
   - **Topic-Clustered Fuzzy Session Memory**: Gom cụm chủ đề bằng Jaccard, giữ 100% độ nét cho chủ đề liên quan và làm mờ các lượt lệch chủ đề để tiết kiệm token.

3. **BM25 Sub-Goal Skill Router & Kho 209 Skills (`skill_pack_adapter.rs`)**:
   - Tự động quét và cache manifest của cả 2 chuẩn skill (`TOOL_SCHEMA` + `execute` và Class methods) trong ~2ms ở các lần mở sau.
   - Tách câu lệnh đa vế (`sau đó`, `rồi`, `;`), chấm điểm BM25 + Domain Hints + **OS-Affinity Guard** (tự ẩn `linux_*` trên Windows trừ khi hỏi về Linux/WSL/Server).
   - **Working Memory Bus (`$mem_1`, `$mem_2`...)** + **0ms Fuzzy Parameter Repair** (`sheet_name -> title`, `file_path -> path`) + **Anti-Spoofing Self-Verification**.

4. **Đồng bộ Cloud Hub 2 chiều (`cloud-hub-backend`)**:
   - Endpoint `GET/POST /api/memory/sync` đồng bộ hợp nhất `facts`, `rules`, `playbooks` theo tài khoản Google OAuth trên MongoDB Atlas, kèm bộ lọc tự động loại bỏ mọi trường chứa khóa bí mật (`api_key`, `password`, `dpapi:`).

---

## 3. Hướng dẫn chạy & Kiểm thử

```powershell
# 1. Kiểm thử Backend Cloud Hub
cd proj12_ai_chracter_use_skills\cloud-hub-backend
npm install
npm test

# 2. Kiểm thử Rust Core (DPAPI, 9Router EWMA/Cooldown, Cognitive Memory, BM25 & $mem_N)
cd ..\ai-desktop-mate\src-tauri
cargo test

# 3. Chạy ứng dụng Desktop 3D
cd ..
npm install
npm run tauri dev
```
