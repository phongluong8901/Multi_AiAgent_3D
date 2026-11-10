import json
import os
import urllib.request
from fastapi import APIRouter
from typing import List, Dict, Any

router = APIRouter()

AVAILABLE_MODELS: List[Dict[str, Any]] = [
    # --- Google Gemini (Mặc định: gemini-3.5-flash-lite) ---
    {
        "id": "gemini-3.5-flash-lite",
        "name": "Gemini 3.5 Flash Lite (Mặc định)",
        "provider": "Google Gemini",
        "providerId": "google",
        "type": "cloud",
        "category": "Cloud API",
        "description": "Mặc định - Cực nhanh, tiết kiệm Quota tối đa, phản hồi tức thì cho tác vụ đa Agent",
        "context_window": "1,000,000 tokens",
        "contextWindow": "1M tokens",
    },
    {
        "id": "gemini-2.5-flash",
        "name": "Gemini 2.5 Flash",
        "provider": "Google Gemini",
        "providerId": "google",
        "type": "cloud",
        "category": "Cloud API",
        "description": "Mô hình đa năng thế hệ mới, hỗ trợ gọi tool thông minh và suy luận sâu",
        "context_window": "1,000,000 tokens",
        "contextWindow": "1M tokens",
    },
    {
        "id": "gemini-2.5-pro",
        "name": "Gemini 2.5 Pro",
        "provider": "Google Gemini",
        "providerId": "google",
        "type": "cloud",
        "category": "Cloud API",
        "description": "Suy luận chuyên sâu, phân tích báo cáo và mã nguồn phức tạp",
        "context_window": "2,000,000 tokens",
        "contextWindow": "2M tokens",
    },
    {
        "id": "gemini-2.0-flash",
        "name": "Gemini 2.0 Flash",
        "provider": "Google Gemini",
        "providerId": "google",
        "type": "cloud",
        "category": "Cloud API",
        "description": "Tốc độ phản hồi cao, cân bằng chi phí và độ chính xác",
        "context_window": "1,000,000 tokens",
        "contextWindow": "1M tokens",
    },
    # --- OpenAI / DeepSeek / Anthropic ---
    {
        "id": "gpt-4o",
        "name": "GPT-4o (Omni Flagship)",
        "provider": "OpenAI",
        "providerId": "openai",
        "type": "cloud",
        "category": "Cloud API",
        "description": "Mô hình đa thể thức cao cấp của OpenAI",
        "context_window": "128,000 tokens",
        "contextWindow": "128K tokens",
    },
    {
        "id": "gpt-4o-mini",
        "name": "GPT-4o Mini",
        "provider": "OpenAI",
        "providerId": "openai",
        "type": "cloud",
        "category": "Cloud API",
        "description": "Nhanh & tối ưu chi phí của OpenAI",
        "context_window": "128,000 tokens",
        "contextWindow": "128K tokens",
    },
    {
        "id": "deepseek-chat",
        "name": "DeepSeek-V3 Chat",
        "provider": "DeepSeek",
        "providerId": "deepseek",
        "type": "cloud",
        "category": "Cloud API",
        "description": "Mô hình MoE mã nguồn mở hiệu năng cao",
        "context_window": "64,000 tokens",
        "contextWindow": "64K tokens",
    },
    {
        "id": "deepseek-reasoner",
        "name": "DeepSeek-R1 Reasoner",
        "provider": "DeepSeek",
        "providerId": "deepseek",
        "type": "cloud",
        "category": "Cloud API",
        "description": "Tư duy chuỗi suy luận (Chain-of-Thought) chuyên Toán & Thuật toán",
        "context_window": "64,000 tokens",
        "contextWindow": "64K tokens",
    },
    # --- Local / Distributed Open-Weights (Ollama) ---
    {
        "id": "qwen2.5-coder:1.5b",
        "name": "Qwen 2.5 Coder 1.5B (Local / Worker)",
        "provider": "Ollama Local / P2P",
        "providerId": "ollama",
        "type": "local_ollama",
        "category": "Local LLM",
        "description": "Siêu nhẹ, chuyên sinh mã nguồn Python & thực thi cục bộ",
        "context_window": "32,768 tokens",
        "contextWindow": "32K tokens",
    },
    {
        "id": "qwen2.5:1.5b",
        "name": "Qwen 2.5 1.5B Instruct (Local / Worker)",
        "provider": "Ollama Local / P2P",
        "providerId": "ollama",
        "type": "local_ollama",
        "category": "Local LLM",
        "description": "Đa nhiệm tiếng Việt tự nhiên, phản hồi nhanh trên Worker",
        "context_window": "32,768 tokens",
        "contextWindow": "32K tokens",
    },
    {
        "id": "llama3.2:3b",
        "name": "Llama 3.2 3B Instruct (Local / Worker)",
        "provider": "Ollama Local / P2P",
        "providerId": "ollama",
        "type": "local_ollama",
        "category": "Local LLM",
        "description": "Cân bằng tốc độ và suy luận cục bộ",
        "context_window": "128,000 tokens",
        "contextWindow": "128K tokens",
    },
    {
        "id": "deepseek-r1:1.5b",
        "name": "DeepSeek-R1 1.5B Distill (Local / Worker)",
        "provider": "Ollama Local / P2P",
        "providerId": "ollama",
        "type": "local_ollama",
        "category": "Local LLM",
        "description": "Suy luận chuỗi tư duy chạy hoàn toàn offline",
        "context_window": "32,768 tokens",
        "contextWindow": "32K tokens",
    },
    {
        "id": "gemma2:2b",
        "name": "Gemma 2 2B Instruct (Local / Worker)",
        "provider": "Ollama Local / P2P",
        "providerId": "ollama",
        "type": "local_ollama",
        "category": "Local LLM",
        "description": "Mô hình gọn nhẹ của Google chạy trên Ollama",
        "context_window": "8,192 tokens",
        "contextWindow": "8K tokens",
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
                            "providerId": "ollama",
                            "type": "local_ollama",
                            "category": "Local LLM",
                            "description": "Model đã cài đặt trực tiếp trên máy Ollama Local",
                            "context_window": "32,768 tokens",
                            "contextWindow": "32K tokens",
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
                                "providerId": "seller_p2p",
                                "type": "rented_p2p",
                                "category": "Rented Local LLM",
                                "description": f"Phiên thuê P2P đang hoạt động ({r['model_name']})",
                                "context_window": "32,768 tokens",
                                "contextWindow": "32K tokens",
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
