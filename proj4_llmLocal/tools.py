import json
import re
import requests
# Import tool Hugging Face từ file hf_tools.py vừa tạo
from hf_tools import summarize_with_hf_api

TOOL_SYSTEM_PROMPT = """Bạn là một trợ lý AI thông minh, thực dụng và giỏi lập trình.
Bạn có quyền truy cập vào các công cụ (Tools) sau:

1. Tra cứu thời tiết:
Nếu người dùng hỏi về thời tiết, BẮT BUỘC xuất DUY NHẤT chuỗi JSON:
{"tool": "get_weather", "city": "<Tên thành phố không dấu hoặc tiếng Anh>"}

Ví dụ:
- Hỏi: "Thời tiết Sài Gòn thế nào?" -> Trả lời: {"tool": "get_weather", "city": "Ho Chi Minh"}

2. Tóm tắt văn bản (hf_summarize):
BẤT KỂ đoạn văn ngắn hay dài, hễ người dùng có từ khóa "tóm tắt", TUYỆT ĐỐI KHÔNG tự tóm tắt. BẮT BUỘC phải xuất DUY NHẤT chuỗi JSON:
{"tool": "hf_summarize", "text": "<Toàn bộ nội dung cần tóm tắt>"}

Ví dụ:
- Hỏi: "Tóm tắt đoạn này: Trí tuệ nhân tạo đang phát triển rất nhanh..." -> Trả lời: {"tool": "hf_summarize", "text": "Trí tuệ nhân tạo đang phát triển rất nhanh..."}
- Hỏi: "Tóm tắt đi" (dựa trên câu trước) -> Trả lời: {"tool": "hf_summarize", "text": "<Nội dung câu trước đó>"}

QUY TẮC TỐI THƯỢNG: Khi gọi tool, chỉ xuất đúng chuỗi JSON, không giải thích. Với câu hỏi bình thường khác, trả lời trực tiếp bằng tiếng Việt."""

def get_weather(city: str) -> str:
    """Gọi API Open-Meteo lấy thời tiết thực tế"""
    try:
        geo_url = f"https://geocoding-api.open-meteo.com/v1/search?name={city}&count=1&language=vi&format=json"
        geo_res = requests.get(geo_url, timeout=5).json()
        
        if not geo_res.get("results"):
            return f"Không tìm thấy dữ liệu cho địa điểm '{city}'."
            
        loc = geo_res["results"][0]
        lat, lon = loc["latitude"], loc["longitude"]
        resolved_name = f"{loc['name']}, {loc.get('country', '')}"
        
        weather_url = (
            f"https://api.open-meteo.com/v1/forecast?"
            f"latitude={lat}&longitude={lon}"
            f"&current=temperature_2m,relative_humidity_2m,apparent_temperature,wind_speed_10m"
        )
        w_res = requests.get(weather_url, timeout=5).json()
        curr = w_res["current"]
        
        return (
            f"Địa điểm: {resolved_name} | "
            f"Nhiệt độ: {curr['temperature_2m']}°C (Cảm giác như: {curr['apparent_temperature']}°C) | "
            f"Độ ẩm: {curr['relative_humidity_2m']}% | "
            f"Gió: {curr['wind_speed_10m']} km/h"
        )
    except Exception as e:
        return f"Lỗi kết nối API thời tiết: {str(e)}"


# Đăng ký cả 2 tool vào danh sách
AVAILABLE_TOOLS = {
    "get_weather": get_weather,
    "hf_summarize": summarize_with_hf_api  # Nếu thích chạy offline ổ D thì đổi thành: summarize_with_hf_local
}


def try_execute_tool(ai_reply: str) -> str | None:
    """Bắt lệnh JSON từ AI và tự động phân luồng gọi đúng tool"""
    match = re.search(r'\{.*"tool"\s*:\s*".*?".*\}', ai_reply, re.DOTALL)
    if not match:
        return None
        
    try:
        data = json.loads(match.group(0))
        tool_name = data.get("tool")
        
        if tool_name == "get_weather":
            city = data.get("city", "")
            print(f"\n[Tool] Đang tra cứu thời tiết tại: {city}...")
            result = AVAILABLE_TOOLS["get_weather"](city)
            print(f"[Tool] Kết quả: {result}\n")
            return result
            
        elif tool_name == "hf_summarize":
            text = data.get("text", "")
            print(f"\n[HuggingFace Tool] Đang gửi văn bản sang model tóm tắt chuyên dụng...")
            result = AVAILABLE_TOOLS["hf_summarize"](text)
            print(f"[HuggingFace Tool] Kết quả tóm tắt: {result}\n")
            return result
            
    except Exception as e:
        return f"Lỗi khi thực thi tool: {str(e)}"
        
    return None