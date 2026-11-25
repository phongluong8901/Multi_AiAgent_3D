import json
import time
import httpx

BASE_URL = "https://visitor-submitting-retained-deeper.trycloudflare.com"
MODEL = "qwen2.5-coder:14b"

# Giữ kết nối Keep-Alive xuyên suốt các lượt chat để bỏ qua độ trễ bắt tay SSL
client = httpx.Client(base_url=BASE_URL, timeout=120.0, http2=True)

history = [
    {"role": "system", "content": "Trả lời ngắn gọn, đi thẳng vào code."}
]

print("Gõ câu hỏi (gõ 'clear' xóa lịch sử, 'exit' thoát):")
while True:
    prompt = input("\nBạn: ").strip()
    if not prompt:
        continue
    if prompt.lower() in ("exit", "quit"):
        break
    if prompt.lower() == "clear":
        history = [history[0]]
        print("[Đã xóa lịch sử]")
        continue

    history.append({"role": "user", "content": prompt})
    payload = {
        "model": MODEL,
        "messages": history,
        "stream": True,
        "keep_alive": -1,
        "options": {"temperature": 0.2, "num_ctx": 8192},
    }

    t0 = time.perf_counter()
    first_token_t = None
    reply_chunks = []

    print("\nAI: ", end="", flush=True)
    with client.stream("POST", "/api/chat", json=payload) as resp:
        for line in resp.iter_lines():
            if not line:
                continue
            chunk = json.loads(line)
            token = chunk.get("message", {}).get("content", "")
            if token:
                if first_token_t is None:
                    first_token_t = time.perf_counter()
                print(token, end="", flush=True)
                reply_chunks.append(token)
            if chunk.get("done"):
                eval_count = chunk.get("eval_count", 0)
                eval_s = chunk.get("eval_duration", 1) / 1e9
                ttft = (first_token_t - t0) * 1000 if first_token_t else 0
                print(f"\n\n[TTFT: {ttft:.0f} ms | Speed: {eval_count / eval_s:.1f} tok/s]")
                break

    history.append({"role": "assistant", "content": "".join(reply_chunks)})