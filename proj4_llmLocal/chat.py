import os
from llama_cpp import Llama

# Đường dẫn file weight Q4
MODEL_PATH = r"D:\model_llm\qwen2.5-1.5b-instruct-q4_k_m.gguf"

if not os.path.exists(MODEL_PATH):
    print(f"Không tìm thấy file weight tại: {MODEL_PATH}")
    exit(1)

print("Đang load model vào RAM, chờ một tí...")
llm = Llama(
    model_path=MODEL_PATH,
    n_ctx=2048,
    n_threads=4,
    verbose=False
)

print("\n--- AI đã sẵn sàng! Gõ 'exit' để thoát ---")

while True:
    prompt = input("\n\nBạn: ")
    if prompt.lower() == 'exit':
        break
    
    # Định dạng chuẩn ChatML của Qwen
    formatted_prompt = f"<|im_start|>user\n{prompt}<|im_end|>\n<|im_start|>assistant\n"
    
    print("AI: ", end="", flush=True)
    
    # Bật streaming=True để nó trả về dạng generator từng cục token
    stream = llm(
        formatted_prompt, 
        max_tokens=512, 
        echo=False,
        stream=True
    )
    
    # Duyệt qua từng chunk và in ra ngay lập tức
    for chunk in stream:
        text_piece = chunk['choices'][0]['text']
        print(text_piece, end="", flush=True)