# Kien Truc & Quy Trinh Hoat Dong Cua He Thong Autonomous Self-Learning Agent

Tai lieu nay mo ta toan bo kien truc, quy trinh van hanh (workflow) va cac tinh nang nang cap chuyen sau giup he thong vuot troi hoan toan so voi RAG (Retrieval-Augmented Generation) truyen thong.

---

## 1. Tong quan He thong & Kien truc Microservices

Dự án được triển khai dưới dạng hệ thống Microservices được điều phối qua `docker-compose.yml`, bao gồm 5 dịch vụ chính:

```
[ Frontend: React 19 + Vite + TypeScript ] (Port 3001)
                    |
              (WebSocket Realtime & REST API)
                    v
[ Gateway Service: Node.js + Express + TypeScript ] (Port 4000)
                    |
              (HTTP Internal Calls & Webhooks)
                    v
[ AI Core Service: Python FastAPI + LangGraph + Gemini ] (Port 8000)
        |                                       |
  (Short-term Memory)                     (Long-term Memory)
        v                                       v
[ Redis Memory ] (Port 6379)            [ Qdrant Vector DB ] (Port 6333)
```

### Chi tiet cac thanh phan:
1. **Frontend (`frontend`)**: Giao diện Dashboard React 19, Tailwind CSS, Lucide React icons. Kết nối WebSocket Socket.IO thời gian thực để hiển thị tin nhắn, chuỗi suy luận (Reasoning Trace), bảng tri thức/kinh nghiệm phân tách và kết quả tự học độc lập.
2. **Gateway Service (`gateway-service`)**: Reverse Proxy, WebSocket Hub thời gian thực và quản lý Cronjob tự học định kỳ.
3. **AI Core Service (`ai-core-service`)**: Trung tâm nhận thức của AI, sử dụng LangGraph State Machine, tích hợp Google Gemini (`gemini-3.5-flash-lite`), Tavily Search API, và LangSmith Tracing.
4. **Redis (`ai_redis_memory`)**: Bộ nhớ ngắn hạn (Short-term Context Memory) lưu trữ lịch sử hội thoại của từng session với TTL 24 giờ.
5. **Qdrant Vector DB (`ai_qdrant_memory`)**: Bộ nhớ dài hạn (Long-term Episodic & Semantic Memory) với 2 collections:
   - `knowledge_base`: Lưu trữ các sự kiện, số liệu, định nghĩa và thông tin người dùng.
   - `agent_experiences`: Lưu trữ các bài học kinh nghiệm về chiến lược tìm kiếm và tối ưu quy trình giải quyết vấn đề.

---

## 2. Bang so sanh: Traditional RAG vs. Autonomous Cognitive Agent

| Tieu chi | Traditional RAG (RAG thong thuong) | Autonomous Cognitive Agent (He thong nay) |
| :--- | :--- | :--- |
| **Co che tiep nhan tri thuc** | Thụ động: Chỉ truy xuất tài liệu tĩnh có sẵn từ trước do con người nạp vào. | **Tự học liên tục (Continual Learning)**: Tự trích xuất dữ kiện mới sau mỗi ca làm việc và tự học chủ động qua Web Search. |
| **Kiem dinh chat luong** | Không kiểm định: Vector DB trả về chunk nào thì LLM tin chunk đó (dễ bị ảo giác). | **Self-Correction & Critique Loop**: AI tự chấm điểm (1-10) và tự sửa câu trả lời nếu chưa trung thực hoặc chưa bám sát nguồn. |
| **Xu ly mau thuan tri thuc** | Bị lỗi bối rối: Nếu thông tin cũ và mới mâu thuẫn (ví dụ User đổi nơi ở), RAG sẽ trả lời lẫn lộn cả hai. | **Belief Revision & Conflict Resolution**: Tự phát hiện mâu thuẫn, vô hiệu hóa thông tin cũ (`deprecated`) và cập nhật thông tin mới nhất làm chân lý (`active`). |
| **Phan loai tri thuc** | Coi mọi văn bản như nhau (Text Chunks phẳng). | **Phân tách nhị nguyên**: Tách bạch giữa **Tri thức sự kiện** (`knowledge_base`) và **Bài học kinh nghiệm thực thi** (`agent_experiences`). |
| **Quan ly rac bo nho** | Càng dùng lâu càng phình to, dễ bị loãng từ khóa tìm kiếm. | **Memory Consolidation (Sleep Phase)**: Tiến trình dọn dẹp định kỳ dọn sạch các fact mâu thuẫn/lỗi thời và tối ưu hóa chỉ mục. |
| **Dong bo giao dien** | Dùng polling hoặc chờ reload thủ công. | **Event-driven Socket.IO**: Qdrant lưu xong lúc nào thì giao diện cập nhật ngay lập tức mili-giây đó. |

