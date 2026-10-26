python -m venv worker_env
worker_env\Scripts\activate

pip install torch websockets psutil

# --- .exe
pyinstaller --noconsole --onefile worker.py