import io
import json
import sys
import time
import platform
import socket
import argparse
import os
import urllib.request

try:
    import psutil
except ImportError:
    print("[ERROR] Thiếu thư viện psutil. Vui lòng cài đặt: pip install psutil")
    sys.exit(1)

try:
    import websocket
except ImportError:
    print("[ERROR] Thiếu thư viện websocket-client. Vui lòng cài đặt: pip install websocket-client")
    sys.exit(1)

# Thiết lập encoding UTF-8 cho console Windows
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

DEFAULT_SERVER_WS = "ws://localhost:4000/api/v1/distributed/ws"

def parse_args():
    parser = argparse.ArgumentParser(description="Multi-Agent Distributed Hardware Worker")
    parser.add_argument("--config", "-c", default="worker-config.json", help="Đường dẫn file worker-config.json")
    parser.add_argument("--server", "-s", default="", help="WebSocket URL của Distributed Service (vd: ws://localhost:4000/api/v1/distributed/ws)")
    parser.add_argument("--token", "-t", default="", help="Token xác thực đối tác (authToken)")
    parser.add_argument("--node-id", "-n", default="", help="ID của node (nodeId)")
    parser.add_argument("--interval", "-i", type=float, default=2.0, help="Chu kỳ gửi telemetry (giây)")
    return parser.parse_args()

def load_config_file(config_path):
    """Tìm và đọc file cấu hình worker-config.json"""
    search_paths = [
        config_path,
        os.path.join(os.getcwd(), config_path),
        os.path.join(os.path.dirname(__file__), config_path),
        os.path.join(os.path.dirname(__file__), "..", config_path),
        "worker-config.json",
        "../worker-config.json",
    ]

    for p in search_paths:
        if p and os.path.exists(p):
            try:
                with open(p, "r", encoding="utf-8") as f:
                    cfg = json.load(f)
                    print(f"📄 [CONFIG] Đã nạp cấu hình từ: {os.path.abspath(p)}")
                    return cfg
            except Exception as e:
                print(f"⚠️ [CONFIG] Lỗi đọc file {p}: {e}")
    return {}

def resolve_connection_info(args):
    """Xác định URL WebSocket và Token xác thực"""
    cfg = load_config_file(args.config)

    # 1. Server WS URL
    ws_url = (
        args.server
        or os.environ.get("WS_URL")
        or cfg.get("serverWsUrl")
        or cfg.get("server_ws_url")
        or DEFAULT_SERVER_WS
    )

    # 2. Token
    token = (
        args.token
        or os.environ.get("AUTH_TOKEN")
        or cfg.get("authToken")
        or cfg.get("auth_token")
        or ""
    )

    # 3. Node ID
    node_id = (
        args.node_id
        or os.environ.get("NODE_ID")
        or cfg.get("nodeId")
        or cfg.get("node_id")
        or ""
    )

    # Đính kèm token và nodeId vào query param nếu có
    sep = "&" if "?" in ws_url else "?"
    params = []
    if token:
        params.append(f"token={token}")
    if node_id:
        params.append(f"nodeId={node_id}")

    if params:
        final_ws_url = f"{ws_url}{sep}{'&'.join(params)}"
    else:
        final_ws_url = ws_url

    return final_ws_url, token, node_id, cfg

def get_location():
    """Lấy vị trí địa lý dựa trên IP công khai"""
    try:
        with urllib.request.urlopen("http://ip-api.com/json/", timeout=4) as response:
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
                    "source": "ip-api",
                }
    except Exception:
        pass
    return None

