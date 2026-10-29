import io
import sys

# Ensure UTF-8 output and instant line-buffering on Windows terminal
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

def run():
    args = parse_args()
    print("=" * 65)
    print("[INIT] Multi-Agent Distributed Hardware Worker Daemon")
    print("       Hardware telemetry, P2P LLM inference relay & SaveCoin rewards")
    print("=" * 65)

    conn_info = resolve_connection_info(args)
    
    # 1. Hardware Check (CPU, RAM, GPU)
    cpu = get_cpu_info()
    mem = get_memory_info()
    has_gpu, gpu_info = check_gpu_availability()
    
    print(f"[HARDWARE] CPU Cores: {cpu['count_logical']} | RAM: {mem['total'] / (1024**3):.1f} GB")
    if has_gpu and gpu_info:
        print(f"[HARDWARE][GPU] Detected: {gpu_info['name']} (VRAM: {gpu_info['vram_gb']} GB)")
    else:
        print("[HARDWARE][GPU] No dedicated NVIDIA GPU detected. Operating in CPU-Only Mode.")
        conn_info["rent_config"]["enableGPU"] = False

    # 2. LLM Engine Check
    llm = get_llm_info(conn_info["ollama_url"])
    if llm["is_llm_running"]:
        print(f"[LLM] Ollama is ONLINE at {conn_info['ollama_url']} ({len(llm['installed_models'])} models: {', '.join(llm['installed_models']) if llm['installed_models'] else 'None'})")
    else:
        print(f"[LLM] Ollama is not responding at {conn_info['ollama_url']}. Local model inference disabled until Ollama starts.")

    # 3. Connection Setup
    print(f"[CONFIG] Target WebSocket: {conn_info['ws_url']}")
    if conn_info['token']:
        print(f"[CONFIG] Auth Token: {conn_info['token'][:10]}***")
    if conn_info['node_id']:
        print(f"[CONFIG] Node ID: {conn_info['node_id']}")
    print("-" * 65)

    client = WorkerNetworkClient(conn_info, interval=args.interval)
    try:
        client.start()
    except KeyboardInterrupt:
        print("\n[SHUTDOWN] Stopping Worker Daemon gracefully...")
        client.stop()

if __name__ == "__main__":
    run()
