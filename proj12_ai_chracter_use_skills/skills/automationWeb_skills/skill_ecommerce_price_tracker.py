import json
import re
from typing import Dict, List, Optional

TOOL_SCHEMA = {
    "name": "skill_ecommerce_price_tracker",
    "description": "Extract product title and price numbers from HTML/meta tags (JSON-LD/OpenGraph/price regex), record snapshots into a local JSON tracker file, and compute price drops/increases over time.",
    "risk_level": "safe",
    "parameters": {
        "action": {
            "type": "string",
            "description": "The action to perform: extract_product_from_html, record_price_snapshot, get_price_trend"
        },
        "html": {
            "type": "string",
            "description": "The HTML content of the product page"
        },
        "url": {
            "type": "string",
            "description": "The URL of the product page"
        },
        "item_id": {
            "type": "string",
            "description": "The unique identifier of the product"
        },
        "title": {
            "type": "string",
            "description": "The title of the product"
        },
        "price": {
            "type": "number",
            "description": "The price of the product"
        },
        "currency": {
            "type": "string",
            "description": "The currency of the product price (default: VND)"
        },
        "store_path": {
            "type": "string",
            "description": "The path to the JSON file storing price history (default: price_history.json)"
        }
    }
}

def execute(action: str = "", **kwargs) -> Dict[str, any]:
    try:
        if action == "extract_product_from_html":
            return extract_product_from_html(kwargs.get("html", ""), kwargs.get("url", ""))
        elif action == "record_price_snapshot":
            return record_price_snapshot(
                kwargs.get("item_id", ""),
                kwargs.get("title", ""),
                kwargs.get("price", 0.0),
                kwargs.get("currency", "VND"),
                kwargs.get("store_path", "price_history.json")
            )
        elif action == "get_price_trend":
            return get_price_trend(kwargs.get("item_id", ""), kwargs.get("store_path", "price_history.json"))
        else:
            return {"ok": False, "error": "Unknown action"}
    except Exception as e:
        return {"ok": False, "error": str(e)}

def extract_product_from_html(html: str, url: str = '') -> Dict[str, any]:
    try:
        title = _extract_title_from_html(html)
        price, currency = _extract_price_from_html(html)
        return {"ok": True, "title": title, "price": price, "currency": currency}
    except Exception as e:
        return {"ok": False, "error": str(e)}

def _extract_title_from_html(html: str) -> str:
    # Simple regex to extract title, can be improved
    match = re.search(r'<title>(.*?)</title>', html, re.IGNORECASE)
    return match.group(1) if match else "Unknown Title"

def _extract_price_from_html(html: str) -> (float, str):
    # Simple regex to extract price, can be improved
    match = re.search(r'(\d[\d,.]*)\s*([A-Z]{3})', html)
    if match:
        price = float(match.group(1).replace(',', ''))
        currency = match.group(2)
        return price, currency
    return 0.0, "VND"

def record_price_snapshot(item_id: str, title: str, price: float, currency: str = 'VND', store_path: str = 'price_history.json') -> Dict[str, any]:
    try:
        history = _load_price_history(store_path)
        if item_id not in history:
            history[item_id] = []
        history[item_id].append({"title": title, "price": price, "currency": currency, "timestamp": _get_current_timestamp()})
        _save_price_history(store_path, history)
        return {"ok": True}
    except Exception as e:
        return {"ok": False, "error": str(e)}

def _load_price_history(store_path: str) -> Dict[str, List[Dict[str, any]]]:
    try:
        with open(store_path, 'r', encoding='utf-8') as file:
            return json.load(file)
    except FileNotFoundError:
        return {}
    except Exception as e:
        raise e

def _save_price_history(store_path: str, history: Dict[str, List[Dict[str, any]]]) -> None:
    with open(store_path, 'w', encoding='utf-8') as file:
        json.dump(history, file, ensure_ascii=False, indent=4)

def get_price_trend(item_id: str, store_path: str = 'price_history.json') -> Dict[str, any]:
    try:
        history = _load_price_history(store_path)
        if item_id not in history or len(history[item_id]) < 2:
            return {"ok": False, "error": "Not enough data to determine trend"}
        prices = [entry['price'] for entry in history[item_id]]
        trend = _compute_trend(prices)
        return {"ok": True, "trend": trend}
    except Exception as e:
        return {"ok": False, "error": str(e)}

def _compute_trend(prices: List[float]) -> str:
    if prices[-1] < prices[0]:
        return "decrease"
    elif prices[-1] > prices[0]:
        return "increase"
    else:
        return "stable"

def _get_current_timestamp() -> str:
    from datetime import datetime
    return datetime.now().isoformat()
