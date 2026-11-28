self-learning-ai/
├── docker-compose.yml          # Điều phối toàn bộ hạ tầng (Redis, AI Core, Gateway)
├── .env.example                # Biến môi trường tập trung
│
├── ai-core-service/            # [BE Core] Python + FastAPI + LangGraph + ChromaDB
│   ├── Dockerfile
│   ├── requirements.txt
│   └── app/
│       ├── main.py             # Entrypoint FastAPI
│       ├── core/
│       │   └── config.py       # Quản lý cấu hình (Pydantic Settings)
│       ├── memory/
│       │   ├── short_term.py   # Redis (Lưu lịch sử chat & State)
│       │   └── long_term.py    # ChromaDB Cloud (Lưu Tri thức & Kinh nghiệm + Deduplication)
│       ├── tools/
│       │   └── web_search.py   # Công cụ tự tìm kiếm Internet
│       ├── agent/
│       │   ├── state.py        # Định nghĩa State của LangGraph
│       │   ├── nodes.py        # Các bước suy luận (Recall -> Evaluate -> Search -> Respond)
│       │   ├── learner.py      # Background Worker: Tự đúc kết bài học & cập nhật DB
│       │   └── graph.py        # Lắp ráp Đồ thị LangGraph
│       └── api/
│           └── routes.py       # REST API giao tiếp với Node.js Gateway
│
├── gateway-service/            # [BE Gateway] Node.js + Socket.IO + Cron (Chủ động tự học)
│   ├── Dockerfile
│   ├── package.json
│   └── server.js               # API Gateway, Realtime Socket & Cronjob kích hoạt AI tự học
│
└── frontend/                   # [FE] Giao diện tách biệt hoàn toàn (Demo Dashboard)
    └── index.html              # Giao diện Chat + Bảng theo dõi luồng suy nghĩ & Bộ nhớ AI

# ---
https://www.trychroma.com/

https://cloud.qdrant.io/

https://aistudio.google.com/app/api-keys

# --- ai-core-service
python -m venv venv
venv\Scripts\Activate.ps1

pip install qdrant-client redis
pip install -r requirements.txt

# --- gateway-service
npm install express socket.io axios node-cron cors
npm install -D @types/express @types/node @types/node-cron @types/cors typescript ts-node

# --- frontend
npx create-vite@latest frontend --template react-ts

cd frontend
npm install socket.io-client lucide-react
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p

# --- docker compose
docker compose up --build

docker compose up -d --build frontend

# --- link
Giao diện React TS: http://localhost:3001

Qdrant Web UI Dashboard (Cực xịn để soi bộ nhớ AI): http://localhost:6333/dashboard -> Tại đây bạn sẽ thấy 2 bảng knowledge_base và agent_experiences, bấm vào xem được từng câu chữ, thời gian học (updated_at), và chủ đề (topic) mà AI vừa tự nạp vào.

FastAPI Core Docs	http://localhost:8000/docs

Node.js Gateway	http://localhost:4000

# --- check limit model gemini
https://aistudio.google.com/rate-limit
