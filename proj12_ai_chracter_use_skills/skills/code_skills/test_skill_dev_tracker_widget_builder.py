import skill_dev_tracker_widget_builder as mod
import pytest
from pathlib import Path

def test_tool_schema():
    assert "name" in mod.TOOL_SCHEMA
    assert "description" in mod.TOOL_SCHEMA
    assert "risk_level" in mod.TOOL_SCHEMA
    assert "parameters" in mod.TOOL_SCHEMA
    assert "action" in mod.TOOL_SCHEMA["parameters"]["properties"]
    assert mod.TOOL_SCHEMA["parameters"]["properties"]["action"]["enum"] == ["generate_tracker_app", "parse_price_weather_sample", "evaluate_tracker_alert"]

def test_unknown_action():
    result = mod.execute(action="unknown_action")
    assert result == {"ok": False, "error": "Unknown action: unknown_action"}

def test_generate_tracker_app(tmp_path, monkeypatch):
    def mock_run_cmd(cmd, cwd=None):
        return "Mocked command output"

    monkeypatch.setattr(mod, "_run_cmd", mock_run_cmd)
    result = mod.execute(action="generate_tracker_app", tracker_kind="price", target_name="gold", source_url="http://example.com", interval_sec=60, output_dir=str(tmp_path), dry_run=True)
    assert result == {"ok": True, "message": "Dry run: generate_tracker_app", "details": {'tracker_kind': 'price', 'target_name': 'gold', 'source_url': 'http://example.com', 'interval_sec': 60, 'output_dir': str(tmp_path), 'dry_run': True}}

    result = mod.execute(action="generate_tracker_app", tracker_kind="price", target_name="gold", source_url="http://example.com", interval_sec=60, output_dir=str(tmp_path), dry_run=False)
    assert result == {"ok": True, "message": "Generated price tracker app at " + str(tmp_path / "price_tracker.py")}

def test_parse_price_weather_sample():
    weather_json = '{"main": {"temp": 25, "humidity": 80}, "weather": [{"description": "Sunny"}]}'
    price_json = '{"price": 1000, "symbol": "BTC", "timestamp": "2023-10-01T12:00:00Z"}'

    result = mod.execute(action="parse_price_weather_sample", raw_json=weather_json, tracker_kind="weather")
    assert result == {"ok": True, "normalized": {"temperature": 25, "humidity": 80, "description": "Sunny"}}

    result = mod.execute(action="parse_price_weather_sample", raw_json=price_json, tracker_kind="price")
    assert result == {"ok": True, "normalized": {"price": 1000, "symbol": "BTC", "timestamp": "2023-10-01T12:00:00Z"}}

    result = mod.execute(action="parse_price_weather_sample", raw_json=price_json, tracker_kind="unknown")
    assert result == {"ok": False, "error": "Unknown tracker kind: unknown"}

def test_evaluate_tracker_alert():
    result = mod.execute(action="evaluate_tracker_alert", current_val=100, target_val=200, comparator="lt")
    assert result == {"ok": True, "result": True}

    result = mod.execute(action="evaluate_tracker_alert", current_val=100, target_val=100, comparator="lte")
    assert result == {"ok": True, "result": True}

    result = mod.execute(action="evaluate_tracker_alert", current_val=100, target_val=50, comparator="gt")
    assert result == {"ok": True, "result": True}

    result = mod.execute(action="evaluate_tracker_alert", current_val=100, target_val=100, comparator="gte")
    assert result == {"ok": True, "result": True}

    result = mod.execute(action="evaluate_tracker_alert", current_val=100, target_val=100, comparator="unknown")
    assert result == {"ok": False, "error": "Unknown comparator: unknown"}
