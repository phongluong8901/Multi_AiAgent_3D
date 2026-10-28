Chuẩn bài luôn, nếu làm thế ông chỉ cần:

Tải đúng file weight .gguf của con Qwen 1.5B (khoảng hơn 1GB).

Dùng thư viện Python llama-cpp-python hoặc ctransformers.

# --- tai model huggingface
https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF/tree/main

https://huggingface.co/settings/tokens

# ----
python -m venv venv
.\venv\Scripts\Activate.ps1

pip install --upgrade pip
pip install llama-cpp-python

pip install requests
pip install python-dotenv

pip install llama-cpp-python --extra-index-url https://abetlen.github.io/llama-cpp-python/whl/cpu/

# --- run
python test_conn.py

python chat.py


# --- check

Bạn: check cho tôi thời tiết hôm nay
AI: {"tool": "get_weather", "city": "Hanoi"}
[Tool] Đang tra cứu thời tiết tại: Hanoi...
[Tool] Kết quả: Địa điểm: Hà Nội, Việt Nam | Nhiệt độ: 30.1°C (Cảm giác như: 32.0°C) | Độ ẩm: 53% | Gió: 11.5 km/h

AI: Hôm nay, tại Hà Nội, Việt Nam, nhiệt độ là 30.1°C (Cảm giác như: 32.0°C), với độ ẩm 53% và có gió 11.5 km/h.

Bạn: 