---

## 3. Quy trinh hoat dong cua LangGraph State Machine

Mỗi câu hỏi của người dùng sẽ đi qua một chu trình đồ thị trạng thái khép kín:

```
[ User Input ]
      |
      v
[ 1. recall_memory_node ] <---> (Truy xuất Redis & Qdrant với bộ lọc active)
      |
      v
[ 2. evaluate_knowledge_node ] ---> (Gemini đánh giá đủ hay thiếu thông tin)
      |
      +---> [ needs_web_search == True ]  ---> [ 3. web_search_node ] (Tavily Search API)
      |                                              |
      +---> [ needs_web_search == False ]            |
      |                                              v
      +-------------------------------------> [ 4. synthesize_response_node ]
                                                     |
                                                     v
                                              [ 5. critique_response_node ] (Self-Correction & Grading)
                                                     |
                                                     v
                                              [ Trả lời User qua Socket.IO ]
                                                     |
                                       (Kích hoạt Background Task ngầm)
                                                     v
                                  [ background_continual_learning ]
                                                     |
                                     (Belief Revision + Deduplication)
                                                     v
                                      [ Lưu Qdrant & Redis ]
                                                     |
                                          (Webhook thông báo)
                                                     v
                                [ Gateway Socket.IO phát sóng realtime ]
```

### Chi tiet cac buoc trong Graph:
1. **`recall`**:
   - Đọc 10 tin nhắn gần nhất từ Redis theo `session_id`.
   - Tìm kiếm Cosine Similarity trong Qdrant nhưng **tự động lọc bỏ các fact đã bị vô hiệu hóa** (`status != "deprecated"`).
   - Lấy top tri thức liên quan và top kinh nghiệm giải quyết vấn đề từ quá khứ.
2. **`evaluate`**:
   - Dùng mô hình Gemini với Structured Output để phân tích: Tri thức hiện có đã đủ trả lời chưa?
   - Nếu đủ: Bỏ qua tìm kiếm mạng, ghi nhận lý do vào Reasoning Trace.
   - Nếu thiếu hoặc là sự kiện thời sự mới: Sinh ra tối đa 2 từ khóa tìm kiếm tối ưu và bật cờ `needs_web_search = True`.
3. **`web_search`** (nếu cần):
   - Gọi trực tiếp Tavily Search API thời gian thực để lấy dữ liệu mới nhất kèm đường link trích dẫn nguồn.
4. **`synthesize`**:
   - Kết hợp 4 nguồn: Lịch sử ngắn hạn + Tri thức dài hạn + Bài học kinh nghiệm + Kết quả tìm kiếm Web để soạn thảo câu trả lời hoàn chỉnh.
5. **`critique` (Self-Correction Loop)**:
   - Đóng vai trò kiểm định viên độc lập (Critic).
   - Chấm điểm câu trả lời từ 1 đến 10 dựa trên: tính trung thực (Groundedness) và mức độ trả lời trực diện (Relevance).
   - Nếu điểm `< 7`: Tự động viết lại bản tinh chỉnh (`refined_answer`) và ghi chú vào Reasoning Trace trước khi trả về cho người dùng.

---

## 4. Co che Tu hoc & Xu ly Mau thuan Tri thuc (Belief Revision)

Sau khi gửi câu trả lời về cho người dùng, FastAPI kích hoạt tiến trình chạy ngầm `background_continual_learning`:

1. **Lọc nhận thức thông minh**:
   - Bỏ qua các câu xã giao, chào hỏi, câu hỏi thông thường.
   - Nếu câu trả lời hoàn toàn lấy từ tri thức sẵn có trong Qdrant -> Không trích xuất lại (tránh AI tự học lại chính câu trả lời của mình gây lặp tri thức).
   - Chỉ trích xuất khi: Người dùng cung cấp thông tin cá nhân/yêu cầu công việc riêng hoặc có dữ liệu mới từ Web Search.
2. **Khử trùng lặp theo ngữ nghĩa (Deduplication)**:
   - Nếu độ tương đồng vector `> 0.85`: Ghi đè cập nhật vào bản ghi cũ.
