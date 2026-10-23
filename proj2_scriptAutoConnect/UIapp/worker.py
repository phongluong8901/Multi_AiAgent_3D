import asyncio
import json
import platform
import sys
import torch
import websockets
import psutil

# Nhận tham số truyền từ ứng dụng Tauri sang
token = sys.argv[1] if len(sys.argv) > 1 else "default_token"
allocated_cpu = sys.argv[2] if len(sys.argv) > 2 else "4"
allocated_ram = sys.argv[3] if len(sys.argv) > 3 else "8"

SERVER_URI = "ws://localhost:8080/ws"

async def run_worker():
    print(f"🚀 Python Worker khởi chạy | Token: {token} | CPU: {allocated_cpu} Cores | RAM: {allocated_ram}GB")
    
    # Kiểm tra GPU thực tế của máy
    has_gpu = torch.cuda.is_available()
    gpu_name = torch.cuda.get_device_name(0) if has_gpu else "None"
    vram_gb = round(torch.cuda.get_device_properties(0).total_memory / (1024**3), 2) if has_gpu else 0

    while True:
        try:
            async with websockets.connect(SERVER_URI) as websocket:
                hw_info = {
                    "os": platform.system(),
                    "cpu_cores": int(allocated_cpu),
                    "system_ram_gb": float(allocated_ram),
                    "has_gpu": has_gpu,
                    "gpu_name": gpu_name,
                    "vram_gb": vram_gb
                }
                
                payload = {
                    "type": "REGISTER_WORKER",
                    "token": token,
                    "hardware": hw_info
                }
                await websocket.send(json.dumps(payload))
                print("🟢 Đã đăng ký phần cứng lên Core Server thành công!")

                # Giữ kết nối và lắng nghe lệnh từ Server
                async for message in websocket:
                    data = json.loads(message)
                    print(f"📥 Nhận task từ server: {data}")
                    
        except Exception as e:
            print(f"⚠️ Mất kết nối tới server ({e}). Thử kết nối lại sau 5 giây...")
            await asyncio.sleep(5)

if __name__ == "__main__":
    asyncio.run(run_worker())