import json
import threading
import time
import websocket

try:
    from .hardware_service import (
        get_cpu_info,
        get_memory_info,
        get_disk_info,
        get_network_info,
        get_battery_info,
        get_os_info,
        check_gpu_availability,
        get_location,
    )
    from .llm_service import (
        get_llm_info,
        get_llm_metrics,
        handle_inference_request,
    )
except ImportError:
    from hardware_service import (
        get_cpu_info,
        get_memory_info,
        get_disk_info,
        get_network_info,
        get_battery_info,
        get_os_info,
        check_gpu_availability,
        get_location,
    )
    from llm_service import (
        get_llm_info,
        get_llm_metrics,
        handle_inference_request,
    )

def collect_telemetry(node_id="", ollama_url="http://localhost:11434", rent_config=None):
    """
    Collect comprehensive hardware metrics, GPU status, LLM availability, and rental configuration.
    """
    cpu_info = get_cpu_info()
    memory_info = get_memory_info()
    disks = get_disk_info()
    network_info = get_network_info()
    battery_info = get_battery_info()
    os_info = get_os_info()
    location = get_location()

    # Check GPU availability
    has_gpu, gpu_info = check_gpu_availability()

    # Query LLM runtime & real-time metrics
    llm_info = get_llm_info(ollama_url)
    llm_metrics = get_llm_metrics()

    # Normalize rental config
    effective_rent_config = dict(rent_config) if rent_config else {
        "allocatedCores": 4,
        "allocatedRAMGB": 8,
        "enableGPU": True,
        "gpuSharePercent": 80,
        "minPricePerHourCoin": 35.0,
    }

    # If no physical GPU exists, automatically disable GPU sharing
    if not has_gpu:
        effective_rent_config["enableGPU"] = False

    payload = {
        "type": "SYSTEM_INFO",
        "nodeId": node_id,
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S"),
        "hardware": {
            "cpu": cpu_info,
            "memory": memory_info,
            "disk": disks,
            "network": network_info,
            "battery": battery_info,
            "gpu": gpu_info,
        },
        # Dedicated hardware flags
        "has_gpu": has_gpu,
        "gpu_name": gpu_info["name"] if gpu_info else "CPU Mode (No GPU)",
        "vram_gb": gpu_info["vram_gb"] if gpu_info else 0.0,
        
        # Dedicated LLM status flags
        "is_llm_running": llm_info["is_llm_running"],
        "ollama_running": llm_info["is_llm_running"],
        "llm_provider": llm_info["llm_provider"],
        "llm_version": llm_info["llm_version"],
        "ollama_models": llm_info["installed_models"],
        "installed_models": llm_info["installed_models"],
        "active_model": llm_info["active_model"],

        # Live LLM Activity & Token Tracking
        "llm_stats": {
            "total_requests": llm_metrics["total_requests"],
            "active_requests": llm_metrics["active_requests"],
            "total_tokens": llm_metrics["total_tokens"],
            "prompt_tokens": llm_metrics["prompt_tokens"],
            "completion_tokens": llm_metrics["completion_tokens"],
            "tokens_per_sec": llm_metrics["last_tokens_per_sec"],
            "last_latency_ms": llm_metrics["last_latency_ms"],
            "current_model": llm_metrics["current_model"] or llm_info["active_model"],
            "is_busy": llm_metrics["is_busy"],
            "status": "INFERENCING" if llm_metrics["is_busy"] else ("IDLE" if llm_info["is_llm_running"] else "OFFLINE"),
        },
        "llm_total_tokens": llm_metrics["total_tokens"],
        "llm_total_requests": llm_metrics["total_requests"],
        "llm_active_requests": llm_metrics["active_requests"],
        "llm_is_busy": llm_metrics["is_busy"],
        "llm_tokens_per_sec": llm_metrics["last_tokens_per_sec"],
        "llm_last_latency_ms": llm_metrics["last_latency_ms"],

        # OS and Location
        "os": os_info,
        "location": location,

        # Real-time metrics
        "cpu_percent": cpu_info["percent"],
        "ram_percent": memory_info["percent"],
        "disk_percent": disks[0]["percent"] if len(disks) > 0 else 0.0,
        "gpu_percent": gpu_info["load_percent"] if gpu_info else 0.0,
        "gpu_temp": gpu_info["temperature"] if gpu_info else 0.0,

        # Rental parameters
        "rentConfig": effective_rent_config,
    }

    return payload

