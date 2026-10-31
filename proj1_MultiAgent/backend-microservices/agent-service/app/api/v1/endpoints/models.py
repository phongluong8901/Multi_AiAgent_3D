import json
import os
import urllib.request
from fastapi import APIRouter
from typing import List, Dict, Any

router = APIRouter()

AVAILABLE_MODELS: List[Dict[str, Any]] = [
    # --- Google Gemini ---
    {
        "id": "gemini-2.5-flash",
        "name": "Gemini 2.5 Flash (Khuyên dùng - Nhanh & Thông minh)",
        "provider": "Google Gemini",
        "category": "Cloud API",
        "context_window": "1,000,000 tokens",
    },
    {
        "id": "gemini-2.5-pro",
        "name": "Gemini 2.5 Pro (Suy luận chuyên sâu & Code phức tạp)",
        "provider": "Google Gemini",
        "category": "Cloud API",
        "context_window": "2,000,000 tokens",
    },
    {
        "id": "gemini-2.0-flash",
        "name": "Gemini 2.0 Flash (Tốc độ phản hồi cao)",
        "provider": "Google Gemini",
        "category": "Cloud API",
        "context_window": "1,000,000 tokens",
    },
    {
        "id": "gemini-2.5-flash-lite",
        "name": "Gemini 2.5 Flash Lite (Siêu nhẹ & Tiết kiệm Quota)",
        "provider": "Google Gemini",
        "category": "Cloud API",
        "context_window": "1,000,000 tokens",
    },
    # --- OpenAI / DeepSeek / Anthropic ---
    {
        "id": "gpt-4o",
        "name": "GPT-4o (Omni Flagship)",
        "provider": "OpenAI",
        "category": "Cloud API",
        "context_window": "128,000 tokens",
    },
    {
        "id": "gpt-4o-mini",
        "name": "GPT-4o Mini (Nhanh & Tối ưu chi phí)",
        "provider": "OpenAI",
        "category": "Cloud API",
        "context_window": "128,000 tokens",
    },
    {
        "id": "deepseek-chat",
        "name": "DeepSeek-V3 Chat",
        "provider": "DeepSeek",
        "category": "Cloud API",
        "context_window": "64,000 tokens",
    },
    {
        "id": "deepseek-reasoner",
        "name": "DeepSeek-R1 Reasoner (Tư duy Toán & Thuật toán)",
        "provider": "DeepSeek",
        "category": "Cloud API",
        "context_window": "64,000 tokens",
    },
    # --- Local / Distributed Open-Weights (Ollama) ---
    {
        "id": "qwen2.5-coder:1.5b",
        "name": "Qwen 2.5 Coder 1.5B (Local / Distributed - Siêu nhẹ, Chuyên Code)",
        "provider": "Ollama Local / P2P",
        "category": "Local LLM",
        "context_window": "32,768 tokens",
    },
    {
        "id": "qwen2.5:1.5b",
        "name": "Qwen 2.5 1.5B Instruct (Local / Distributed - Đa nhiệm tiếng Việt tốt)",
        "provider": "Ollama Local / P2P",
        "category": "Local LLM",
        "context_window": "32,768 tokens",
    },
    {
        "id": "llama3.2:3b",
        "name": "Llama 3.2 3B Instruct (Local / Distributed - Cân bằng tốc độ & suy luận)",
        "provider": "Ollama Local / P2P",
        "category": "Local LLM",
        "context_window": "128,000 tokens",
    },
    {
        "id": "deepseek-r1:1.5b",
        "name": "DeepSeek-R1 1.5B Distill (Local / Distributed - Suy luận chuỗi tư duy)",
        "provider": "Ollama Local / P2P",
        "category": "Local LLM",
        "context_window": "32,768 tokens",
    },
    {
        "id": "gemma2:2b",
        "name": "Gemma 2 2B Instruct (Local / Distributed - Nhanh & Ổn định)",
        "provider": "Ollama Local / P2P",
        "category": "Local LLM",
        "context_window": "8,192 tokens",
    },
]


def _discover_live_local_and_rented_models(existing_ids: set[str]) -> List[Dict[str, Any]]:
    discovered: List[Dict[str, Any]] = []

    # 1. Quét các model đang cài đặt thực tế trên Local Ollama
    ollama_url = os.getenv("OLLAMA_BASE_URL", "http://host.docker.internal:11434").rstrip("/")
    try:
        req = urllib.request.Request(f"{ollama_url}/api/tags", method="GET")
        with urllib.request.urlopen(req, timeout=1.5) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            for m in data.get("models", []):
                m_name = m.get("name", "").strip()
                if m_name and m_name not in existing_ids:
                    existing_ids.add(m_name)
                    discovered.append(
                        {
                            "id": m_name,
                            "name": f"{m_name} (Đã cài trên Ollama Local)",
                            "provider": "Ollama Local (Installed)",
                            "category": "Local LLM",
                            "context_window": "32,768 tokens",
                        }
                    )
    except Exception:
        pass

    # 2. Quét các phiên thuê P2P đang hoạt động từ ower-service
    owner_url = os.getenv("OWER_SERVICE_URL", "http://ower-service:5012").rstrip("/")
    try:
        req = urllib.request.Request(f"{owner_url}/api/v1/owner/rentals", method="GET")
        with urllib.request.urlopen(req, timeout=1.5) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            rentals = data.get("data") or []
            for r in rentals:
                if r.get("status") == "active" and r.get("node_id") and r.get("model_name"):
                    rental_id = f"rental:{r['node_id']}:{r['model_name']}"
                    if rental_id not in existing_ids:
                        existing_ids.add(rental_id)
                        discovered.append(
                            {
                                "id": rental_id,
                                "name": f"[Node Thuê #{r['node_id'][:8]}] {r['model_name']} ({r.get('provider_name', 'P2P Seller')})",
                                "provider": "P2P Rented Node",
                                "category": "Rented Local LLM",
                                "context_window": "32,768 tokens",
                            }
                        )
    except Exception:
        pass

    return discovered


@router.get("/models")
def get_available_models():
    """Trả về danh sách các mô hình LLM (Cloud + Local Ollama + P2P Rented Nodes)."""
    base_list = list(AVAILABLE_MODELS)
    existing_ids = {m["id"] for m in base_list}
    live_models = _discover_live_local_and_rented_models(existing_ids)
    all_models = live_models + base_list
    return {"total": len(all_models), "models": all_models}
