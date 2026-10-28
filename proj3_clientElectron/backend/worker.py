import io
import json
import sys
import time
import platform
import socket
import psutil
import websocket
import urllib.request

import os

# Ép UTF-8
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

def load_ws_url():
    # 1. Kiểm tra biến môi trường
    env_url = os.environ.get("WS_URL")
    if env_url:
        return env_url
    # 2. Tìm file worker-config.json do Distributed Service tạo
    for cfg_path in ["worker-config.json", "../worker-config.json"]:
        if os.path.exists(cfg_path):
            try:
                with open(cfg_path, "r", encoding="utf-8") as f:
                    cfg = json.load(f)
                    if cfg.get("serverWsUrl"):
                        return cfg.get("serverWsUrl")
            except Exception:
                pass
    return "ws://localhost:8082/ws"

WS_URL = load_ws_url()

def get_location():
    """Lấy vị trí dựa trên IP (miễn phí, không cần API key)"""
    try:
        with urllib.request.urlopen("http://ip-api.com/json/", timeout=5) as response:
            data = json.loads(response.read().decode())
            if data.get("status") == "success":
                return {
                    "lat": data.get("lat"),
                    "lon": data.get("lon"),
                    "city": data.get("city"),
                    "region": data.get("regionName"),
                    "country": data.get("country"),
                    "ip": data.get("query"),
                    "isp": data.get("isp"),
                    "source": "ip-api"
                }
    except Exception as e:
        print(f"[WARN] Không lấy được vị trí: {e}")
    return None

def get_full_system_info():
    # CPU
    cpu_freq = psutil.cpu_freq()
    cpu_info = {
        "percent": psutil.cpu_percent(interval=0.5),
        "count_logical": psutil.cpu_count(logical=True),
        "count_physical": psutil.cpu_count(logical=False),
        "freq_current": round(cpu_freq.current, 1) if cpu_freq else None,
        "freq_max": round(cpu_freq.max, 1) if cpu_freq else None,
    }

    # Memory
    mem = psutil.virtual_memory()
    memory_info = {
        "total": mem.total,
        "available": mem.available,
        "used": mem.used,
        "percent": mem.percent
    }

    # Disk
    disks = []
    for part in psutil.disk_partitions(all=False):
        try:
            usage = psutil.disk_usage(part.mountpoint)
            disks.append({
                "device": part.device,
                "mountpoint": part.mountpoint,
                "fstype": part.fstype,
                "total": usage.total,
                "used": usage.used,
                "free": usage.free,
                "percent": usage.percent
            })
        except:
            pass

    # Network
    net = psutil.net_io_counters()
    network_info = {
        "bytes_sent": net.bytes_sent,
        "bytes_recv": net.bytes_recv,
        "packets_sent": net.packets_sent,
        "packets_recv": net.packets_recv
    }

    # Battery
    battery = psutil.sensors_battery()
    battery_info = None
    if battery:
        battery_info = {
            "percent": battery.percent,
            "plugged": battery.power_plugged,
            "secsleft": battery.secsleft if battery.secsleft != psutil.POWER_TIME_UNLIMITED else None
        }

    # OS
    boot_time = psutil.boot_time()
    os_info = {
        "hostname": socket.gethostname(),
        "platform": platform.system(),
        "release": platform.release(),
        "version": platform.version(),
        "architecture": platform.machine(),
        "processor": platform.processor(),
        "boot_time": time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(boot_time))
    }

    location = get_location()

    return {
        "type": "SYSTEM_INFO",
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S"),
        "hardware": {
            "cpu": cpu_info,
            "memory": memory_info,
            "disk": disks,
            "network": network_info,
            "battery": battery_info
        },
        "os": os_info,
        "location": location
    }

def run_worker():
    print(f"[PYTHON] Đang kết nối tới Go Server tại {WS_URL}...")
    ws = websocket.create_connection(WS_URL)
    print("[PYTHON] Đã kết nối thành công! Bắt đầu quét toàn bộ hệ thống...")

    try:
        while True:
            payload = get_full_system_info()
            ws.send(json.dumps(payload))
            
            loc = payload.get("location")
            loc_str = f"{loc['city']}, {loc['country']}" if loc else "N/A"
            print(f"[SENT] CPU: {payload['hardware']['cpu']['percent']}% | "
                  f"RAM: {payload['hardware']['memory']['percent']}% | "
                  f"Location: {loc_str}")

            time.sleep(2)  # gửi mỗi 2 giây
    except Exception as e:
        print(f"[ERROR] Mất kết nối: {e}")
        try:
            ws.close()
        except:
            pass

if __name__ == "__main__":
    run_worker()