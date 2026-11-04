import os
import requests
from dotenv import load_dotenv

# Tự động nạp toàn bộ biến từ file .env vào môi trường
load_dotenv()

# Đảm bảo HF_HOME trỏ sang ổ D (nếu trong .env chưa có thì lấy mặc định ổ D)
os.environ["HF_HOME"] = os.getenv("HF_HOME", r"D:\model_llm\hf_cache")

# Lấy Token từ file .env
HF_API_TOKEN = os.getenv("HF_API_TOKEN", "").strip()

SUMMARIZE_MODEL = "csebuetnlp/mT5_multilingual_XLSum"


def summarize_with_hf_api(text: str) -> str:
    """Gọi model trên Hugging Face Hub qua API"""
    api_url = f"https://api-inference.huggingface.co/models/{SUMMARIZE_MODEL}"
    headers = {}
    if HF_API_TOKEN:
        headers["Authorization"] = f"Bearer {HF_API_TOKEN}"

    payload = {
        "inputs": text,
        "parameters": {"max_length": 150, "min_length": 30, "do_sample": False}
    }

    try:
        res = requests.post(api_url, headers=headers, json=payload, timeout=20)
        data = res.json()
        
        if isinstance(data, list) and "summary_text" in data[0]:
            return data[0]["summary_text"]
        elif isinstance(data, dict) and "error" in data:
            return f"Hugging Face API báo: {data['error']}"
        return str(data)
    except Exception as e:
        return f"Lỗi khi gọi Hugging Face API: {str(e)}"