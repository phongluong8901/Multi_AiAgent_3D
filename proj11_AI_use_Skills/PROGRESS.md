# Project Progress & Upgrade Log — `proj11_AI_use_Skills`

Tài liệu tổng hợp toàn bộ kiến trúc, lịch sử nâng cấp qua **20 giai đoạn**, hệ thống **209 tools đang hoạt động qua 6 pack**, Cognitive Memory OS, Chrome CDP chạy ẩn, Encrypted Web Vault (Windows DPAPI), Linux/Server DevOps Automation và hướng dẫn vận hành.

---

## 1. Mục tiêu dự án
Xây dựng nền tảng **Local Modular Gemini Skill Studio & Agent Workspace** kết nối kho skill Python tự tiến hóa (`AutoEvolve_AI` + PC Automation + Web Automation + Auto Skills) thành **Function Calling Tools** cho **Gemini API** và **9Router Multi-Provider Pool** (Gemini, Groq, Mistral, Cloudflare Workers AI), tối ưu sâu về tốc độ, tiết kiệm token, trí nhớ dài hạn, tự kiểm chứng chống ảo giác và tự vá lỗi.

---

## 2. Cấu trúc thư mục hiện tại (Modular Architecture)

```text
proj11_AI_use_Skills/
├── .venv/                         # Môi trường ảo Python 3.11 (tự động re-exec từ run_gemini_skills.py)
├── .env                           # API keys & GMAIL_USER / GMAIL_APP_PASSWORD (gitignored)
├── .env.example                   # Mẫu cấu hình API key
├── .gitignore                     # Bỏ qua .venv, .env, outputs, data, __pycache__
├── requirements.txt               # Toàn bộ thư viện cho cả 5 pack (incl. playwright, pyautogui, matplotlib, ...)
├── run_gemini_skills.py           # CLI/Web entrypoint (tự động chuyển vào .venv nếu chạy từ Python global)
├── run_web_ui.py                  # Khởi chạy trực tiếp Web UI (http://127.0.0.1:8000)
├── agent_runtime/                 # Package lõi Agent Runtime
│   ├── __init__.py                # Public exports
│   ├── config.py                  # KV-Cache Static-First system prompt, MODEL_STRENGTH_RANK, ESCALATION_TARGET_MODEL, Persona presets
│   ├── cdp_pool.py                # Persistent Playwright CDP Browser Pool (worker thread giữ kết nối Chrome 9222 nóng)
│   ├── credential_vault.py        # Encrypted Web Credential Vault (mã hóa Windows DPAPI AES, zero plaintext on disk)
│   ├── schema_builder.py          # Normalize 3 định dạng PGU schema, Query-Aware Extractive Tool Trimming, safe serialize
│   ├── skill_registry.py          # Quét đa gói 181 tools (Class + TOOL_SCHEMA/execute), risk_level, traceback, Hot-Reload
│   ├── skill_router.py            # Sub-Goal Multi-Cluster BM25 + Hybrid Embeddings + Schema Slicing + Speculative Exec + discover_tools + run_tool_pipeline
│   ├── skill_evolver.py           # Coder/Fixer + AST Anti-Reward-Hacking Gate + Pytest + Live Smoke Probe + Versioned v1/v2/v3 + Delete Skill
│   ├── llm_router.py              # 9Router đa nhà cung cấp (Gemini/Groq/Mistral/Cloudflare) + Adaptive EWMA Latency Routing
│   ├── web_app.py                 # FastAPI backend: SSE Streaming, Safety Gate, Web Vault API, Auto-Heal API, Insights, Outputs
│   ├── static/index.html          # Web UI tiếng Việt có dấu chuẩn, Lightbox Zoom ảnh/bảng + Tải CSV/TSV, Auto-Heal 1-click, Web Vault
│   ├── memory_store.py            # Cognitive Memory OS (SQLite WAL): facts + conflict history + decay, rules, entities, antipatterns, episodic logs, prospective tasks, embeddings
│   ├── memory_consolidator.py     # "Sleep Cycle" tổng hợp Episodic logs -> Semantic/Failure/Prospective memories & dọn log cũ
│   ├── profile_learner.py         # Auto-Profile Extractor (0 API) + Implicit Contrastive Habit Miner (học thói quen từ câu chỉnh)
│   ├── compactor.py               # Context Compaction 2 tầng (Tier-1 sạch chống học vẹt [Tool trace] + Tier-2 rolling summary)
│   ├── tool_cache.py              # SQLite TTL Cache (tự động tắt cache = 0 cho toàn bộ PC/Web/Hardware action tools)
│   ├── mlflow_tracker.py          # MLflow Tracing & Run logging (sqlite:///data/mlflow.db)
│   ├── telemetry.py               # Token Usage (in/out/thoughts/total) & ước tính chi phí USD
│   ├── healthcheck.py             # Smoke-test song song toàn bộ kho tool
│   ├── executor.py                # Gemini client + ngắt Ctrl+C tức thì trên Windows
│   ├── session.py                 # GeminiSkillSession: Working Memory $mem_N, Fuzzy Param Repair, Mid-Turn Escalation, Self-Verify, Vision, Speculative Exec, Pipeline
│   └── cli.py                     # Giao diện dòng lệnh (--chat, --web, --mlflow, --healthcheck, ...)
├── data/                          # SQLite databases (agent_memory.db, mlflow.db), web_vault.enc.json, skill_versions/ (gitignored)
├── outputs/                       # File báo cáo, biểu đồ PNG (.xlsx, .csv, .json, .md, .png)
├── PROGRESS.md                    # Tài liệu tiến độ & kiến trúc (file này)
└── skills/                        # 209 Tools Active across 6 packs
    ├── skill_contract.py          # Helper make_envelope tương thích local
    ├── auto_skills/               # 17 tools (zingmp3_crawler v5, xskt_scraper v8, chart_visualizer v2, mouse_controller, zalo_friend_counter, ...)
    ├── automationLinux_skills/    # 22 tools (systemd, nginx, ufw, cron, journald, ssh_auth_audit, tailscale/wireguard, chmod/rsync, env_vault, thermal, ...)
    ├── automationPc_skills/       # 70 tools (browser_cdp_controller, gmail_imap_smtp, zalo_desktop, docker, smart_file_ops, app_window_manager, screen_capture_annotator, ...)
    ├── automationWeb_skills/      # 24 tools (google_workspace_web tạo Sheet/Doc thật, chrome_*, web_*, youtube_web_controller, ...)
    ├── new_skills/                # 11 tools (datetime, calculator, local_workspace, user_memory, provider_model_checker, ...)
    └── search_skills/             # 65 tools (binance, forex, weather, arxiv, github, pypi, web_search, web_reader, browser_reader, document_analyzer, report_exporter, ...)
```

