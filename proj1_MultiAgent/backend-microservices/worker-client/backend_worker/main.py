"""
Tien trinh Daemon chay ngam cho Worker Client (`main.py`):
- Thu thap thong so phan cung (CPU, RAM, GPU Nvidia qua NVML / nvidia-smi)
- Kiem tra trang thai phuc vu mo hinh LLM qua cong Ollama local
- Khoi tao ket noi P2P WebSocket toi Seller Service / Gateway de san sang nhan prompt suy luan
- Tich luy diem thuong SaveCoin tu dong khi chia se nang luc tinh toan
"""

import io
import sys
from typing import Any, Dict, List

# Dam bao terminal Windows xuat UTF-8 dung chuan va khong bi buffer dong
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace", line_buffering=True)
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace", line_buffering=True)

try:
    from .config_service import parse_args, resolve_connection_info
    from .hardware_service import check_gpu_availability, get_cpu_info, get_memory_info
    from .llm_service import get_llm_info
    from .network_service import WorkerNetworkClient
except ImportError:
    from config_service import parse_args, resolve_connection_info
    from hardware_service import check_gpu_availability, get_cpu_info, get_memory_info
    from llm_service import get_llm_info
    from network_service import WorkerNetworkClient


def run() -> None:
    """
    Diem khoi chay chinh cua Worker Client:
    1. Phan tich tham so dong lenh (CLI arguments) hoac doc cau hinh tu file json
    2. Kiem tra tai nguyen phan cung (CPU, Memory, GPU)
    3. Phat hien engine LLM cuc bo (Ollama)
    4. Thiet lap va duy tri ket noi WebSocket lien tuc
    """
    args = parse_args()
    print("=" * 65)
    print("[INIT] Multi-Agent Distributed Hardware Worker Daemon")
    print("       Hardware telemetry, P2P LLM inference relay & SaveCoin rewards")
    print("=" * 65)

    conn_info: Dict[str, Any] = resolve_connection_info(args)

    # 1. Kiem tra thong so phan cung (CPU, RAM, GPU)
    cpu = get_cpu_info()
    mem = get_memory_info()
    has_gpu, gpu_info = check_gpu_availability()

    print(f"[HARDWARE] CPU Cores: {cpu['count_logical']} | RAM: {mem['total'] / (1024**3):.1f} GB")
    if has_gpu and gpu_info:
        print(f"[HARDWARE][GPU] Detected: {gpu_info['name']} (VRAM: {gpu_info['vram_gb']} GB)")
    else:
        print("[HARDWARE][GPU] No dedicated NVIDIA GPU detected. Operating in CPU-Only Mode.")
        rent_cfg = conn_info.get("rent_config")
        if isinstance(rent_cfg, dict):
            rent_cfg["enableGPU"] = False

    # 2. Kiem tra tinh san sang cua Engine LLM (Ollama)
    ollama_url = str(conn_info.get("ollama_url") or "http://localhost:11434")
    llm: Dict[str, Any] = get_llm_info(ollama_url)
    raw_models = llm.get("installed_models")
    installed_models: List[str] = raw_models if isinstance(raw_models, list) else []

    if llm.get("is_llm_running"):
        models_str = ", ".join(installed_models) if installed_models else "None"
        print(f"[LLM] Ollama is ONLINE at {ollama_url} ({len(installed_models)} models: {models_str})")
    else:
        print(f"[LLM] Ollama is not responding at {ollama_url}. Local model inference disabled until Ollama starts.")

    # 3. Thiet lap thong tin ket noi mang
    ws_url = str(conn_info.get("ws_url") or "")
    token = str(conn_info.get("token") or "")
    node_id = str(conn_info.get("node_id") or "")

    print(f"[CONFIG] Target WebSocket: {ws_url}")
    if token:
        masked_token = token[:10] + "***" if len(token) > 10 else "***"
        print(f"[CONFIG] Auth Token: {masked_token}")
    if node_id:
        print(f"[CONFIG] Node ID: {node_id}")
    print("-" * 65)

    # Khoi chay tien trinh mang chay ngam
    client = WorkerNetworkClient(conn_info, interval=args.interval)
    try:
        client.start()
    except KeyboardInterrupt:
        print("\n[SHUTDOWN] Stopping Worker Daemon gracefully...")
        client.stop()


if __name__ == "__main__":
    run()