3. **Giải quyết mâu thuẫn tri thức (Conflict Resolution)**:
   - Nếu độ tương đồng nằm trong khoảng `0.65 - 0.85`: Gọi mô hình kiểm tra xem dữ kiện mới có phủ định/thay thế dữ kiện cũ không (ví dụ: đổi nơi ở, đổi công nghệ, đổi phiên bản).
   - Nếu có mâu thuẫn: Đánh dấu bản ghi cũ thành `status: "deprecated"` và lưu bản ghi mới với `status: "active"`.
   - Khi truy vấn, AI chỉ lấy dữ kiện `active`, đảm bảo không bao giờ trả lời mâu thuẫn.
4. **Thông báo Realtime qua Webhook**:
   - Khi Qdrant lưu xong, AI Core gửi HTTP POST đến Gateway `/api/internal/memory-updated`.
   - Gateway phát sóng sự kiện `memory_updated` qua WebSocket để cập nhật giao diện Frontend ngay tức thì.

---

## 5. Danh sach Bien moi truong (.env)

| Bien moi truong | Y nghia | Vi du gia tri |
| :--- | :--- | :--- |
| `GOOGLE_API_KEY` | Khóa API của Google AI Studio | `AIzaSy...` |
| `FAST_MODEL` | Mô hình ngôn ngữ chính (1.500 req/ngày trên Free Tier) | `gemini-3.5-flash-lite` |
| `EMBEDDING_MODEL` | Mô hình tạo vector embedding | `models/gemini-embedding-001` |
| `TAVILY_API_KEY` | Khóa tìm kiếm web thời gian thực Tavily | `tvly-dev-...` |
| `LANGSMITH_TRACING` | Kích hoạt theo dõi và giám sát trace | `true` |
| `LANGSMITH_API_KEY` | Khóa xác thực LangSmith | `lsv2_pt_...` |
| `LANGSMITH_PROJECT` | Tên dự án trace gom nhóm trên LangSmith | `agent-selflearn` |
| `QDRANT_URL` | Địa chỉ kết nối Vector Database | `http://qdrant:6333` |
| `REDIS_URL` | Địa chỉ kết nối Redis bộ nhớ ngắn hạn | `redis://redis:6379/0` |
| `AI_CORE_URL` | Địa chỉ Gateway gọi vào AI Core | `http://ai-core:8000` |
| `VITE_GATEWAY_URL` | Địa chỉ trình duyệt gọi vào Gateway | `http://localhost:4000` |
| `GATEWAY_INTERNAL_URL`| Địa chỉ AI Core gửi Webhook cập nhật cho Gateway | `http://gateway:4000` |

---

## 6. Huong dan Kiem thu thuc te (Step-by-step Test Guide)

### Kiem thu 1: Tinh nang Tu hoc xuyen Session
1. Chat: *"Tôi tên là Hoàng, dự án chính của tôi đang phát triển bằng Rust và Tauri."*
2. Chờ 1 giây: Thấy số lượng tri thức trong bảng "Nội dung đã học" tự động nhảy tăng thêm 1 qua Socket.IO.
3. Bấm nút **"Tạo Session Mới" (New Session)** trên thanh tiêu đề chat (xóa sạch bộ nhớ ngắn hạn Redis).
4. Hỏi: *"Tôi tên là gì và dự án của tôi dùng công nghệ gì?"*
5. Kết quả: AI trả lời chính xác tên Hoàng, Rust và Tauri dựa vào `[Recall]` từ Qdrant, không cần tìm kiếm web.

### Kiem thu 2: Tinh nang Giai quyet Mau thuan (Conflict Resolution)
1. Chat cập nhật: *"Tôi đã chuyển toàn bộ dự án từ Rust sang ngôn ngữ Go 1.24 rồi nhé."*
2. AI tự động phát hiện mâu thuẫn giữa thông tin cũ (Rust) và thông tin mới (Go 1.24). Bản ghi cũ bị đánh dấu `deprecated`.
3. Bấm **New Session**, hỏi: *"Hiện tại dự án của tôi viết bằng ngôn ngữ gì?"*
4. Kết quả: AI khẳng định dự án viết bằng **Go 1.24** và không còn nhắc đến Rust như chân lý hiện tại nữa.

### Kiem thu 3: Tinh nang Tu phan bien (Self-Correction & Critique)
1. Đặt một câu hỏi mở hoặc yêu cầu giải thích kỹ thuật.
2. Quan sát bảng **Reasoning Trace** bên phải:
   - Thấy xuất hiện dòng `[Critique] Tự phản biện chất lượng: X/10 điểm...`.
   - Nếu câu trả lời nháp ban đầu chưa hoàn hảo, trace sẽ có thêm bước `[Self-Correction] Đã tự động hiệu chỉnh...`.