---

## 3. Lịch sử 19 Giai đoạn đã hoàn thành

### Giai đoạn 1–5 — Nền tảng Local, Modular Runtime, SQLite Memory, Streaming & MLflow
- [x] Chuyển đổi toàn bộ skill từ Colab sang Local (`.venv` Python 3.11, `skill_contract.py`, `outputs/`).
- [x] Tách cấu trúc modular `agent_runtime/`, hỗ trợ quét đa gói (`multi-pack`), chạy song song nhiều tool (`ThreadPoolExecutor`), ngắt `Ctrl+C` tức thì trên Windows.
- [x] Lưu trữ phiên chat & bộ nhớ dài hạn trên SQLite (`agent_memory.db`), TTL Tool Cache, Streaming, Token/Cost Telemetry và MLflow Tracing (`sqlite:///data/mlflow.db`).

### Giai đoạn 6–10 — Context Compaction, Web Studio 2 Tab, 9Router & Skill Versioning
- [x] Nén ngữ cảnh 2 tầng (`ContextCompactor`: Tier-1 cắt JSON thô + Tier-2 tóm tắt cuốn chiếu).
- [x] Giao diện Web 2 Tab (`Tab 1: Chat` | `Tab 2: Skill Studio`) với `SkillEvolver` 2 vai (Coder/Fixer + AST Security Gate + Pytest + Hot-Reload).
- [x] `MultiProviderRouter` (9Router) xoay vòng Gemini nhiều key + Groq + Mistral + Cloudflare Workers AI kèm cooldown thông minh.
- [x] No-Tool Fast Path, Compact Declarations, Tool Result Slimmer và quản lý version nối tiếp `v1`, `v2`, `v3` cho skill.

### Giai đoạn 11–13 — Adaptive Telemetry, Zero-Config BM25 Router & Personalization
- [x] Adaptive Bayesian Telemetry (`tool_metrics`), Fail-to-Backup Escalation, Phân tầng ưu tiên (Specialized First, Web Search Last), Experiential Playbooks.
- [x] Zero-Config Hybrid Router (BM25 + SQLite `tool_embeddings`), Missing-Skill Auto-Detector (`[[SUGGEST_SKILL: ...]]`), Insights Dashboard.
- [x] Cá nhân hóa: `user_rules`, `pending_facts` có kiểm duyệt, Feedback-to-Rule và `Auto-Profile Extractor`.

