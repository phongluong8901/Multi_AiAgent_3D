import io
import json
import sys
import time
import psutil
import websocket

# Ép Python sử dụng chuẩn UTF-8 cho console để không bị lỗi ký tự tiếng Việt (như chữ Đ)
sys.stdout = io.TextIOWrapper(
    sys.stdout.buffer, encoding="utf-8", errors="replace"
)
sys.stderr = io.TextIOWrapper(
    sys.stderr.buffer, encoding="utf-8", errors="replace"
)

WS_URL = "ws://localhost:8080/ws"


def run_worker():
  print(f"[PYTHON] Đang kết nối tới Go Server tại {WS_URL}...")
  ws = websocket.create_connection(WS_URL)
  print("[PYTHON] Đã kết nối thành công! Bắt đầu quét phần cứng...")

  try:
    while True:
      cpu_p = psutil.cpu_percent(interval=1)
      ram_p = psutil.virtual_memory().percent
      disk_p = psutil.disk_usage("/").percent

      payload = {
          "type": "HARDWARE_STATS",
          "cpu_percent": cpu_p,
          "ram_percent": ram_p,
          "disk_percent": disk_p,
      }

      ws.send(json.dumps(payload))
      print(f"[SENT] CPU: {cpu_p}% | RAM: {ram_p}% | Disk: {disk_p}%")

      time.sleep(1)
  except Exception as e:
    print(f"[ERROR] Mất kết nối: {e}")
    ws.close()


if __name__ == "__main__":
  run_worker()