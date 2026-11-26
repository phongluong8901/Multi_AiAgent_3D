# Project Progress & Upgrade Log — `proj11_AI_use_Skills`

Tài liệu tổng hợp toàn bộ kiến trúc, những hạng mục đã triển khai, lỗi đã xử lý, danh sách 33 tool hiện có và lộ trình nâng cấp tiếp theo.

---

## 1. Mục tiêu dự án
Mang bộ skill Python được hệ thống `AutoEvolve_AI` sinh tự động trên GPU A100 (`skills/search_skills`) về môi trường local và kết nối thành **Function Calling Tools** cho **Gemini API** (`gemini-3.5-flash-lite` và chuỗi model dự phòng) để kiểm chứng khả năng chọn tool, gọi song song, tự sửa lỗi và phối hợp đa bước thực tế.

---

## 2. Cấu trúc thư mục hiện tại (Modular Architecture)

```text
proj11_AI_use_Skills/
├── .venv/                         # Môi trường ảo Python 3.11.9
├── .env                           # Chứa GEMINI_API_KEY (không commit lên git)
├── .env.example                   # Mẫu cấu hình API key
├── .gitignore                     # Bỏ qua .venv, .env, outputs, __pycache__
├── requirements.txt               # Toàn bộ thư viện Python cần thiết
├── run_gemini_skills.py           # Thin CLI entrypoint (~20 dòng, gọi agent_runtime.cli:main)
├── run_web_ui.py                  # Khởi chạy trực tiếp Web UI 2 Tab (http://127.0.0.1:8000)
├── agent_runtime/                 # Package lõi đã tách module rõ ràng để dễ scale & maintain
│   ├── __init__.py                # Public exports
│   ├── config.py                  # Đường dẫn (DATA_DIR), model, fallback chain, SKIP_MODULES, system prompt + facts + citation
│   ├── schema_builder.py          # Chuyển Python type annotation -> Gemini Schema, ép kiểu & serialize an toàn
│   ├── skill_registry.py          # Tự động quét đa gói (multi-pack) trong skills/*/skill_*.py + Hot-Reload
│   ├── skill_router.py            # Bộ lọc tool động (SkillRouter) hỗ trợ tiếng Việt không dấu & tiếng Anh
│   ├── skill_evolver.py           # Engine 2 vai (Coder + Fixer) -> AST Security Gate -> Pytest -> Backup & Rollback
│   ├── llm_router.py              # 9Router-style xoay vòng đa API free (Gemini nhiều key + Groq + Cloudflare Workers AI)
│   ├── web_app.py                 # FastAPI backend kết nối Tab 1 (Chat) và Tab 2 (Skill Studio)
│   ├── static/index.html          # Giao diện Web 2 Tab sạch sẽ (SVG Icons, Dark UI)
│   ├── memory_store.py            # SQLite store (data/agent_memory.db): sessions, messages, user_facts, tool_cache
│   ├── compactor.py               # Nén ngữ cảnh 2 tầng (Tier-1 cắt JSON thô 0 API + Tier-2 tóm tắt trượt /compact)
│   ├── tool_cache.py              # TTL Tool Cache lưu trên SQLite theo chính sách từng nhóm skill
│   ├── mlflow_tracker.py          # MLflow Tracing & Run logging (sqlite:///data/mlflow.db)
│   ├── telemetry.py               # Đo Token Usage (in/out/thoughts/total) & ước tính chi phí USD
│   ├── healthcheck.py             # Tự động smoke-test song song toàn bộ 36 tool (--healthcheck)
│   ├── executor.py                # Khởi tạo Gemini client, bọc thực thi ngắt Ctrl+C tức thì trên Windows
│   ├── session.py                 # GeminiSkillSession (streaming, SQLite memory, TTL cache, parallel tools, MLflow, fallback)
│   └── cli.py                     # Giao diện dòng lệnh (--chat, --session, --sessions, --facts, --mlflow, --healthcheck, ...)
├── data/                          # SQLite databases: agent_memory.db & mlflow.db (gitignored)
├── PROGRESS.md                    # File theo dõi tiến độ & hướng dẫn sử dụng (file này)
├── outputs/                       # Thư mục lưu báo cáo xuất ra (.xlsx, .csv, .json, .md)
├── colab/                         # Notebook gốc chạy trên Google Colab A100
└── skills/                        # Kho skill chia theo từng pack (thêm folder mới là tự động nhận)
    ├── skill_contract.py          # Helper make_envelope tương thích local
    ├── search_skills/             # 19 module AutoEvolve_AI (27 tool) + 12 module hạ tầng + 33 file test
    └── new_skills/                # 3 module thực chiến mới (6 tool): datetime, calculator, local_workspace
```

