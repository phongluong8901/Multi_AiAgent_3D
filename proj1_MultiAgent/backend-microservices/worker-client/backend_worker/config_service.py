import json
import os
import argparse

try:
    from dotenv import load_dotenv
    _worker_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    _env_candidates = [
        os.path.join(_worker_dir, ".env"),
        os.path.join(os.getcwd(), ".env"),
        ".env",
    ]
    for _ep in _env_candidates:
        if os.path.exists(_ep):
            load_dotenv(_ep)
            print(f"[CONFIG] Loaded environment variables from: {os.path.abspath(_ep)}")
            break
except ImportError:
    pass

DEFAULT_SERVER_WS = "ws://localhost:4000/api/v1/distributed/ws"
DEFAULT_OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://localhost:11434")

def parse_args():
    parser = argparse.ArgumentParser(description="Multi-Agent Distributed Hardware Worker")
    parser.add_argument("--config", "-c", default="worker-config.json", help="Path to worker-config.json")
    parser.add_argument("--server", "-s", default="", help="Distributed Service WebSocket URL")
    parser.add_argument("--token", "-t", default="", help="Partner Authentication Token (authToken)")
    parser.add_argument("--node-id", "-n", default="", help="Node ID (nodeId)")
    parser.add_argument("--interval", "-i", type=float, default=2.0, help="Telemetry send interval (seconds)")
    return parser.parse_args()

def load_config_file(config_path="worker-config.json"):
    """Search and load configuration from worker-config.json"""
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    search_paths = [
        config_path,
        os.path.join(os.getcwd(), config_path),
        os.path.join(base_dir, config_path),
        os.path.join(base_dir, "..", config_path),
        "worker-config.json",
        "../worker-config.json",
    ]

    for p in search_paths:
        if p and os.path.exists(p):
            try:
                with open(p, "r", encoding="utf-8") as f:
                    cfg = json.load(f)
                    print(f"[CONFIG] Loaded configuration from: {os.path.abspath(p)}")
                    return cfg
            except Exception as e:
                print(f"[WARN] Error reading config file {p}: {e}")
    return {}

def save_config_file(config_data, config_path="worker-config.json"):
    """Write updated configuration to worker-config.json"""
    try:
        with open(config_path, "w", encoding="utf-8") as f:
            json.dump(config_data, f, indent=2, ensure_ascii=False)
        print(f"[CONFIG] Saved configuration to: {os.path.abspath(config_path)}")
        return True
    except Exception as e:
        print(f"[ERROR] Failed to save config to {config_path}: {e}")
        return False

def resolve_connection_info(args=None):
    """Resolve WebSocket URL, Auth Token, Node ID, and Rental Configuration"""
    if args is None:
        cfg = load_config_file()
        server_arg = ""
        token_arg = ""
        node_id_arg = ""
    else:
        cfg = load_config_file(args.config)
        server_arg = args.server
        token_arg = args.token
        node_id_arg = args.node_id

    # 1. Server WS URL
    ws_url = (
        server_arg
        or os.environ.get("WS_URL")
        or cfg.get("serverWsUrl")
        or cfg.get("server_ws_url")
        or DEFAULT_SERVER_WS
    )

    # 2. Token
    token = (
        token_arg
        or os.environ.get("AUTH_TOKEN")
        or cfg.get("authToken")
        or cfg.get("auth_token")
        or ""
    )

    # 3. Node ID: Thiết bị tự sinh định danh phần cứng duy nhất (không cần người dùng cấu hình)
    node_id = (
        node_id_arg
        or os.environ.get("NODE_ID")
        or cfg.get("nodeId")
        or cfg.get("node_id")
        or ""
    )
    if not node_id or str(node_id).startswith("guest_"):
        import uuid
        import hashlib
        try:
            mac_hex = hashlib.md5(str(uuid.getnode()).encode()).hexdigest()[:8]
            node_id = f"node_{mac_hex}"
        except Exception:
            node_id = f"node_{uuid.uuid4().hex[:8]}"
        cfg["nodeId"] = node_id
        save_config_file(cfg, args.config if args else "worker-config.json")
        print(f"[DEVICE] Auto-generated persistent device Node ID: {node_id}")

    # 3.1 Node Name: Tên máy do người dùng cấu hình trên Electron để phân biệt giữa các máy trên Web
    node_name = (
        os.environ.get("NODE_NAME")
        or cfg.get("nodeName")
        or cfg.get("node_name")
        or "phong 01"
    )

    # 4. Ollama / Local LLM Endpoint
    ollama_url = (
        os.environ.get("OLLAMA_URL")
        or cfg.get("localEndpoint")
        or cfg.get("ollamaUrl")
        or DEFAULT_OLLAMA_URL
    )

    # 5. Rent Config
    rent_config = {
        "allocatedCores": int(
            os.environ.get("ALLOCATED_CORES")
            or cfg.get("allocatedCores")
            or cfg.get("allocated_cores")
            or 4
        ),
        "allocatedRAMGB": float(
            os.environ.get("ALLOCATED_RAM_GB")
            or cfg.get("allocatedRAMGB")
            or cfg.get("allocated_ram_gb")
            or 8
        ),
        "enableGPU": (
            os.environ.get("ENABLE_GPU", "").lower() in ("true", "1", "yes")
            if "ENABLE_GPU" in os.environ
            else bool(cfg.get("enableGPU", True))
        ),
        "gpuSharePercent": int(
            os.environ.get("GPU_SHARE_PERCENT")
            or cfg.get("gpuSharePercent")
            or 80
        ),
        "minPricePerHourCoin": float(
            os.environ.get("MIN_PRICE_PER_HOUR")
            or cfg.get("minPricePerHourCoin")
            or 35.0
        ),
        # Dedicated LLM serving configuration
        "maxTokens": int(
            os.environ.get("MAX_TOKENS")
            or cfg.get("maxTokens")
            or 2048
        ),
        "contextLength": int(
            os.environ.get("CONTEXT_LENGTH")
            or cfg.get("contextLength")
            or 4096
        ),
        "temperature": float(
            os.environ.get("TEMPERATURE")
            or cfg.get("temperature")
            or 0.7
        ),
        "defaultModel": str(
            os.environ.get("DEFAULT_MODEL")
            or cfg.get("defaultModel")
            or "qwen2.5-coder:1.5b"
        ),
        "maxConcurrentTasks": int(
            os.environ.get("MAX_CONCURRENT_TASKS")
            or cfg.get("maxConcurrentTasks")
            or 2
        ),
    }

    # Append token, nodeId, and nodeName to query params if present
    import urllib.parse
    sep = "&" if "?" in ws_url else "?"
    params = []
    if token:
        params.append(f"token={token}")
    if node_id:
        params.append(f"nodeId={node_id}")
    if node_name:
        params.append(f"nodeName={urllib.parse.quote(node_name)}")

    if params:
        final_ws_url = f"{ws_url}{sep}{'&'.join(params)}"
    else:
        final_ws_url = ws_url

    return {
        "ws_url": final_ws_url,
        "raw_ws_url": ws_url,
        "token": token,
        "node_id": node_id,
        "node_name": node_name,
        "ollama_url": ollama_url,
        "config": cfg,
        "rent_config": rent_config,
    }