def collect_telemetry():
    """Thu thập thông số hiệu năng phần cứng thực tế qua psutil"""
    cpu_freq = psutil.cpu_freq()
    cpu_info = {
        "percent": psutil.cpu_percent(interval=0.2),
        "count_logical": psutil.cpu_count(logical=True),
        "count_physical": psutil.cpu_count(logical=False),
        "freq_current": round(cpu_freq.current, 1) if cpu_freq else None,
        "freq_max": round(cpu_freq.max, 1) if cpu_freq else None,
    }

    mem = psutil.virtual_memory()
    memory_info = {
        "total": mem.total,
        "available": mem.available,
        "used": mem.used,
        "percent": mem.percent,
    }

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
                "percent": usage.percent,
            })
        except Exception:
            pass

    net = psutil.net_io_counters()
    network_info = {
        "bytes_sent": net.bytes_sent,
        "bytes_recv": net.bytes_recv,
        "packets_sent": net.packets_sent,
        "packets_recv": net.packets_recv,
    }

    battery = psutil.sensors_battery()
    battery_info = None
    if battery:
        battery_info = {
            "percent": battery.percent,
            "plugged": battery.power_plugged,
            "secsleft": battery.secsleft if battery.secsleft != psutil.POWER_TIME_UNLIMITED else None,
        }

    boot_time = psutil.boot_time()
    os_info = {
        "hostname": socket.gethostname(),
        "platform": platform.system(),
        "release": platform.release(),
        "version": platform.version(),
        "architecture": platform.machine(),
        "processor": platform.processor(),
        "boot_time": time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(boot_time)),
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
            "battery": battery_info,
        },
        "os": os_info,
        "location": location,
        # Các chỉ số rút gọn trực tiếp
        "cpu_percent": cpu_info["percent"],
        "ram_percent": memory_info["percent"],
        "disk_percent": disks[0]["percent"] if len(disks) > 0 else 0.0,
    }

def run():
    args = parse_args()
    print("=" * 60)
    print("🚀 Multi-Agent Distributed Hardware Worker Daemon")
    print("   Dịch vụ gửi thông số phần cứng & tích lũy SaveCoin")
    print("=" * 60)

    retry_count = 0
    fallback_urls = [
        "ws://localhost:4000/api/v1/distributed/ws",
        "ws://localhost:5010/api/v1/distributed/ws",
    ]

    while True:
        target_ws_url, token, node_id, cfg = resolve_connection_info(args)
        
        # Danh sách URL để thử nếu URL chính chưa sẵn sàng
        urls_to_try = [target_ws_url]
        for f_url in fallback_urls:
            if f_url not in urls_to_try:
                sep = "&" if "?" in f_url else "?"
                p_str = f"token={token}&nodeId={node_id}" if token else ""
                urls_to_try.append(f"{f_url}{sep}{p_str}" if p_str else f_url)

        ws = None
        active_url = ""

        for candidate_url in urls_to_try:
            try:
                print(f"📡 [CONNECTING] Đang kết nối tới: {candidate_url} ...")
                ws = websocket.create_connection(candidate_url, timeout=4)
                active_url = candidate_url
                print(f"✅ [CONNECTED] Đã kết nối thành công tới: {active_url}")
                retry_count = 0
                break
            except Exception as conn_err:
                pass

        if not ws:
            retry_count += 1
            wait_sec = min(2 + retry_count, 10)
            print(f"⏳ [WAITING] Chưa có kết nối. Backend Microservices đang khởi động hoặc chưa mở cổng WebSocket.")
            print(f"   Sẽ tự động thử kết nối lại sau {wait_sec} giây... (Lần thử: {retry_count})")
            time.sleep(wait_sec)
            continue

        try:
            print("📊 [MONITORING] Bắt đầu thu thập và truyền phát hiệu năng máy...")
            while True:
                payload = collect_telemetry()
                ws.send(json.dumps(payload))

                cpu_p = payload["cpu_percent"]
                ram_p = payload["ram_percent"]
                loc = payload.get("location")
                loc_txt = f"{loc['city']}, {loc['country']}" if loc else "Local"

                print(f"⚡ [TRANSMIT] CPU: {cpu_p:5.1f}% | RAM: {ram_p:5.1f}% | Máy: {payload['os']['hostname']} | Vị trí: {loc_txt}")
                time.sleep(args.interval)

        except Exception as run_err:
            print(f"⚠️ [DISCONNECT] Mất kết nối tới {active_url}: {run_err}")
            try:
                ws.close()
            except Exception:
                pass
            time.sleep(2)

if __name__ == "__main__":
    run()