---

## 3. Các hạng mục đã hoàn thành

### Giai đoạn 1 — Chuyển đổi từ Colab sang Local & sửa lỗi nền tảng
- [x] Tạo môi trường ảo `.venv` (`Python 3.11.9`) và `requirements.txt` (cài đủ `google-genai`, `python-dotenv`, `tzdata`, `httpx`, `ddgs`, `playwright`, `beautifulsoup4`, `jsonschema`, `pypdf`, `pandas`, `openpyxl`, `pytest`).
- [x] Viết `run_gemini_skills.py` tự động quét class/method từ `skills/search_skills/skill_*.py` và sinh `types.FunctionDeclaration`.
- [x] **Sửa lỗi rò rỉ 28 hàm nội bộ `HTMLParser`:** Lọc bỏ private helper class (`_CleanTextExtractor`) và các method kế thừa, chỉ giữ public method định nghĩa trực tiếp trên class skill.
- [x] **Sửa lỗi thiếu `skill_contract.py`:** Tạo `skills/skill_contract.py` và tự động điều hướng `output_dir` của `ReportExporterSkill` sang `outputs/` local thay vì `/content/drive/...`.
- [x] **Sửa lỗi Schema `ARRAY`:** Tự động ánh xạ `list[T]`, `Optional[T]`, `Union[T1, T2]` kèm trường `items` chuẩn cho Gemini API.
- [x] **Sửa lỗi treo tiến trình & không nhận `Ctrl+C` trên Windows:** Đặt `HttpOptions(timeout=45000, retry_options=HttpRetryOptions(attempts=2))` và chạy các lệnh I/O blocking trong daemon thread (`_run_interruptible`) giúp ngắt `Ctrl+C` tức thì và không treo cứng khi API quá tải.
- [x] **Tối ưu Model Free Tier & Fallback tự động:** Chuyển model mặc định sang `gemini-3.5-flash-lite` (`500 RPD`, `15 RPM`) kèm chuỗi tự động fallback: `gemini-3.5-flash-lite` -> `gemini-3.1-flash-lite` -> `gemini-2.5-flash` -> `gemini-3.8-flash` khi gặp `503`/`429`/`404`/`TimeoutError`.

### Giai đoạn 2 — Nâng cấp Agent thực chiến
- [x] **Nhớ ngữ cảnh hội thoại (Multi-turn Memory trong `--chat`):**
  - Xây dựng lớp `GeminiSkillSession` giữ nguyên lịch sử hội thoại xuyên suốt nhiều lượt chat.
  - Hỗ trợ bảo toàn lịch sử (`chat.get_history()`) ngay cả khi tự động fallback model hoặc đổi model giữa chừng.
  - Hỗ trợ lệnh tương tác trong `--chat`: `/reset`, `/history`, `/model <id>`, `/topk <n>`, `/tools`, `exit`.
- [x] **Sửa lỗi lệch múi giờ & bổ sung Skill Đồng hồ (`skill_datetime_client.py`):**
  - Thêm `datetime_client__get_current_time` (hỗ trợ tên thành phố như `Hanoi`, `Ho Chi Minh`, `Tokyo`, `UTC` hoặc chuẩn IANA, trả ngày/giờ/thứ tiếng Việt & UTC offset).
  - Thêm `datetime_client__convert_timezone` giúp chuyển đổi chính xác giờ UTC từ API thời tiết sang GMT+7.
  - Chèn mốc thời gian thực tế (`Asia/Ho_Chi_Minh`) vào `SYSTEM_INSTRUCTION` mỗi lượt gọi.
- [x] **Xây dựng Skill Router (`skill_router.py`):**
  - Lọc động `top_k` tool phù hợp nhất theo từng câu hỏi (mặc định `--top-k 10`, đặt `0` để gửi toàn bộ 33 tool).
  - Chuẩn hóa tiếng Việt không dấu + từ khóa chuyên ngành + tự động ghim (`pinned_tools`) các tool đã dùng ở các lượt trước trong phiên `--chat`.
  - Hỗ trợ test router không tốn API qua `--route-test "<query>"`.
