import json
import time
import urllib.request
import threading

DEFAULT_OLLAMA_URL = "http://localhost:11434"

# Global LLM Activity & Token Tracking Metrics (Thread-safe)
_metrics_lock = threading.Lock()
_llm_metrics = {
    "total_requests": 0,
    "active_requests": 0,
    "total_tokens": 0,
    "prompt_tokens": 0,
    "completion_tokens": 0,
    "last_tokens_per_sec": 0.0,
    "last_latency_ms": 0,
    "current_model": "",
    "is_busy": False,
    "last_updated": time.time(),
}

def get_llm_metrics():
    """Return a thread-safe snapshot of real-time LLM activity metrics."""
    with _metrics_lock:
        data = dict(_llm_metrics)
        active_count = int(data.get("active_requests", 0))
        data["is_busy"] = active_count > 0
        return data

def check_ollama_status(ollama_url=DEFAULT_OLLAMA_URL):
    """
    Check if the local Ollama instance is currently running.
    Returns (is_running: bool, version: str)
    """
    try:
        req = urllib.request.Request(f"{ollama_url}/api/version", method="GET")
        with urllib.request.urlopen(req, timeout=1.5) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            return True, data.get("version", "unknown")
    except Exception:
        # Fallback check /api/tags
        try:
            req = urllib.request.Request(f"{ollama_url}/api/tags", method="GET")
            with urllib.request.urlopen(req, timeout=1.5) as resp:
                return True, "active"
        except Exception:
            return False, ""

def get_ollama_models(ollama_url=DEFAULT_OLLAMA_URL):
    """
    Query local Ollama for the list of downloaded / installed models.
    Returns list of model names (e.g. ['qwen2.5-coder:1.5b', 'llama3:8b'])
    """
    try:
        req = urllib.request.Request(f"{ollama_url}/api/tags", method="GET")
        with urllib.request.urlopen(req, timeout=1.5) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            models = data.get("models", [])
            return [m.get("name") for m in models if m.get("name")]
    except Exception:
        return []

def get_llm_info(ollama_url=DEFAULT_OLLAMA_URL):
    """
    Get consolidated LLM runtime information.
    """
    is_running, version = check_ollama_status(ollama_url)
    models = get_ollama_models(ollama_url) if is_running else []
    active_model = models[0] if models else "qwen2.5-coder:1.5b"
    
    return {
        "is_llm_running": is_running,
        "llm_provider": "ollama",
        "llm_version": version,
        "installed_models": models,
        "active_model": active_model,
        "models_count": len(models),
    }