### Giai đoạn 14 — Cognitive Memory OS (Trí nhớ Nhận thức 3 pha)
- [x] **Failure / Anti-Pattern Memory (`tool_antipatterns`):** Tự ghi nhận lỗi tool và chỉ bơm chọn lọc anti-pattern cho đúng các tool đang được route; tự reset health khi Hot-Reload.
- [x] **Conflict Resolution & Time Decay (`user_fact_history`):** Lưu lịch sử các phiên bản fact bị thay thế (`valid_from`, `valid_to`, `deprecated`) và chấm điểm ưu tiên theo suy giảm thời gian (`effective_score`).
- [x] **Episodic Logs & Sleep Consolidation (`agent_runtime/memory_consolidator.py`):** Ghi nhận log sự kiện (TTL 14 ngày), tổng hợp thành trí thức sạch qua nút *"Tổng hợp Trí nhớ ngay"* hoặc tự chạy nền cuối phiên.
- [x] **Prospective Memory & Meta-Memory Auto-Flag:** Nhắc việc tương lai (`prospective_tasks`) và tự gắn cờ các skill hay lỗi kèm nút bỏ qua (`DELETE /api/insights/flag/{tool_name}`).

### Giai đoạn 15 — Nâng cấp Web UI tiếng Việt có dấu, SSE Real-Time, Lightbox & Safety Gate
- [x] Toàn bộ giao diện Web UI Việt hóa có dấu chuẩn UTF-8, loại bỏ hoàn toàn emoji (dùng SVG icon sạch), hỗ trợ đóng modal bằng `Esc`/backdrop và nút **Xóa Skill** ở Tab 2 (`POST /api/skills/delete`).
- [x] **Real-Time SSE Streaming (`POST /api/chat/stream`)** hiển thị trạng thái suy luận, từng bước gọi tool và token trả về trực tiếp.
- [x] **Human-in-the-Loop Safety Gate (`POST /api/chat/approve`):** Chỉ hỏi xác nhận 1 lần/lượt đối với thao tác xóa file/thư mục, format, gỡ cài đặt hoặc tắt máy (không làm phiền với thao tác đóng app/nhắn tin).
- [x] **Markdown Table & Image Lightbox:** Tự động kẻ bảng HTML kèm thanh công cụ **Phóng to**, **Tải CSV** (UTF-8 BOM), **Sao chép (TSV)** và xem phóng to/tải về cho ảnh biểu đồ PNG.

### Giai đoạn 16 — Chuẩn hóa 181 Tools (PC Automation + Web Automation + Auto Skills) & Live Smoke Probe
- [x] **Live Smoke Probe & Anti-Reward-Hacking Gate trong `SkillEvolver`:** Kiểm chứng gọi thật trên Windows UTF-8 (`PYTHONIOENCODING=utf-8`), chặn AST đối với dữ liệu giả (`fallback_data`/`mock_data`).
- [x] **Tự động chuẩn hóa Schema PGU (`normalize_tool_parameters`):** Hỗ trợ cả 3 kiểu shorthand schema cho toàn bộ PC/Web skills; vá hàng loạt `subprocess.run(..., encoding="utf-8", errors="replace")`, `_safe_call` lọc `**kwargs` và giới hạn chiều sâu `os.walk`.
- [x] **Nâng cấp các skill thực chiến trọng yếu:**
  - `skill_zalo_desktop.py` (gửi tin Zalo PC native), `skill_app_window_manager.py` (Start Menu `.lnk`, URL, `open_browser_search`), `skill_smart_file_ops.py` (`search_pc`, `search_recycle_bin`, `move_file`, `copy_file`), `skill_docker_local_manager.py` (`stop_all_running`, `start_docker_desktop`), `skill_chart_visualizer.py` (`v2`, matplotlib Agg dark theme), `skill_zingmp3_crawler.py` (`v5`, Playwright XHR), `skill_xskt_scraper.py` (`v8`, RSS), `skill_mouse_controller.py` (pacing mượt theo `loops`).