- [x] **Bổ sung các skill thực chiến còn thiếu & vá API:**
  - `skill_datetime_client.py`: Đồng hồ đa múi giờ & đổi múi giờ.
  - `skill_calculator.py`: Máy tính toán học an toàn dựa trên AST (không dùng `eval()`), hỗ trợ biểu thức khoa học và tính `%` thay đổi (`evaluate`, `percent_change`).
  - `skill_local_workspace.py`: Đọc/liệt kê file trong dự án an toàn (chặn tuyệt đối `.env`, `credentials.json` và chặn path traversal ra ngoài thư mục dự án).
  - Nâng cấp `skill_frankfurter_forex_client.py`: Bổ sung fallback sang `open.er-api.com` khi Frankfurter (ECB) trả `404` — hỗ trợ trực tiếp `USD -> VND` và 160+ loại tiền tệ.

### Giai đoạn 3 — Tái cấu trúc Modular Architecture (`agent_runtime/`)
- [x] Tách toàn bộ file `run_gemini_skills.py` (~600 dòng) thành package `agent_runtime/` gồm 7 module độc lập theo đúng trách nhiệm (`config`, `schema_builder`, `skill_registry`, `skill_router`, `executor`, `session`, `cli`), giữ `run_gemini_skills.py` làm thin entrypoint (~20 dòng).
- [x] Nâng cấp `SkillRegistry` hỗ trợ **tự động quét đa gói (multi-pack)** trên toàn bộ thư mục con của `skills/` (`skills/search_skills/`, `skills/new_skills/`, và mọi gói `skills/<domain>_skills/` tạo mới về sau).
- [x] Thêm tùy chọn `--pack <ten_goi>` cho CLI để nạp chọn lọc một hoặc nhiều gói skill khi test.

### Giai đoạn 4 — Tối ưu hiệu năng, Telemetry, Citation Grounding & Healthcheck
- [x] **Chạy song song nhiều Tool trong cùng 1 Step (`ThreadPoolExecutor`):** Khi Gemini gọi đồng thời 2+ tool ở cùng 1 bước, `GeminiSkillSession._execute_tool_batch` chạy song song, giữ nguyên thứ tự trả về và in thời gian thực thi từng tool (`ms`).
- [x] **Token Usage & Cost Telemetry (`agent_runtime/telemetry.py`):** Tự động trích xuất `usage_metadata` sau mỗi lượt API, in `[TELEMETRY] calls=... | in=... | out=... | total=... | est_payg=$...` và cộng dồn tổng phiên trong lệnh `/history`.
- [x] **Bắt buộc kèm link nguồn (Citation Grounding):** Siết chặt `SYSTEM_INSTRUCTION` yêu cầu luôn xuất mục `Nguon tham khao:` với link Markdown đúng URL từ tool trả về.
- [x] **Skill Healthcheck tự động (`agent_runtime/healthcheck.py`):** Bổ sung `--healthcheck`, `--healthcheck-offline`, `--include-browser` kiểm tra song song toàn bộ 33 tool và in bảng `PASS / FAIL / SKIP / TIME`.

### Giai đoạn 5 — SQLite Memory, TTL Tool Cache, Streaming & MLflow Tracing
- [x] **Lưu trữ Phiên Chat & Bộ nhớ dài hạn bằng SQLite (`agent_runtime/memory_store.py` + `skills/new_skills/skill_user_memory.py`):**
  - Cơ sở dữ liệu `data/agent_memory.db` (WAL mode) gồm 4 bảng: `sessions`, `messages`, `user_facts`, `tool_cache`.
  - Phiên `--chat` tự động lưu toàn bộ hội thoại; khôi phục bất kỳ phiên cũ nào qua `--session <id>` hoặc `/load <id>`, xem danh sách qua `--sessions` / `/sessions`.
  - Thêm skill `user_memory` (`remember_fact`, `recall_facts`, `forget_fact`) và tự động nạp `user_facts` vào `SYSTEM_INSTRUCTION` mỗi lượt.
