import os
import requests
from dotenv import load_dotenv

# Nạp file .env
load_dotenv()
token = os.getenv("HF_API_TOKEN", "")

url = "https://api-inference.huggingface.co/models/csebuetnlp/mT5_multilingual_XLSum"

headers = {}
if token:
    headers["Authorization"] = f"Bearer {token}"
    print(f"[*] Đã tìm thấy Token trong .env (Khớp: {token[:6]}...)")
else:
    print("[!] Không tìm thấy HF_API_TOKEN trong .env (vẫn test được kết nối chung).")

print(f"[*] Đang thử kết nối tới Hugging Face API...")

try:
    # Dùng phương thức GET để test kết nối nhanh
    response = requests.get(url, headers=headers, timeout=10)
    
    print(f"\n[THÀNH CÔNG] Phản hồi từ server! HTTP Status Code: {response.status_code}")
    print(f"Nội dung nhận được: {response.text[:150]}...")
    print("\n=> Python đã thông mạng hoàn toàn với Hugging Face!")

except requests.exceptions.SSLError as e:
    print(f"\n[LỖI SSL]: Chứng chỉ bảo mật bị kẹt. Chi tiết: {e}")
except requests.exceptions.ConnectionError as e:
    print(f"\n[LỖI KẾT NỐI/DNS]: Máy không phân giải được tên miền hoặc bị chặn mạng. Chi tiết: {e}")
except Exception as e:
    print(f"\n[LỖI KHÁC]: {str(e)}")