Chuẩn bài luôn, nếu làm thế ông chỉ cần:

Tải đúng file weight .gguf của con Qwen 1.5B (khoảng hơn 1GB).

Dùng thư viện Python llama-cpp-python hoặc ctransformers.

# --- tai model huggingface
https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF/tree/main

# ----
python -m venv venv
.\venv\Scripts\Activate.ps1

pip install --upgrade pip
pip install llama-cpp-python

pip install llama-cpp-python --extra-index-url https://abetlen.github.io/llama-cpp-python/whl/cpu/

python chat.py