- [x] **Streaming câu trả lời + TTL Tool Cache (`agent_runtime/tool_cache.py`):**
  - Bật mặc định `send_message_stream` giúp chữ hiện ra trực tiếp từng cụm từ (tắt được bằng `--no-stream`).
  - Cache kết quả tool vào SQLite theo TTL riêng từng nhóm (`60s` crypto, `300s` forex/thời tiết/web search, `600s-1800s` docs/wiki/geocode, không cache đồng hồ/export/memory; tắt được bằng `--no-cache` hoặc xóa bằng `/cache-clear`).
- [x] **Tích hợp MLflow Tracing & Evaluation (`agent_runtime/mlflow_tracker.py`):**
  - Bật qua `--mlflow` (lưu trực tiếp vào `sqlite:///data/mlflow.db`), ghi lại cây spans (`agent_turn` -> `llm_step` -> `tool_batch`) cùng toàn bộ params/metrics (`elapsed_sec`, `input_tokens`, `output_tokens`, `est_cost_usd`, `tool_success_rate`, `cache_hits`).

### Giai đoạn 6 — Nén ngữ cảnh tự động 2 tầng (`agent_runtime/compactor.py`)
- [x] **Tier 1 — Cắt bỏ JSON thô của `function_response` sau mỗi lượt (0 API call, 0ms):** Sau khi model đã tổng hợp xong câu trả lời cho một lượt, toàn bộ payload JSON trung gian (`function_call` + `function_response` nặng hàng nghìn ký tự) được thu gọn thành cặp `(user_prompt, final_answer + [Tool trace: ...])`, tiết kiệm 50%–80% input token cho các lượt tiếp theo.
- [x] **Tier 2 — Tóm tắt cuốn chiếu (Sliding-Window Rolling Summary):** Tự động kích hoạt khi `peak_input_tokens >= 10,000` (tùy chỉnh qua `--compact-threshold`) hoặc gõ tay `/compact` trong `--chat`: giữ nguyên 3 lượt gần nhất và nén toàn bộ các lượt cũ hơn thành một bản tóm tắt bảo toàn số liệu, link URL và tên file.

### Giai đoạn 7 — Giao diện Web 2 Tab & Self-Evolving Skill Studio (`web_app.py` + `skill_evolver.py`)
- [x] **Giao diện Web 2 Tab (`http://127.0.0.1:8000`):**
  - **Tab 1 — Chat & Dùng Skill:** Quản lý phiên SQLite, chọn model & `top_k`, tải trực tiếp file báo cáo trong `outputs/`, xem chi tiết `[TRACE]` từng tool. Mỗi dòng tool đều có nút **"Sua / Nang cap Skill nay"** chuyển thẳng sang Tab 2 kèm sẵn tên file và ngữ cảnh tham số.
  - **Tab 2 — Viết / Sửa Skill, Pytest & Hot-Reload:** Hỗ trợ 2 chế độ: **Sửa / nâng cấp skill có sẵn** hoặc **Tạo skill mới (`skills/auto_skills/`)**. Cho phép xem/sửa trực tiếp cả `skill_*.py` lẫn `test_skill_*.py`, khôi phục bản backup 1 click.
- [x] **Engine Tự tiến hóa 2 vai (`SkillEvolver`):** Coder sinh code -> `validate_skill_ast` chặn hàm nguy hiểm -> chạy `pytest` cô lập trong thư mục tạm -> nếu đỏ thì Fixer tự đọc traceback vá lỗi (tối đa 3 vòng) -> lưu bản backup cũ vào `data/skill_backups/` -> ghi file mới và **Hot-Reload** thẳng vào `SkillRegistry` + `GeminiSkillSession` đang chạy ở Tab 1.

### Giai đoạn 8 — 9Router Multi-Provider Free API Pool (`agent_runtime/llm_router.py`)
- [x] Xây dựng `MultiProviderRouter` xoay vòng tự động qua nhiều nhà cung cấp API miễn phí (**Gemini nhiều key**, **Groq** `llama-3.3-70b-versatile` / `llama-3.1-8b-instant`, **Cloudflare Workers AI** `llama-3.3-70b-instruct-fp8-fast` / `llama-3.1-8b-instruct`).
- [x] Tự động chuyển đổi schema giữa Gemini `FunctionDeclaration` và chuẩn OpenAI `tools` (Groq/Cloudflare) để dùng chung toàn bộ 36 tool trên mọi provider.
- [x] Cơ chế cooldown thông minh theo từng endpoint (`60s` cho 429 RPM, `600s` cho hết RPD ngày, `30s` cho 503/timeout, `disabled` cho 401/403) cùng 2 chiến lược `priority` và `round_robin`.
- [x] Tích hợp vào cả CLI (`--router-status`, `--model auto`, `--model groq`, `/router`) và Web UI (chọn `auto` / `groq` / `cloudflare` + bảng trạng thái `9Router Pool` trực tiếp ở sidebar Tab 1).