### Kiem thu 4: Tinh nang Tu hoc chu dong doc lap
1. Tại thẻ **"AI tự nghiên cứu chủ đề mới"** bên cột phải:
   - Có thể bấm nút **"Random ngẫu nhiên"** để hệ thống tự bốc ngẫu nhiên một chủ đề đa ngành.
   - Hoặc bấm chọn nhanh theo danh mục: **`[IT / Tech]`**, **`[Kinh tế]`**, **`[Kinh doanh]`**, **`[Chiến tranh / Chiến lược]`**, **`[Khoa học]`**.
2. Bấm **"Tự học ngay"**.
3. Kết quả:
   - Khung chat chính ở giữa hoàn toàn sạch sẽ, không bị chèn tin nhắn rác.
   - Bản tóm tắt nghiên cứu hiển thị gọn gàng trong thẻ bên phải.
   - Các dữ kiện thực tế tự động nạp vào Tab "Kiến thức" trong bảng "Nội dung đã học".

---

## 7. Knowledge Synthesis Engine: He Thong Tong Hop & Sinh Tri Thuc Moi (Vuot troi hoan toan RAG)

Bản chất của tri thức mới:
> *"Tài liệu A nói rằng X gây ra Y (ở ngữ cảnh 1). Tài liệu B (nằm ở một tệp hoàn toàn khác) nói rằng Y kết hợp với Z sẽ tạo ra W (ở ngữ cảnh 2). RAG thông thường không bao giờ nối được X với W vì 2 đoạn văn không giống nhau về mặt vector. Knowledge Synthesis Engine tự phát hiện ra cầu nối Y và rút ra định luật mới: 'X + Z có thể dẫn đến W'."*

### 7.1. Nang cap Tang Luu tru: Hybrid GraphRAG & Tiered Memory Architecture
Thay vì lưu trữ phẳng một chiều, toàn bộ tri thức trong Qdrant được phân tầng (Tiered Memory Schema) với Metadata Payload hỗ trợ Multi-Hop Graph Traversal:

1. **Tier 1 (`tier_1_raw`)**:
   - Lưu trữ các chunk thô, sự kiện người dùng cung cấp hoặc kết quả thu thập từ Web.
2. **Tier 2 (`tier_2_bridge`)**:
   - Lưu trữ các bộ ba thực thể Đồ thị (Graph Triplets): `[Thực thể A] -> (Quan hệ) -> [Thực thể B]`.
   - Lưu kèm các trường `bridge_node`, `domain_a`, `domain_b` ngay trong Payload Metadata của Qdrant để thực hiện truy vấn bắc cầu mà không cần cài đặt thêm GraphDB nặng nề.
3. **Tier 3 (`tier_3_synthesized`)**:
   - Lưu trữ các phát hiện cao cấp, định luật mới được suy luận ra từ chuỗi quan hệ bắc cầu hoặc giải quyết mâu thuẫn giữa các miền tri thức.
   - Lưu kèm `new_law`, `core_thesis`, `causal_chain`, `contradiction_resolved`, `confidence_score`.

### 7.2. Nang cap Tang Truy xuat: Agentic Multi-Hop Reasoning Graph
Hệ thống sử dụng một đồ thị LangGraph chuyên biệt (`synthesis_graph.py`) chạy qua 4 chặng:

```
[ Complex Problem / Query ]
          |
          v
[ 1. Decomposer & Hypothesis Generator ]
(Phân rã vấn đề thành 2-3 câu hỏi phụ & Đặt giả thuyết ban đầu)
          |
          v
[ 2. Multi-Hop Explorer (Iterative Hopping) ] <---------+
(Tìm kiếm Vector A -> Đọc chunk phát hiện khái niệm lạ B     | (Nếu dữ kiện
 -> Tự động sinh câu query đuổi tầng 2 để đào sâu)           |  chưa đủ)
          |                                             |
          v                                             |
[ 3. Dialectical Synthesizer (Tổng hợp Biện chứng) ] ---+
(Đối chiếu luận điểm trái ngược, giải quyết mâu thuẫn,
 tìm điểm giao thoa liên ngành để sinh Giải pháp thứ 3)
          | (Đạt chuẩn kiểm chứng)
          v
[ 4. Memory Consolidation Node ]
(Ghi ngược định luật mới thành Vector độc lập vào Qdrant Tier 3)
```

