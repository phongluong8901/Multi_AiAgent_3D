import skill_dev_html_component_kit as mod
import pytest
from pathlib import Path

def test_tool_schema_actions():
    actions = mod.TOOL_SCHEMA["parameters"]["properties"]["action"]["enum"]
    assert actions == ["build_schema_form_html", "build_log_viewer_html", "build_kpi_cards_html"]

def test_unknown_action():
    result = mod.execute("unknown_action")
    assert result == {"ok": False, "error": "Unknown action: unknown_action"}

def test_build_schema_form_html(tmp_path):
    tool_schema = {
        "properties": {
            "param1": {"type": "string"},
            "param2": {"type": "string"}
        }
    }
    result = mod.execute("build_schema_form_html", tool_schema=tool_schema, submit_url="/api/test")
    assert result["ok"] is True
    assert "param1" in result["html"]
    assert "param2" in result["html"]
    assert "/api/test" in result["html"]

def test_build_log_viewer_html(tmp_path):
    result = mod.execute("build_log_viewer_html", title="Test Logs", poll_url="/api/test_logs", interval_ms=1000)
    assert result["ok"] is True
    assert "Test Logs" in result["html"]
    assert "/api/test_logs" in result["html"]
    assert "1000" in result["html"]

def test_build_kpi_cards_html(tmp_path):
    cards = [
        {"title": "KPI 1", "value": "100"},
        {"title": "KPI 2", "value": "200"}
    ]
    result = mod.execute("build_kpi_cards_html", cards=cards)
    assert result["ok"] is True
    assert "KPI 1" in result["html"]
    assert "100" in result["html"]
    assert "KPI 2" in result["html"]
    assert "200" in result["html"]