### Giai đoạn 9 — Tối ưu cắt 60–85% Token & Hỗ trợ gói `automationPc_skills` (`TOOL_SCHEMA + execute`)
- [x] **No-Tool Fast Path (`SkillRouter.needs_tools`):** Tự động gửi `tools = []` cho câu chat xã giao, giải thích khái niệm, dịch thuật, viết văn bản thuần -> tiết kiệm ~90% input token.
- [x] **Nén Schema Tool (`Compact Declarations`):** Rút gọn docstring <= 88 ký tự, lược bỏ description thừa cho các tham số tự hiểu (`city`, `query`, `url`, `symbol`, ...) và giảm `DEFAULT_TOP_K` từ `10` xuống `6`.
- [x] **Tool Result Slimmer (`schema_builder.slim_tool_payload`):** Nén cấu trúc kết quả Step 2 (`web_search` giữ top 4 với `snippet[:180]`, cắt text dài ở `2,200 ký tự`, tổng payload <= `2,800 ký tự`, tự ẩn biến môi trường nhạy cảm `*_KEY`/`*_TOKEN`/`*_SECRET`).
- [x] **Hỗ trợ chuẩn skill thứ 2 (`TOOL_SCHEMA + execute`):** Mở rộng `SkillRegistry` nạp thành công toàn bộ 6 tool của `skills/automationPc_skills/` (`50/50 pytest passed`), nâng tổng kho lên **42 tool** qua 3 pack (`automationPc_skills(6)`, `new_skills(9)`, `search_skills(27)`).

### Giai đoạn 10 — Thêm Mistral AI vào 9Router & Quản lý Version Skill nối tiếp (`v1`, `v2`, `v3`...)
- [x] **Tích hợp Mistral AI (`MISTRAL_API_KEY`):** Thêm `mistral-small-latest` và `open-mistral-nemo` vào `MultiProviderRouter` (OpenAI-compatible + Function Calling), `ProviderModelCheckerClient` và dropdown Web UI (`auto`, `groq`, `mistral`, `cloudflare`, Gemini).
- [x] **Lưu trữ Version nối tiếp cho Skill (`data/skill_versions/<pack>/<module>/v1, v2, v3...`):** Không xóa hay ghi đè mất code cũ; lần sửa đầu tự lưu bản gốc thành `v1`, các bản cập nhật sau lưu nối tiếp thành `v2`, `v3`, ... kèm `manifest.json`.
- [x] **Tab 2 UI Version Selector:** Thêm dropdown chọn xem trước bất kỳ version nào (`v1`, `v2`, `v3 [ACTIVE]`) và nút **"Kich hoat Version"** để chuyển đổi nóng mà không xóa các version khác.

### Giai đoạn 11 — Adaptive Tool Telemetry, Phân tầng Ưu tiên, Fail-to-Backup & Playbooks
- [x] **Adaptive Tool Telemetry Scoring (`tool_metrics` trong SQLite):** Tự động ghi nhận `calls`, `successes`, `avg_ms`, `consecutive_failures` của từng tool. Điểm chấm dùng làm mịn Bayesian (tool mới chưa gọi vẫn có prior cao nên không bị bỏ đói; tool chính lỗi liên tiếp sẽ tự nhường hạng cho tool dự phòng).
- [x] **Fail-to-Backup Escalation giữa lượt (`_escalate_backups_if_failed`):** Khi một tool hạng cao gọi bị lỗi (`ok=False`) ở Step 1, hệ thống lập tức mở khóa tool dự phòng cùng nhóm (ví dụ `open_meteo` lỗi -> mở khóa `weather_api_client` + `web_search`; `web_reader` lỗi -> mở khóa `browser_reader`) ngay ở Step 2 kèm gợi ý cho LLM.
- [x] **Quy tắc Phân tầng Ưu tiên (Specialized First, Web Search Last):** Ưu tiên Tầng 1 (Local/Deterministic/PC `0–50ms`) -> Tầng 2 (Structured API `200–1200ms`) -> Tầng 3 (`web_search`/`browser_reader` cuối cùng).
- [x] **Experiential Playbooks (`tool_playbooks` trong SQLite):** Có sẵn 5 mẫu phối hợp chuẩn và tự động học/củng cố thêm các chuỗi phối hợp 2–4 tool thành công thực tế (xem qua `--playbooks`, `--tool-stats` hoặc `/playbooks`, `/stats`).

