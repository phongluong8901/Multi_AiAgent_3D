# Model Local Cloud (Google Colab GPU via Cloudflare Tunnel)

Kết nối `ai-desktop-mate` tới Ollama chạy trên Google Colab GPU L4 (hoặc server GPU từ xa qua Cloudflare Tunnel `*.trycloudflare.com`), tham khảo từ [gpu_colab/remote_gpu_chat.py](../gpu_colab/remote_gpu_chat.py).

## Nguyên lý "Quét ra thì dùng"
- App đọc cấu hình URL từ [colab_config.json](./colab_config.json) (hoặc Studio UI -> tab **AI & Cảnh Báo**).
- Khi khởi động hoặc bấm **Quét GPU Colab**, app ping `GET <tunnel_url>/api/tags` trong 4 giây.
- Nếu tunnel đang bật -> tự nhận danh sách model (vd `qwen2.5-coder:14b`) và cho phép chọn dùng trực tiếp.
- Nếu Colab đang tắt -> app bỏ qua êm ái, tự dùng Local Ollama hoặc Gemini API bình thường.
