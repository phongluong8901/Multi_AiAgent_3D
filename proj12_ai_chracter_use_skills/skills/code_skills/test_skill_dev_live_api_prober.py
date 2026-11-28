import skill_dev_live_api_prober as mod
import pytest
import json

def test_tool_schema():
    schema = mod.TOOL_SCHEMA
    assert schema["name"] == "skill_dev_live_api_prober"
    assert schema["risk_level"] == "safe"
    assert set(schema["parameters"]["properties"]["action"]["enum"]) == {"probe_http_json", "summarize_json_structure", "list_free_api_presets"}

def test_unknown_action():
    result = mod.execute("unknown_action")
    assert result == {"ok": False, "error": "Unknown action: unknown_action"}

def test_summarize_json_structure(tmp_path):
    sample_json = '{"name": "John", "age": 30, "children": [{"name": "Jane", "age": 10}]}'
    expected_schema = {'name': 'str', 'age': 'int', 'children': [{'name': 'str', 'age': 'int'}]}
    result = mod.summarize_json_structure(sample_json)
    assert result == expected_schema

def test_list_free_api_presets(tmp_path):
    result = mod.list_free_api_presets()
    assert "weather" in result
    assert "exchange_rate" in result
    assert "github" in result
    assert "hackernews" in result

def test_probe_http_json(tmp_path, monkeypatch):
    def mock_http_request(url, method='GET', headers=None, timeout=8.0):
        return 200, {}, '{"key": "value"}', 0.1

    monkeypatch.setattr(mod, "_http_request", mock_http_request)
    result = mod.execute("probe_http_json", url="https://example.com")
    assert result["ok"] == True
    assert result["status_code"] == 200
    assert result["latency"] == 0.1
    assert result["schema"] == {'key': 'str'}
    assert result["sample_payload"] == {"key": "value"}