- [x] **Gộp trọn bộ 24 Web Automation Skills (`automationWeb_skills`):** Bao gồm 9 skill mới (`cookie_storage_ops`, `frame_shadow_piercer`, `hitl_captcha_guard`, `network_sniffer`, `selector_calibrator`, `som_a11y_observer`, `web_link_seo_auditor`, `web_pagination_scroller`, `youtube_web_controller`) — **129/129 pytest passed**.

### Giai đoạn 17 — Chrome CDP chạy ẩn, Encrypted Web Vault (DPAPI), Gmail & Google Sheets/Docs thật
- [x] **Encrypted Web Credential Vault (`agent_runtime/credential_vault.py` + Tab Hồ sơ & Bộ nhớ):** Mã hóa tài khoản web bằng **Windows DPAPI (`CryptProtectData`)** lưu tại `data/web_vault.enc.json` (0% plaintext trên đĩa, tự che `***[ENCRYPTED_IN_VAULT]***` trong mọi log/SQLite).
- [x] **Chrome CDP chạy ẩn (`skill_browser_cdp_controller.py`):** Cờ stealth `--disable-blink-features=AutomationControlled`, tự chạy ẩn `--headless=new` sau lần đăng nhập đầu tiên, bỏ `bring_to_front()` để không bật cửa sổ che màn hình; hỗ trợ `read_gmail_inbox`, `open_and_read_page`, `auto_login_site` (tự lưu mã hóa vào Vault khi login thành công ngay từ chat).
- [x] **Gmail IMAP/SMTP nâng cấp (`skill_gmail_imap_smtp.py`):** Decode chuẩn tiêu đề tiếng Việt RFC2047, đọc đầy đủ email `multipart/*` (text/plain + HTML stripped), tự nạp `.env` và nối fallback 2 chiều với Chrome CDP.
- [x] **Tạo Google Sheet & Google Doc thật trên Google Drive (`skill_google_workspace_web.py`):** `create_google_sheet` (mở `sheets.new`, đổi tên, ghi dữ liệu 2D qua Name Box không đụng clipboard) và `create_google_doc` (mở `docs.new`, đổi tên, ghi nội dung) qua phiên Google CDP chạy ẩn.

### Giai đoạn 18 — 5 Nâng cấp Lõi AI (Token, Tốc độ, Trí nhớ, Chống ảo giác)
- [x] **Progressive Tool Discovery (`discover_tools` Meta-Tool):** Chỉ nạp Top-K tool sát nhất ban đầu và tự mở khóa thêm từ kho 181 tools ngay giữa lượt khi phát sinh nhu cầu.
- [x] **KV-Cache Static-First Prefix + Query-Aware Tool Trimming:** Đặt toàn bộ phần tĩnh lên đầu prompt, làm tròn timestamp theo giờ (`%Y-%m-%d %H:00`) để tận dụng Gemini Implicit Context Caching; cắt tỉa output tool theo mức khớp từ khóa câu hỏi.
- [x] **Complexity-Aware Model Escalation (Chỉ nâng lên, không hạ cấp):** Tự nâng từ `flash-lite` lên `gemini-2.5-flash` cho câu hỏi phức tạp đa bước và giữ nguyên nếu đang dùng model mạnh hơn.
- [x] **Semantic-Filtered Memory Retrieval:** Luôn giữ core profile facts và lọc ký ức còn lại theo `effective_score * (1 + 3 * relevance)`.
- [x] **Execution Self-Verification Loop & Anti-Spoofing:** Đối chiếu mục tiêu hành động với trace thật; chặn tuyệt đối trò model tự bịa chuỗi `[Tool trace: ...]` hoặc khẳng định "Đã thực hiện" khi 0 tool call thật được chạy.

