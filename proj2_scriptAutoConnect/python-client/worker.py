import asyncio
import json
import platform
import psutil
import requests
import torch
import websockets

# Địa chỉ Core Server (Go) của bạn
SERVER_URI = "ws://localhost:8080/ws"
TOKEN = "token_nguoi_dung_abc123"  # Token định danh tài khoản của người cho thuê


def get_geolocation():
  print("🌍 Đang xác định vị trí máy cho thuê...")
  try:
    # Sử dụng ipinfo.io để tra cứu vị trí qua IP công cộng
    response = requests.get("https://ipinfo.io/json", timeout=4)
    if response.status_code == 200:
      data = response.json()
      loc_str = data.get("loc", "0.0,0.0")
      lat, lon = loc_str.split(",") if "," in loc_str else (0.0, 0.0)

      location = {
          "latitude": float(lat),
          "longitude": float(lon),
          "city": data.get("city", "Unknown"),
          "country": data.get("country", "Unknown"),
      }
      print(f"📍 Vị trí: {location['city']}, {location['country']}")
      return location
  except Exception as e:
    print(f"⚠️ Không thể lấy vị trí qua IP: {e}")

  return {
      "latitude": 0.0,
      "longitude": 0.0,
      "city": "Unknown",
      "country": "Unknown",
  }


def check_and_configure_hardware():
  print("🔍 Đang quét phần cứng hệ thống...")

  hw_info = {
      "os": platform.system(),
      "cpu_cores": psutil.cpu_count(logical=True),
      "system_ram_gb": round(psutil.virtual_memory().total / (1024**3), 2),
      "has_gpu": False,
      "gpu_name": "None",
      "vram_gb": 0,
      "supported_models": [],
  }

  # Kiểm tra GPU thông qua PyTorch
  if torch.cuda.is_available():
    hw_info["has_gpu"] = True
    hw_info["gpu_name"] = torch.cuda.get_device_name(0)

    # Tính tổng VRAM (GB)
    vram_bytes = torch.cuda.get_device_properties(0).total_memory
    hw_info["vram_gb"] = round(vram_bytes / (1024**3), 2)

    # Tự động cấu hình model tương thích dựa trên VRAM thực tế
    vram = hw_info["vram_gb"]
    if vram >= 20:
      hw_info["supported_models"] = ["Qwen2.5-14B", "Qwen2.5-7B"]
    elif vram >= 10:
      hw_info["supported_models"] = ["Qwen2.5-7B", "Qwen2.5-3B"]
    elif vram >= 6:
      hw_info["supported_models"] = ["Qwen2.5-3B", "Qwen2.5-1.5B"]
    else:
      hw_info["supported_models"] = ["Qwen2.5-1.5B (Low VRAM mode)"]
  else:
    hw_info["supported_models"] = ["CPU-only fallback models"]

  # In kết quả ra màn hình cho người dùng thấy
  print("\n================ THÔNG TIN PHẦN CỨNG ================")
  print(f"💻 Hệ điều hành: {hw_info['os']}")
  print(f"🧠 CPU: {hw_info['cpu_cores']} cores | RAM: {hw_info['system_ram_gb']} GB")
  print(f"🎮 GPU: {hw_info['gpu_name']}")
  print(f"🚀 VRAM: {hw_info['vram_gb']} GB")
  print(f"🤖 Model phù hợp cấu hình: {hw_info['supported_models']}")
  print("======================================================\n")

  return hw_info


async def run_worker():
  hw_info = check_and_configure_hardware()
  location_info = get_geolocation()

  while True:
    try:
      print(f"🔌 Đang kết nối tới Core Server tại {SERVER_URI}...")
      async with websockets.connect(SERVER_URI) as websocket:

        register_payload = {
            "type": "REGISTER_WORKER",
            "token": TOKEN,
            "hardware": hw_info,
            "location": location_info,
        }
        await websocket.send(json.dumps(register_payload))
        print("🟢 Kết nối thành công! Đang ở trạng thái sẵn sàng nhận việc...")

        async for message in websocket:
          data = json.loads(message)

          if data.get("type") == "RUN_TASK":
            task_id = data.get("task_id")
            prompt = data.get("prompt")
            model = data.get("model")

            print(
                f"📥 Nhận task mới [ID: {task_id}] dùng model '{model}' với"
                f" prompt: '{prompt}'"
            )

            simulated_response = (
                f"Chào bạn, tôi đang xử lý yêu cầu bằng GPU"
                f" [{hw_info['gpu_name']}] tại [{location_info['city']}]"
                f" với nội dung: '{prompt}'."
            )

            for word in simulated_response.split():
              chunk_payload = {
                  "type": "STREAM_CHUNK",
                  "task_id": task_id,
                  "chunk": word + " ",
              }
              await websocket.send(json.dumps(chunk_payload))
              await asyncio.sleep(0.08)

            done_payload = {"type": "TASK_DONE", "task_id": task_id}
            await websocket.send(json.dumps(done_payload))
            print(f"✅ Đã hoàn thành và trả kết quả cho task [ID: {task_id}]\n")

    except websockets.exceptions.ConnectionClosed:
      print(
          "⚠️ Mất kết nối với Core Server. Đang thử kết nối lại sau 5 giây..."
      )
      await asyncio.sleep(5)
    except Exception as e:
      print(f"❌ Lỗi xảy ra: {e}. Đang thử kết nối lại sau 5 giây...")
      await asyncio.sleep(5)


if __name__ == "__main__":
  asyncio.run(run_worker())