def handle_inference_request(ws, ws_lock, req_data, ollama_url=DEFAULT_OLLAMA_URL, rent_config=None):
    """
    Execute an inference command from the Distributed Service via WebSocket.
    Tracks live tokens, execution speed, active request count, and pushes updates.
    """
    request_id = req_data.get("requestId", "")
    node_id = req_data.get("nodeId", "")
    model = req_data.get("model") or "qwen2.5-coder:1.5b"
    prompt = req_data.get("prompt", "")
    system_prompt = req_data.get("systemPrompt", "Ban la AI Agent thuc thi chuyen nghiep.")
    
    # Extract options with fallback to rent_config
    eff_config = rent_config or {}
    temperature = req_data.get("temperature") or eff_config.get("temperature", 0.7)
    max_tokens = req_data.get("maxTokens") or eff_config.get("maxTokens", 2048)
    context_length = req_data.get("contextLength") or eff_config.get("contextLength", 4096)
    is_stream = bool(req_data.get("stream", True))

    num_threads = eff_config.get("allocatedCores", 4)

    start_time = time.time()

    # Track start of execution
    with _metrics_lock:
        current_active = int(_llm_metrics.get("active_requests", 0))
        total_req = int(_llm_metrics.get("total_requests", 0))
        _llm_metrics["active_requests"] = current_active + 1
        _llm_metrics["total_requests"] = total_req + 1
        _llm_metrics["is_busy"] = True
        _llm_metrics["current_model"] = str(model)
        _llm_metrics["last_updated"] = time.time()

    print(f"[INFERENCE] Starting request #{request_id} (Model: '{model}', MaxTokens: {max_tokens}, Stream: {is_stream})", flush=True)

    # Match requested model with installed Ollama models if slight name divergence
    available_models = get_ollama_models(ollama_url)
    target_model = model
    if available_models and model not in available_models:
        base_name = model.split(":")[0].replace("-coder", "").replace("-r1", "")
        matched = [m for m in available_models if base_name in m]
        target_model = matched[0] if matched else available_models[0]

    payload = {
        "model": target_model,
        "prompt": prompt,
        "system": system_prompt,
        "stream": is_stream,
        "options": {
            "temperature": float(temperature),
            "num_predict": int(max_tokens),
            "num_ctx": int(context_length),
            "num_thread": int(num_threads),
        },
    }

    output_text = ""
    prompt_tokens = 0
    completion_tokens = 0
    eval_duration_sec = 0.0

    try:
        req = urllib.request.Request(
            f"{ollama_url}/api/generate",
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )

        with urllib.request.urlopen(req, timeout=60) as resp:
            if is_stream:
                chunks = []
                for line in resp:
                    if not line:
                        continue
                    try:
                        line_str = line.decode("utf-8").strip()
                        if not line_str:
                            continue
                        chunk_obj = json.loads(line_str)
                        piece = chunk_obj.get("response", "")
                        done = chunk_obj.get("done", False)

                        # Capture token stats from Ollama response if provided
                        if "prompt_eval_count" in chunk_obj:
                            prompt_tokens = int(chunk_obj["prompt_eval_count"])
                        if "eval_count" in chunk_obj:
                            completion_tokens = int(chunk_obj["eval_count"])
                        if "eval_duration" in chunk_obj:
                            ev_dur = float(chunk_obj.get("eval_duration") or 0.0)
                            if ev_dur > 0.0:
                                eval_duration_sec = ev_dur / 1e9

                        if piece:
                            chunks.append(piece)
                            with ws_lock:
                                ws.send(json.dumps({
                                    "type": "INFERENCE_CHUNK",
                                    "requestId": request_id,
                                    "nodeId": node_id,
                                    "model": target_model,
                                    "chunk": piece,
                                    "done": False,
                                }))
                        if done:
                            break
                    except Exception:
                        continue
                output_text = "".join(chunks)
            else:
                res_json = json.loads(resp.read().decode("utf-8"))
                output_text = res_json.get("response", "")
                prompt_tokens = int(res_json.get("prompt_eval_count", 0))
                completion_tokens = int(res_json.get("eval_count", 0))
                ev_dur_direct = float(res_json.get("eval_duration") or 0.0)
                if ev_dur_direct > 0.0:
                    eval_duration_sec = ev_dur_direct / 1e9

        duration_sec = max(0.001, time.time() - start_time)
        latency_ms = int(duration_sec * 1000)

        # Fallback token estimate if Ollama didn't return exact token metrics
        if completion_tokens == 0 and output_text:
            completion_tokens = max(1, int(len(output_text) / 3.8))
        if prompt_tokens == 0 and prompt:
            prompt_tokens = max(1, int(len(prompt) / 3.8))

        tokens_per_sec = round(completion_tokens / (eval_duration_sec if eval_duration_sec > 0 else duration_sec), 1)

        # Update global metrics
        with _metrics_lock:
            _llm_metrics["completion_tokens"] += completion_tokens
            _llm_metrics["prompt_tokens"] += prompt_tokens
            _llm_metrics["total_tokens"] = _llm_metrics["completion_tokens"] + _llm_metrics["prompt_tokens"]
            _llm_metrics["last_tokens_per_sec"] = tokens_per_sec
            _llm_metrics["last_latency_ms"] = latency_ms
            _llm_metrics["last_updated"] = time.time()

        reply = {
            "type": "INFERENCE_RESPONSE",
            "requestId": request_id,
            "nodeId": node_id,
            "model": target_model,
            "output": output_text,
            "promptTokens": prompt_tokens,
            "completionTokens": completion_tokens,
            "totalTokens": prompt_tokens + completion_tokens,
            "tokensPerSec": tokens_per_sec,
            "latencyMs": latency_ms,
            "success": True,
            "done": True,
        }
        print(f"[SUCCESS][INFERENCE] #{request_id} finished: {completion_tokens} tokens ({tokens_per_sec} t/s, {latency_ms}ms)", flush=True)

    except Exception as ex:
        duration_sec = max(0.001, time.time() - start_time)
        latency_ms = int(duration_sec * 1000)

        reply = {
            "type": "INFERENCE_RESPONSE",
            "requestId": request_id,
            "nodeId": node_id,
            "model": target_model,
            "error": f"Lỗi gọi Ollama tại {ollama_url}: {ex}",
            "latencyMs": latency_ms,
            "success": False,
            "done": True,
        }
        print(f"[ERROR][INFERENCE] Failed #{request_id}: {ex}", flush=True)

    finally:
        with _metrics_lock:
            current_active = int(_llm_metrics.get("active_requests", 0))
            new_active = max(0, current_active - 1)
            _llm_metrics["active_requests"] = new_active
            _llm_metrics["is_busy"] = new_active > 0
            _llm_metrics["last_updated"] = time.time()

        with ws_lock:
            try:
                ws.send(json.dumps(reply))
            except Exception:
                pass
