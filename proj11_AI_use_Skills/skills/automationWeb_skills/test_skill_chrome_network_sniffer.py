import pytest
import skill_chrome_network_sniffer as mod
from unittest.mock import patch
import json  # Thêm dòng import json

def test_tool_schema():
    assert mod.TOOL_SCHEMA['name'] == 'skill_chrome_network_sniffer'
    assert 'description' in mod.TOOL_SCHEMA
    assert mod.TOOL_SCHEMA['risk_level'] == 'safe'
    assert 'parameters' in mod.TOOL_SCHEMA

def test_unknown_action():
    result = mod.execute(action="unknown_action")
    assert result == {"ok": False, "error": "Unknown action"}

def test_filter_requests(tmp_path):
    entries = [
        {"request": {"url": "http://example.com/api/data"}, "response": {"status": 200, "content": {"mimeType": "application/json"}}},
        {"request": {"url": "http://example.com/api/data"}, "response": {"status": 404, "content": {"mimeType": "text/html"}}},
        {"request": {"url": "http://example.com/other"}, "response": {"status": 200, "content": {"mimeType": "application/json"}}}
    ]
    result = mod.filter_requests(entries=entries, url_contains="/api/", status_min=200, only_json=True)
    assert result == {"ok": True, "filtered_entries": [entries[0]]}

def test_parse_har_file(tmp_path):
    har_content = {
        "log": {
            "entries": [
                {"request": {"url": "http://example.com/api/data"}, "response": {"status": 200}},
                {"request": {"url": "http://example.com/other"}, "response": {"status": 404}}
            ]
        }
    }
    har_path = tmp_path / "test.har"
    har_path.write_text(json.dumps(har_content))
    result = mod.parse_har_file(har_path=str(har_path), limit=1)
    assert result == {"ok": True, "entries": [har_content["log"]["entries"][0]]}

def test_sniff_cdp_plan_dry_run(monkeypatch):
    def mock_run_cmd(cmd):
        return "Dry run completed. No actual network sniffing performed."
    monkeypatch.setattr(mod, "_run_cmd", mock_run_cmd)
    result = mod.sniff_cdp_plan(dry_run=True)
    assert result == {"ok": True, "message": "Dry run completed. No actual network sniffing performed."}
