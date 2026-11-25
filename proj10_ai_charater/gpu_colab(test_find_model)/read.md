Đường hầm tới GPU L4 đã thông. Mở CMD trên máy tính Windows của bạn và chạy các lệnh sau để gọi trực tiếp vào dịch vụ GPU:

1. Kiểm tra kết nối (Healthcheck):

DOS


curl https://visitor-submitting-retained-deeper.trycloudflare.com/
(Trả về Ollama is running là PC local đã gọi thẳng tới GPU L4 thành công).

2. Kiểm tra danh sách model đang chạy trên GPU:

DOS


curl https://visitor-submitting-retained-deeper.trycloudflare.com/api/tags
3. Gửi câu hỏi test tốc độ phản hồi trực tiếp từ CMD:

DOS


curl https://visitor-submitting-retained-deeper.trycloudflare.com/api/generate -d "{\"model\": \"qwen2.5-coder:14b\", \"prompt\": \"Viet 1 ham Rust tinh giai thua n\", \"stream\": false}"
4. Tích hợp vào code hoặc VS Code trên PC Windows:
Thay http://localhost:11434 bằng chính link [https://visitor-submitting-retained-deeper.trycloudflare.com](https://visitor-submitting-retained-deeper.trycloudflare.com) vào thư viện Ollama, OpenAI-compatible client (/v1), hoặc extension Cline/Continue trên máy nhà là toàn bộ tác vụ AI sẽ chạy trên GPU L4 23GB VRAM.

(Lưu ý: Giữ nguyên tab Google Colab đang mở để duy trì đường hầm này hoạt động; nếu Colab bị ngắt kết nối hoặc khởi động lại, link .trycloudflare.com sẽ đổi sang địa chỉ mới).


Để chữ chạy ra liên tục ngay từ token đầu tiên (~0.1 giây sau khi bấm Enter), bạn đổi "stream": false thành "stream": true và thêm cờ -N (--no-buffer) vào curl để CMD không gom bộ nhớ đệm:

1. Chạy stream trực tiếp trên CMD Windows
DOS


curl -N https://visitor-submitting-retained-deeper.trycloudflare.com/api/generate -d "{\"model\": \"qwen2.5-coder:14b\", \"prompt\": \"Viet 1 ham Rust tinh giai thua n\", \"stream\": true}"
(Lưu ý: Trên CMD raw, mỗi token sẽ in ra dưới dạng một dòng JSON nhỏ như {"response":"fn","done":false}).

# --- íntall
uv pip install --system "httpx[http2]"

# --- run

python remote_gpu_chat.py