### Giai đoạn 12 — Zero-Config Hybrid Router (BM25 + SQLite Embeddings), Missing-Skill Detector & Insights Dashboard
- [x] **Zero-Config Hybrid Router (`skill_router.py` + bảng `tool_embeddings` trong SQLite):** Tự động đánh chỉ mục BM25 toàn văn (tên hàm, docstring, tên tham số, giá trị `enum`) cho toàn bộ 82+ tool (không cần khai báo từ khóa tay khi thêm skill mới) kết hợp vector embedding cache nền trên SQLite.
- [x] **Missing-Skill Auto-Detector (`[[SUGGEST_SKILL: ...]]`):** Khi kho tool hiện tại chưa đáp ứng được yêu cầu thực tế của người dùng, Tab 1 tự động hiển thị thẻ `[DE XUAT SKILL MOI]` kèm nút **1-Click "Mo Tab 2 & Tao Skill nay ngay"** điền sẵn tên module và yêu cầu kỹ thuật.
- [x] **Web UI Insights Dashboard (`/api/insights` + Modal "Thong ke & Playbooks"):** Hiển thị trực tiếp bảng `tool_metrics` (Calls, OK%, Avg Latency, Consec Fail + nút nhảy sang Tab 2 sửa tool lỗi) và danh sách `tool_playbooks` ngay trên Web UI.

### Giai đoạn 13 — Cá nhân hóa & Tự học từ người dùng (`profile_learner.py` + `user_rules` + `pending_facts`)
- [x] **Feedback-to-Rule Learning (mặc định không góp ý = hài lòng):** Dưới mỗi câu trả lời ở Tab 1 có nút gọn **"Gop y / Sua thoi quen"**; nhập góp ý sẽ lưu thành Quy tắc cá nhân (`user_rules` trong SQLite) và tự động nạp vào `SYSTEM_INSTRUCTION` cho mọi model (Gemini, Groq, Cloudflare).
- [x] **Auto-Profile Extractor có kiểm duyệt (`agent_runtime/profile_learner.py`):** Trích xuất ngầm (0 API call, <1ms) các thông tin bền vững (tên, thành phố mặc định, tech stack, sở thích phong cách) vào hàng chờ `pending_facts` kèm badge thông báo chờ bạn bấm **Duyet** hoặc **Bo qua**.
- [x] **Màn hình "Ho so & Quy tac" ngay trên Web UI:** Quản lý trực tiếp 3 mục (Đề xuất AI tự học chờ duyệt, Quy tắc ứng xử cá nhân bật/tắt/xóa, và Hồ sơ `user_facts`).

---

## 4. Danh sách đầy đủ 44 Tool đang hoạt động (30 Skill Modules)

