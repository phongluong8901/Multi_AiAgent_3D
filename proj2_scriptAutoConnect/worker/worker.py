import asyncio
import json
import platform
import subprocess
import sys
import time
import urllib.request
import psutil
import torch
import websockets

DEFAULT_SERVER_URI = "ws://localhost:8080/ws"

def detect_gpu():
    if torch.cuda.is_available():
        gpu_name = torch.cuda.get_device_name(0)
        vram_gb = round(torch.cuda.get_device_properties(0).total_memory / (1024**3), 2)
        return True, gpu_name, vram_gb

    try:
        startupinfo = None
        if platform.system() == "Windows":
            startupinfo = subprocess.STARTUPINFO()
            startupinfo.dwFlags |= subprocess.STARTF_USESHOWWINDOW

        output = subprocess.check_output(
            ["nvidia-smi", "--query-gpu=name,memory.total", "--format=csv,noheader,nounits"],
            encoding="utf-8",
            startupinfo=startupinfo,
            stderr=subprocess.DEVNULL
        )
        line = output.strip().split("\n")[0]
        name, mem_mb = [x.strip() for x in line.split(",")]
        return True, name, round(float(mem_mb) / 1024, 2)
    except Exception:
        return False, "No Dedicated GPU", 0.0

def get_location():
    try:
        req = urllib.request.Request("http://ip-api.com/json/", headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=3) as url:
            data = json.loads(url.read().decode())
            return {
                "city": data.get("city", "Unknown"),
                "country": data.get("country", "Unknown")
            }
    except Exception:
        return {"city": "Unknown", "country": "Unknown"}

def get_hardware_specs():
    max_cpu = psutil.cpu_count(logical=True)
    max_ram = round(psutil.virtual_memory().total / (1024**3), 2)
    has_gpu, gpu_name, vram_gb = detect_gpu()
    supported_models = ["llama-3-8b", "mistral-7b", "sdxl-turbo"] if has_gpu else ["llama-3-8b-cpu", "phi-3-mini"]

    return {
        "os": platform.system(),
        "cpu_cores_total": max_cpu,
        "system_ram_total_gb": max_ram,
        "has_gpu": has_gpu,
        "gpu_name": gpu_name,
        "vram_gb": vram_gb,
        "supported_models": supported_models
    }

async def ping_server(server_uri: str):
    start_time = time.time()
    try:
        async with websockets.connect(server_uri, open_timeout=4) as ws:
            await ws.send(json.dumps({"type": "PING_CHECK"}))
            resp_raw = await asyncio.wait_for(ws.recv(), timeout=4)
            resp = json.loads(resp_raw)
            latency_ms = round((time.time() - start_time) * 1000)
            if resp.get("type") == "PONG_OK":
                print(f"PING_RESULT:{json.dumps({'ok': True, 'latency_ms': latency_ms})}", flush=True)
                return
    except Exception as e:
        print(f"PING_RESULT:{json.dumps({'ok': False, 'error': str(e)})}", flush=True)

async def send_heartbeat_loop(websocket, token: str, allocated_cpu: int, allocated_ram: float):
    """Gửi thông tin tải hệ thống liên tục mỗi 2 giây lên Go Server"""
    psutil.cpu_percent(interval=None)
    while True:
        await asyncio.sleep(2)
        cpu_usage = psutil.cpu_percent(interval=None)
        mem = psutil.virtual_memory()
        ram_used_gb = round(mem.used / (1024**3), 2)
        ram_percent = mem.percent

        heartbeat_payload = {
            "type": "HEARTBEAT",
            "token": token,
            "metrics": {
                "cpu_usage_percent": cpu_usage,
                "ram_used_gb": ram_used_gb,
                "ram_usage_percent": ram_percent,
                "allocated_cpu": allocated_cpu,
                "allocated_ram_gb": allocated_ram,
                "timestamp": int(time.time())
            }
        }
        await websocket.send(json.dumps(heartbeat_payload))
        print(f"METRICS:{json.dumps(heartbeat_payload['metrics'])}", flush=True)

async def receive_tasks_loop(websocket):
    """Lắng nghe lệnh điều phối từ Go Server"""
    async for message in websocket:
        data = json.loads(message)
        print(f"TASK_LOG:{json.dumps(data)}", flush=True)

async def run_worker(server_uri: str, token: str, allocated_cpu: int, allocated_ram: float):
    specs = get_hardware_specs()
    location = get_location()
    print(f"HW_INFO:{json.dumps(specs)}", flush=True)

    while True:
        try:
            async with websockets.connect(server_uri) as websocket:
                register_payload = {
                    "type": "REGISTER_WORKER",
                    "token": token,
                    "location": location,
                    "hardware": {
                        "os": specs["os"],
                        "cpu_cores": allocated_cpu,
                        "cpu_cores_total": specs["cpu_cores_total"],
                        "system_ram_gb": allocated_ram,
                        "system_ram_total_gb": specs["system_ram_total_gb"],
                        "has_gpu": specs["has_gpu"],
                        "gpu_name": specs["gpu_name"],
                        "vram_gb": specs["vram_gb"],
                        "supported_models": specs["supported_models"]
                    }
                }
                await websocket.send(json.dumps(register_payload))
                print("STATUS:CONNECTED", flush=True)

                # Chạy song song: vừa bắn dữ liệu liên tục lên Go, vừa lắng nghe lệnh từ Go
                await asyncio.gather(
                    send_heartbeat_loop(websocket, token, allocated_cpu, allocated_ram),
                    receive_tasks_loop(websocket)
                )
        except Exception as e:
            print(f"STATUS:DISCONNECTED ({e})", flush=True)
            await asyncio.sleep(3)

if __name__ == "__main__":
    mode = sys.argv[1] if len(sys.argv) > 1 else "--scan"

    if mode == "--scan":
        print(f"HW_INFO:{json.dumps(get_hardware_specs())}", flush=True)
        sys.exit(0)

    elif mode == "--ping":
        uri = sys.argv[2] if len(sys.argv) > 2 else DEFAULT_SERVER_URI
        asyncio.run(ping_server(uri))
        sys.exit(0)

    elif mode == "--run":
        uri = sys.argv[2] if len(sys.argv) > 2 else DEFAULT_SERVER_URI
        token_arg = sys.argv[3] if len(sys.argv) > 3 else "default_token"
        cpu_arg = int(sys.argv[4]) if len(sys.argv) > 4 else 4
        ram_arg = float(sys.argv[5]) if len(sys.argv) > 5 else 8.0
        asyncio.run(run_worker(uri, token_arg, cpu_arg, ram_arg))