**Ba ky thuat cot loi trong luong suy luan:**
- **Iterative Hopping (Truy vấn đuổi)**: Sau khi lấy được dữ liệu tầng 1, LLM tự phân tích để tìm khái niệm trung gian chưa rõ và sinh truy vấn tầng 2.
- **Contrastive / Dialectical Prompting (Tổng hợp biện chứng)**: Ép LLM tìm nguyên nhân gốc rễ của mâu thuẫn giữa các tài liệu đối nghịch và đề xuất giải pháp thứ 3.
- **Cross-Domain Analogy (Giao thoa liên ngành)**: Trừu tượng hóa vấn đề thành mô hình cấu trúc tổng quát để liên kết giải pháp từ các lĩnh vực khác nhau.

### 7.3. Tang Dot pha: Giac mo AI (Background Sleep Phase Discovery)
Khi hệ thống chạy nền (hoặc người dùng bấm kích hoạt trên giao diện):
1. **Gom cụm Vector (Cosine Clustering)**: Quét các cặp tri thức có khoảng cách ngữ nghĩa nằm trong vùng **0.55 - 0.78** (vùng khoảng cách vàng: không quá giống gây trùng lặp, không quá xa gây lạc đề).
2. **Suy luận Thoái quy (Abductive Synthesis)**: LLM tìm điểm giao cắt ẩn giữa 2 khái niệm tưởng chừng tách biệt để đặt ra một định luật tổng hợp mới.
3. **Critic Verification Loop**: Đóng vai trò phản biện độc lập, đánh giá tính logic, khả thi và độ tin cậy. Chỉ các insight đạt điểm cao mới được ghi nhận vào Qdrant Tier 3.

### 7.4. Giao dien Nguoi dung & Kiem thu Thuc te
- Thanh điều hướng (Navbar) trên cùng hỗ trợ chuyển đổi mượt mà giữa:
  - **Trợ lý Hội thoại & Bộ nhớ** (Chat Assistant & Realtime Memory Panel)
  - **Knowledge Synthesis Engine** (Trang chuyên biệt tổng hợp tri thức)
- Bảng Dashboard trực quan gồm:
  - 5 Thẻ thống kê phân tầng: Tier 1 (Raw), Tier 2 (Bridge), Tier 3 (Synthesized / Verified), Negative Memory (Falsified), và Tổng Vector khả dụng.
  - Bộ thực thi **Agentic Multi-Hop Reasoning** trực quan hóa từng chặng suy luận, giả thuyết, hộp thực thi Sandbox code và kết quả kết tinh.
  - Nút kích hoạt **"Giấc mơ AI (Sleep Phase Discovery)"** với báo cáo chi tiết các phát hiện mới.
  - Bảng dữ liệu 3 Tab: Tra cứu Tri thức đã kiểm nghiệm (Tier 3), Giả thuyết bác bỏ (Negative Knowledge: Học từ thất bại), và Cầu nối Đồ thị (Tier 2).

### 7.5. Sandbox Code / Simulation Verifier & Negative Knowledge Memory (Hoc tu That bai)
Khi Node Synthesizer đúc kết một tri thức hoặc định luật mới, hệ thống **không lưu vào Qdrant ngay**:
1. **Sandbox Code Verifier Node (`sandbox.py`)**:
   - Tự động sinh một đoạn mã thực nghiệm (Python Benchmark / Simulation Script) với các điều kiện kiểm tra logic (`assert`).
   - Đẩy vào môi trường Sandbox độc lập để đo đạc thời gian thực thi, thu nhận `stdout`, `stderr`, và kiểm tra xem giả thuyết có đúng đắn hay không.
2. **Cơ chế Phân loại Nhị phân (Dual Write-Back)**:
   - **Nếu Thực nghiệm Thành công (Exit Code 0 & Assert Passes)**:
     - Ghi nhận vào Qdrant với `memory_tier: "tier_3_synthesized"`, `status: "verified"`.
     - Lưu kèm đoạn code kiểm nghiệm và kết quả đo đạc thời gian thực tế.
   - **Nếu Thực nghiệm Thất bại (AssertionError, Crash hoặc Sai lệch logic)**:
     - Ghi nhận vào Qdrant một bản ghi đặc biệt: `memory_tier: "falsified_hypothesis"`, `status: "falsified"`.
     - Lưu lại chi tiết: *"Giả thuyết X đã được kiểm nghiệm thực tế và BÁC BỎ vì lý do Y"* kèm theo đoạn code thất bại và log terminal.
3. **Giá trị Đột phá**:
   - AI xây dựng được **"Kho tàng tri thức về những cái sai" (Negative Knowledge Memory)**. Khi tiếp nhận các bài toán mới, AI tham chiếu kho tàng này để **không bao giờ lặp lại vết xe đổ** trong tương lai.


