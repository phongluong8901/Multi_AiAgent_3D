import pytest
from skill_ecommerce_price_tracker import execute, TOOL_SCHEMA, _extract_title_from_html, _extract_price_from_html, _load_price_history, _save_price_history

def test_tool_schema():
    assert isinstance(TOOL_SCHEMA, dict)
    assert TOOL_SCHEMA["name"] == "skill_ecommerce_price_tracker"
    assert "description" in TOOL_SCHEMA
    assert "risk_level" in TOOL_SCHEMA
    assert "parameters" in TOOL_SCHEMA

def test_unknown_action():
    result = execute(action="unknown_action")
    assert result == {"ok": False, "error": "Unknown action"}

def test_extract_product_from_html(monkeypatch):
    html_content = "<html><head><title>Sample Product</title></head><body><span>1,234,567 VND</span></body></html>"
    result = execute(action="extract_product_from_html", html=html_content)
    assert result == {"ok": True, "title": "Sample Product", "price": 1234567.0, "currency": "VND"}

def test_record_price_snapshot(tmp_path):
    store_path = tmp_path / "price_history.json"
    result = execute(action="record_price_snapshot", item_id="123", title="Sample Product", price=1234567.0, currency="VND", store_path=str(store_path))
    assert result == {"ok": True}
    history = _load_price_history(str(store_path))
    assert history == {"123": [{"title": "Sample Product", "price": 1234567.0, "currency": "VND", "timestamp": history["123"][0]["timestamp"]}]}
    
def test_get_price_trend(tmp_path):
    store_path = tmp_path / "price_history.json"
    history = {"123": [
        {"title": "Sample Product", "price": 1234567.0, "currency": "VND", "timestamp": "2023-01-01T00:00:00"},
        {"title": "Sample Product", "price": 1234568.0, "currency": "VND", "timestamp": "2023-01-02T00:00:00"}
    ]}
    _save_price_history(str(store_path), history)
    result = execute(action="get_price_trend", item_id="123", store_path=str(store_path))
    assert result == {"ok": True, "trend": "increase"}