class WorkerNetworkClient:
    """Manages WebSocket connection, telemetry transmission, and P2P inference requests"""

    def __init__(self, conn_info, interval=2.0):
        self.conn_info = conn_info
        self.interval = interval
        self.ws = None
        self.ws_lock = threading.Lock()
        self.stop_event = threading.Event()
        self.fallback_urls = [
            "ws://localhost:4000/api/v1/distributed/ws",
            "ws://localhost:5010/api/v1/distributed/ws",
        ]

    def start(self):
        retry_count = 0

        while not self.stop_event.is_set():
            target_ws_url = self.conn_info["ws_url"]
            token = self.conn_info["token"]
            node_id = self.conn_info["node_id"]
            ollama_url = self.conn_info["ollama_url"]
            rent_config = self.conn_info["rent_config"]

            sep = "&" if "?" in target_ws_url else "?"
            p_str = f"token={token}&nodeId={node_id}" if (token or node_id) else ""
            primary_with_params = f"{target_ws_url}{sep}{p_str}" if p_str else target_ws_url
            urls_to_try = [primary_with_params, target_ws_url]
            for f_url in self.fallback_urls:
                if f_url not in urls_to_try:
                    f_sep = "&" if "?" in f_url else "?"
                    urls_to_try.append(f"{f_url}{f_sep}{p_str}" if p_str else f_url)

            self.ws = None
            active_url = ""

            for candidate_url in urls_to_try:
                try:
                    print(f"[CONNECTING] Connecting to: {candidate_url} ...")
                    self.ws = websocket.create_connection(candidate_url, timeout=4)
                    active_url = candidate_url
                    print(f"[CONNECTED] Successfully connected to: {active_url}")
                    retry_count = 0
                    break
                except Exception:
                    pass

            if not self.ws:
                # Vẫn đo đạc thông số máy cục bộ để giao diện Desktop hiển thị ngay cả khi chưa thông mạng
                try:
                    local_payload = collect_telemetry(node_id=node_id, ollama_url=ollama_url, rent_config=rent_config)
                    print(f"[LOCAL_TELEMETRY] {json.dumps(local_payload)}", flush=True)
                except Exception:
                    pass

                retry_count += 1
                wait_sec = min(2 + retry_count, 10)
                print(f"[WAITING] Chưa có kết nối. Backend Microservices đang khởi động hoặc chưa mở cổng WebSocket.", flush=True)
                print(f"          Sẽ tự động thử kết nối lại sau {wait_sec} giây... (Lần thử: {retry_count})", flush=True)
                time.sleep(wait_sec)
                continue

            session_stop = threading.Event()

            def reader_loop():
                while not session_stop.is_set() and not self.stop_event.is_set():
                    try:
                        raw_msg = self.ws.recv()
                        if not raw_msg:
                            break
                        msg_data = json.loads(raw_msg)
                        if isinstance(msg_data, dict):
                            m_type = msg_data.get("type")
                            if m_type == "INFERENCE_REQUEST":
                                threading.Thread(
                                    target=handle_inference_request,
                                    args=(self.ws, self.ws_lock, msg_data, ollama_url, rent_config),
                                    daemon=True,
                                ).start()
                            elif m_type == "PAUSE_SHARING":
                                print("[PAUSED] Đã nhận tín hiệu tạm dừng từ Web/Hệ thống. Tạm ngừng truyền telemetry ra mạng.", flush=True)
                                self.is_paused = True
                            elif m_type == "RESUME_SHARING":
                                print("[RESUME] Đã nhận tín hiệu kích hoạt lại từ Web. Tiếp tục chia sẻ tài nguyên và phát telemetry.", flush=True)
                                self.is_paused = False
                    except websocket.WebSocketTimeoutException:
                        continue
                    except Exception:
                        session_stop.set()
                        break

            self.ws.settimeout(1.0)
            reader_thread = threading.Thread(target=reader_loop, daemon=True)
            reader_thread.start()

            try:
                print("[MONITORING] Starting hardware telemetry transmission & AI P2P relay...", flush=True)
                while not session_stop.is_set() and not self.stop_event.is_set():
                    if getattr(self, "is_paused", False):
                        time.sleep(self.interval)
                        continue

                    payload = collect_telemetry(
                        node_id=node_id,
                        ollama_url=ollama_url,
                        rent_config=rent_config,
                    )
                    with self.ws_lock:
                        self.ws.send(json.dumps(payload))

                    print(f"[LOCAL_TELEMETRY] {json.dumps(payload)}", flush=True)

                    cpu_p = payload["cpu_percent"]
                    ram_p = payload["ram_percent"]
                    has_gpu = payload["has_gpu"]
                    gpu_str = f"GPU: {payload['gpu_name']} ({payload['gpu_percent']:.0f}%)" if has_gpu else "GPU: None (CPU Only)"
                    llm_str = f"LLM: {len(payload['installed_models'])} models" if payload["is_llm_running"] else "LLM: Offline"
                    host = payload["os"]["hostname"]

                    print(f"[TELEMETRY] CPU: {cpu_p:4.1f}% | RAM: {ram_p:4.1f}% | {gpu_str} | {llm_str} | Host: {host}", flush=True)
                    time.sleep(self.interval)

            except Exception as run_err:
                print(f"[WARN][DISCONNECT] Connection lost to {active_url}: {run_err}")
            finally:
                session_stop.set()
                try:
                    self.ws.close()
                except Exception:
                    pass
                time.sleep(2)

    def stop(self):
        self.stop_event.set()
        if self.ws:
            try:
                self.ws.close()
            except Exception:
                pass
