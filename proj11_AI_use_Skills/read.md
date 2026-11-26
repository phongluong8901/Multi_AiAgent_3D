# --- sau khi generate skill tren GPU A100
lay ve va nhet vao AI xem dung dc skill không

# --- install
playwright install chromium

# --- run
.\.venv\Scripts\Activate.ps1

- chay benmark
python run_gemini_skills.py --benchmark

- chat tuong tac
python run_gemini_skills.py --chat

# ---
# Kiem tra suc khoe toan bo 33 tool (co mang)
python run_gemini_skills.py --healthcheck

# Chat da luot de xem song song tool + telemetry token + link nguon
python run_gemini_skills.py --chat

# --- ml flow
# 1. Chat streaming + luu SQLite + ghi MLflow Tracing
python run_gemini_skills.py --chat --mlflow

# 2. Xem danh sach phien da luu va mo lai phien cu
python run_gemini_skills.py --sessions
python run_gemini_skills.py --chat --session <session_id>

# 3. Mo MLflow UI de xem cay Trace & metrics so sanh model
mlflow ui --backend-store-uri sqlite:///data/mlflow.db

# ---
# Mo nhanh Web UI 2 Tab
python run_web_ui.py

# Hoac bat kem MLflow Tracing
python run_gemini_skills.py --web --mlflow

# ---
# 1. Xem trang thai toan bo pool (Gemini + Groq + Cloudflare)
python run_gemini_skills.py --router-status

# 2. Chat CLI voi che do xoay vong tu dong (9Router)
python run_gemini_skills.py --chat --model auto
# Hoac ep thu rieng Groq:
python run_gemini_skills.py --prompt "Lay gia BTCUSDT va tinh ra VND" --model groq

# 3. Mo Web UI 2 Tab -> Chon "auto" trong dropdown Model (co bang 9Router Pool truc tiep o sidebar)
python run_gemini_skills.py --web --mlflow

# ---
# Kiem tra danh sach model moi nhat + ping toan bo 9Router pool
python run_gemini_skills.py --check-providers

# Khoi dong lai Web UI de ap dung 8/8 endpoint xanh va 44 tools
python run_gemini_skills.py --web --mlflow