### Giai đoạn 19 — 14 Nâng cấp Chuyên sâu Tốc độ, Bộ nhớ & Tự chủ (Mục 1–15, trừ 13)
- [x] **(#1) Persistent `CDPBrowserPool` (`agent_runtime/cdp_pool.py`):** Giữ kết nối Playwright CDP sống liên tục trên dedicated worker thread, giảm độ trễ thao tác Gmail/Google Sheet xuống còn ~1 giây.
- [x] **(#2) Working Memory Bus (`$mem_N`):** Lưu kết quả dạng bảng/list trong RAM phiên chat (`$mem_1`, `$mem_2`...) và tự bơm trực tiếp sang tool kế tiếp (`rows="$mem_1"`) với **0 output token, 0% sai số**.
- [x] **(#3) Sửa `ContextCompactor` + Entity/Resource Memory (`recent_entities`):** Bỏ `[Tool trace: ...]` khỏi lời nói của `model` trong lịch sử nén để triệt tiêu học vẹt; tự ghi nhớ link Google Sheet/Doc và đường dẫn file vừa tạo để các lượt sau dùng lại ngay.
- [x] **(#4) Hybrid Vector + Lexical Memory & Router (`memory_embeddings`):** Kết hợp vector cosine cache trên SQLite với BM25/lexical cho cả kho 181 tools và bộ nhớ `user_facts`.
- [x] **(#5) 0ms Fuzzy Parameter Repair & Mid-Turn Failure Escalation:** Tự sửa tham số đồng nghĩa (`sheet_name -> title`, `file_path -> path`, ...) trong 0ms; tự leo thang model giữa lượt nếu gặp `>= 2` lỗi tool liên tiếp.
- [x] **(#6) Sub-Goal Multi-Cluster Routing:** Tách câu lệnh đa vế (`sau đó`, `rồi`, dấu phẩy) và gom đủ tool cho từng vế ngay từ Bước 1.
- [x] **(#7) Multimodal Vision Execution:** Tự đính kèm ảnh PNG/JPG (`types.Part.from_bytes`) từ các skill chụp màn hình/web/biểu đồ để Gemini nhìn trực tiếp.
- [x] **(#8) Action-Level Parametric Playbooks:** Lưu chuỗi `tool_name[action=...]` đã kiểm chứng thành công thay vì chỉ lưu tên tool.
- [x] **(#9) Implicit Contrastive Habit Miner (`detect_implicit_correction`):** Tự học thói quen ngầm (0 API cost) từ câu người dùng chỉnh sửa AI ở lượt tiếp theo.
- [x] **(#10) In-Chat One-Click Auto-Heal & Retry (`POST /api/skills/auto-heal`):** Nút *"Tự vá & Chạy lại"* ngay trên thẻ tool lỗi trong Tab Chat: tự sửa code -> Pytest + Smoke Probe -> Hot-Reload -> chạy lại câu hỏi.
- [x] **(#11) Speculative Step-0 Execution:** Chạy trước tức thì các tool đọc dữ liệu tất định (crypto, Docker list, giờ hệ thống) trước khi gọi LLM bước 1, cắt 50% số vòng gọi API.
- [x] **(#12) Intra-Tool Dynamic Schema Slicing:** Tự cắt tỉa các `action` thừa trong `enum` của mega-skill (`>= 5` actions) theo đúng câu hỏi hiện tại.
- [x] **(#14) Code-Act Micro-Pipeline (`run_tool_pipeline`):** Cho phép thực thi chuỗi 2–5 bước tool nối tiếp ngay trong Python local chỉ trong 1 lượt gọi LLM.
- [x] **(#15) Adaptive EWMA Latency & Reliability Routing (`llm_router.py`):** Chấm điểm động theo độ trễ EWMA và tỉ lệ lỗi thực tế của từng endpoint trong 9Router.

### Giai đoạn 20 — Tích hợp `automationLinux_skills` (22 Tools), Fuzzy Session Memory, Distillation & Phòng thủ cuối
- [x] **Tích hợp & Chuẩn hóa gói `automationLinux_skills` (22 tools, 122/122 pytest passed):** Bổ sung đầy đủ quản trị Linux/WSL/Server (`systemd`, `nginx`, `ufw`, `cron`, `journald`, `ssh_auth_audit`, `vpn_tunnel_monitor`, `file_perm_sync`, `env_secret_vault_ops`, `backup_snapshot_ops`, `hardware_bus_inspector`, `thermal_power`, `disk_io_smart`, `process_cgroups_guard`, `remote_worker_ctl`, `service_self_healer`, `alert_webhook_dispatch`, `incident_report_builder`, `worker_telemetry_bus`). Chuẩn hóa UTF-8, `_safe_call`, JSON Schema strict arrays và fallback đường dẫn đa nền tảng Windows/Linux (`outputs/nginx`, `outputs/systemd`, `outputs/cron`).
- [x] **OS-Affinity Guard trong `SkillRouter`:** Tự động kìm hãm các skill `linux_*` trên máy chủ Windows đối với các câu hỏi hệ thống chung để không bao giờ tranh chấp với `automationPc_skills`, đồng thời bật full ưu tiên ngay khi câu lệnh có ngữ cảnh Linux/Ubuntu/WSL/Nginx/Systemd/UFW/Cron/SSH.
- [x] **Topic-Clustered Fuzzy Session Memory & Cross-Session Faint Memory (`compactor.py`, `memory_store.py`):** Gom cụm chủ đề bằng Jaccard token trong phiên (phục hồi 100% độ nét cho cụm liên quan, làm mờ cụm lệch chủ đề) và tiêm ~5% ký ức mờ liên phiên suy giảm theo khoảng cách phiên + thời gian.
- [x] **Trajectory Distillation DB (`distillation_store.py`) & Local Ollama Provider (`llm_router.py`):** Xuất dữ liệu huấn luyện Qwen2.5-1.5B ChatML JSONL kèm cặp DPO và hỗ trợ chạy trực tiếp model nội bộ qua Ollama.
- [x] **Cơ chế Phòng thủ cuối Web & Desktop:** Tìm kiếm trực tiếp qua Chrome CDP (`cdp_live_search`) khi mọi công cụ search tĩnh bị chặn, và chụp/cuộn cửa sổ kèm tự khôi phục trạng thái cửa sổ ban đầu (`capture_app_window` + `restore_window=True`).

---

## 4. Tổng quan 209 Tools đang hoạt động (6 Packs)

| Pack | Số lượng Tools | Nhóm chức năng tiêu biểu |
| :--- | :---: | :--- |
| `automationPc_skills` | **70** | Chrome CDP (`read_gmail_inbox`, `auto_login_site`, `cdp_live_search`), Gmail IMAP/SMTP, Zalo Desktop, Docker Manager, Smart File Ops, App Window Manager, Process/Service/Registry, Office COM Excel/Word/PPT, OCR, Audio, Clipboard, Screen Capture (`capture_app_window`) |
| `search_skills` | **65** | Web Search, Web Reader, Browser Reader, Binance Crypto, Forex (hỗ trợ VND), Open-Meteo Weather, ArXiv, GitHub, HuggingFace, PyPI, Wikipedia, Hacker News, RSS, Document Analyzer (PDF/Tabular), Report Exporter (XLSX/CSV/JSON/MD) |
| `automationWeb_skills` | **24** | Google Workspace Web (`create_google_sheet`, `create_google_doc`), Chrome Cookie/Storage, Network Sniffer, Frame/Shadow Piercer, CAPTCHA/HITL Guard, SoM A11y Observer, Selector Calibrator, SEO Auditor, Pagination Scroller, YouTube Controller, E-commerce Tracker, Table Scraper, Zalo/Telegram Web |
| `automationLinux_skills` | **22** | Systemd Service/Unit Manager, Nginx Reverse Proxy & TLS Check, UFW Firewall Guard, Crontab/Timer Scheduler, Journald Log & OOM Analyzer, SSH Brute-Force/Config Audit, Tailscale/WireGuard Monitor, Chmod/Chown/Rsync, `.env` Secret Vault Audit, Tar Backup & Retention, USB/Serial/I2C/SPI/GPIO Inspector, Thermal Zones, Multi-Node Worker Control, Self-Healer Watchdog |
| `auto_skills` | **17** | Các skill tự tiến hóa & tạo mới: `chart_visualizer` (v2), `zingmp3_crawler` (v5), `xskt_scraper` (v8), `mouse_controller`, `zalo_friend_counter`, ... |
| `new_skills` | **11** | `datetime_client`, `calculator` (AST), `local_workspace`, `user_memory`, `provider_model_checker`, ... |
| **Tổng cộng** | **209** | **Tự động nạp đa gói + OS-Affinity Guard + Hot-Reload không cần restart** |

---

## 5. Hướng dẫn chạy nhanh

```powershell
# 1. Chạy Web UI đầy đủ (Chat SSE + Skill Studio + Cognitive Memory + Web Vault + MLflow)
python run_gemini_skills.py --web --mlflow

# 2. Mở MLflow UI xem Trace & Token/Cost Telemetry
mlflow ui --backend-store-uri sqlite:///data/mlflow.db

# 3. Xem danh sách toàn bộ 181 tools đã nạp
python run_gemini_skills.py --list-tools

# 4. Kiểm tra SkillRouter & Sub-Goal Routing (0 API cost)
python run_gemini_skills.py --route-test "đọc mail mới nhất trong gmail rồi tạo google sheet bao_cao"

# 5. Chat đa lượt trên CLI (SQLite + Streaming + TTL Cache + MLflow)
python run_gemini_skills.py --chat --mlflow

# 6. Chạy kiểm thử toàn bộ gói Web Automation Skills
.venv\Scripts\pytest.exe skills\automationWeb_skills\ -q
```