| Nhóm | Module | Tools |
| :--- | :--- | :--- |
| **Thời gian & Tính toán (Mới)** | `skill_datetime_client` | `datetime_client__get_current_time`, `datetime_client__convert_timezone` |
| **Thời gian & Tính toán (Mới)** | `skill_calculator` | `calculator__evaluate`, `calculator__percent_change` |
| **Workspace nội bộ (Mới)** | `skill_local_workspace` | `local_workspace__list_files`, `local_workspace__read_text_file` |
| **Tài chính** | `skill_binance_crypto_client` | `binance_crypto_client__get_crypto_price` |
| **Tài chính** | `skill_frankfurter_forex_client` | `frankfurter_forex_client__get_exchange_rate` *(đã hỗ trợ VND)* |
| **Thời tiết & Địa lý** | `skill_open_meteo_weather_client` | `open_meteo_weather_client__get_current_weather` |
| **Thời tiết & Địa lý** | `skill_weather_api_client` | `weather_api_client__get_current_weather`, `get_latitude`, `get_longitude` |
| **Thời tiết & Địa lý** | `skill_openstreetmap_api_client` | `openstreetmap_api_client__get_coordinates` |
| **Thời tiết & Địa lý** | `skill_ip_geolocation_client` | `ip_geolocation_client__get_geolocation` |
| **Web & Tin tức** | `skill_web_search` | `web_search__search` |
| **Web & Tin tức** | `skill_web_reader` | `web_reader__read_url` |
| **Web & Tin tức** | `skill_browser_reader` | `browser_reader__read_dynamic_page`, `browser_reader__extract_elements` |
| **Web & Tin tức** | `skill_network_inspector` | `network_inspector__inspect_url` |
| **Web & Tin tức** | `skill_rss_feed_reader` | `rss_feed_reader__get_latest_articles` |
| **Web & Tin tức** | `skill_hacker_news_api_client` | `hacker_news_api_client__get_top_stories`, `get_story` |
| **Web & Tin tức** | `skill_wikipedia_api_client` | `wikipedia_api_client__get_summary` |
| **Dev & Học thuật** | `skill_arxiv_api_client` | `arxiv_api_client__search_papers` |
| **Dev & Học thuật** | `skill_github_api_client` | `github_api_client__search_repositories` |
| **Dev & Học thuật** | `skill_huggingface_api_client` | `huggingface_api_client__search_models` |
| **Dev & Học thuật** | `skill_pypi_api_client` | `pypi_api_client__get_package_info` |
| **Tài liệu & Báo cáo** | `skill_document_analyzer` | `document_analyzer__read_pdf`, `document_analyzer__analyze_tabular` |
| **Tài liệu & Báo cáo** | `skill_report_exporter` | `report_exporter__export_csv`, `export_json`, `export_markdown`, `export_xlsx` |

---

## 5. Hướng dẫn chạy nhanh

```powershell
# 1. Kich hoat moi truong ao
.\.venv\Scripts\Activate.ps1

# 2. Xem danh sach 33 tool da nap
python run_gemini_skills.py --list-tools

# 3. Kiem tra SkillRouter chon tool (khong ton API)
python run_gemini_skills.py --route-test "lay gia BTCUSDT va doi sang VND roi xuat file excel"

# 4. Chat da luot co nho ngu canh (mac dinh gemini-3.5-flash-lite, top-k=10)
python run_gemini_skills.py --chat

# 5. Chay 1 prompt le (tat router de gui ca 33 tool bang --top-k 0)
python run_gemini_skills.py --top-k 0 --prompt "Hom nay la thu may, may gio o Ha Noi va gia 1 BTC quy ra VND la bao nhieu?"

# 6. Chay bo benchmark 5 bai test tong hop
python run_gemini_skills.py --benchmark
# 7. Chay healthcheck tu dong toan bo 36 tool (hoac chi test offline)
python run_gemini_skills.py --healthcheck
python run_gemini_skills.py --healthcheck-offline

# 8. Chat co luu SQLite + MLflow Tracing + Streaming + TTL Cache
python run_gemini_skills.py --chat --mlflow
python run_gemini_skills.py --sessions
python run_gemini_skills.py --chat --session <session_id>

# 9. Mo giao dien MLflow UI de xem Trace & Benchmark metrics
mlflow ui --backend-store-uri sqlite:///data/mlflow.db

# 10. Mo Giao dien Web 2 Tab (Tab 1: Chat | Tab 2: Viet/Sua Skill + Pytest + Hot-Reload)
python run_web_ui.py
# hoac:
python run_gemini_skills.py --web --mlflow
```

---

## 6. Lộ trình nâng cấp tiếp theo (Backlog)
- [ ] **Self-Evolving Skill Creator (Hot-reload):** Cho phép Agent tự viết file `skill_*.py` + `pytest`, tự kiểm thử và hot-reload vào `SkillRegistry` ngay trong phiên chat.
- [ ] **Semantic Skill Router:** Nâng cấp `SkillRouter` dùng embedding (`gemini-embedding-2`) khi kho skill vượt mốc 100+ tool.
- [ ] **Web UI (Streamlit / FastAPI):** Giao diện chat trực quan hiển thị từng bước gọi tool dạng thẻ, bảng dữ liệu và nút tải file từ thư mục `outputs/`.
