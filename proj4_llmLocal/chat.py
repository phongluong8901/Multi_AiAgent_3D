import os
import multiprocessing
from dotenv import load_dotenv
from llama_cpp import Llama

# 1. Nạp biến môi trường từ file .env trước tiên
load_dotenv()

# Import bộ công cụ từ file tools.py sang
from tools import TOOL_SYSTEM_PROMPT, try_execute_tool

MODEL_PATH = os.getenv("LLM_MODEL_PATH", r"D:\model_llm\qwen2.5-1.5b-instruct-q4_k_m.gguf")

if not os.path.exists(MODEL_PATH):
    print(f"Không tìm thấy file weight tại: {MODEL_PATH}")
    exit(1)

optimal_threads = max(1, multiprocessing.cpu_count() // 2)
print(f"Đang load model vào RAM (Sử dụng {optimal_threads} threads CPU)...")

llm = Llama(
    model_path=MODEL_PATH,
    n_ctx=4096,
    n_threads=optimal_threads,
    n_threads_batch=multiprocessing.cpu_count(),
    n_batch=512,
    use_mmap=True,
    verbose=False
)

# Khởi tạo lịch sử với System Prompt đã tích hợp hướng dẫn Tool
messages = [{"role": "system", "content": TOOL_SYSTEM_PROMPT}]

print("\n--- AI đã sẵn sàng! Gõ 'exit' để thoát, 'clear' để xóa bộ nhớ chat ---")

def stream_chat(msg_list, temp=0.3) -> str:
    """Hàm phụ trợ giúp stream chữ ra màn hình cho gọn code"""
    stream = llm.create_chat_completion(
        messages=msg_list,
        max_tokens=1024,
        temperature=temp,
        top_p=0.9,
        repeat_penalty=1.1,
        stream=True
    )
    full_text = ""
    for chunk in stream:
        delta = chunk["choices"][0]["delta"]
        if "content" in delta:
            piece = delta["content"]
            print(piece, end="", flush=True)
            full_text += piece
    return full_text

while True:
    try:
        prompt = input("\n\nBạn: ").strip()
    except (KeyboardInterrupt, EOFError):
        break

    if not prompt:
        continue
    if prompt.lower() == 'exit':
        break
    if prompt.lower() == 'clear':
        messages = [messages[0]]
        print("Đã xóa lịch sử trò chuyện!")
        continue

    messages.append({"role": "user", "content": prompt})

    if len(messages) > 21:
        messages = [messages[0]] + messages[-20:]

    print("AI: ", end="", flush=True)
    
    # 2. Để temp=0.2 ở lượt đầu để AI tuân thủ nghiêm ngặt lệnh xuất JSON khi cần gọi Tool
    reply = stream_chat(messages, temp=0.2)
    messages.append({"role": "assistant", "content": reply})

    # Kiểm tra xem câu vừa xuất ra có phải là lệnh gọi Tool không
    tool_result = try_execute_tool(reply)
    
    # 3. Nếu AI vừa gọi Tool -> Dùng biến tạm (temp_messages) để AI đọc kết quả
    # Không lưu câu nhắc nhở tạm thời vào messages chính để tránh làm nhiễu các câu hỏi sau
    if tool_result:
        temp_messages = messages + [
            {
                "role": "user",
                "content": f"Dữ liệu thực tế từ hệ thống: [{tool_result}]. Hãy dựa vào đây để trả lời ngắn gọn, tự nhiên bằng tiếng Việt cho câu hỏi ban đầu (lượt này không xuất JSON)."
            }
        ]
        print("AI: ", end="", flush=True)
        final_answer = stream_chat(temp_messages, temp=0.6)
        
        # Ghi đè câu trả lời hoàn chỉnh vào vị trí của chuỗi JSON lúc nãy để lịch sử chat luôn sạch
        messages[-1] = {"role": "assistant", "content": final_answer}