import pytest
from skill_google_workspace_web import execute, TOOL_SCHEMA

def test_tool_schema():
    assert TOOL_SCHEMA["name"] == "skill_google_workspace_web"
    assert TOOL_SCHEMA["risk_level"] == "safe"
    actions = TOOL_SCHEMA["parameters"]["properties"]["action"]["enum"]
    assert "create_google_sheet" in actions
    assert "create_google_doc" in actions
    assert "parse_google_url" in actions
    assert "build_export_url" in actions
    assert "build_open_tab_plan" in actions

def test_unknown_action():
    result = execute(action="unknown_action")
    assert not result["ok"]
    assert "Unknown action" in result["error"]

def test_parse_google_url(tmp_path):
    url = "https://docs.google.com/document/d/1A2B3C4D5E6F7G8H9I0J1K2L3M4N5O6P7Q8R9S0T1U2V3W4X5Y6Z7"
    result = execute(action="parse_google_url", url=url)
    assert result["ok"]
    assert result["file_id"] == "1A2B3C4D5E6F7G8H9I0J1K2L3M4N5O6P7Q8R9S0T1U2V3W4X5Y6Z7"

def test_build_export_url(tmp_path):
    url = "https://docs.google.com/document/d/1A2B3C4D5E6F7G8H9I0J1K2L3M4N5O6P7Q8R9S0T1U2V3W4X5Y6Z7"
    result = execute(action="build_export_url", url=url, export_format="pdf")
    assert result["ok"]
    assert "export_url" in result
    assert "format=pdf" in result["export_url"]

def test_build_open_tab_plan(tmp_path):
    url = "https://docs.google.com/document/d/1A2B3C4D5E6F7G8H9I0J1K2L3M4N5O6P7Q8R9S0T1U2V3W4X5Y6Z7"
    result = execute(action="build_open_tab_plan", url=url, cdp_url="http://localhost:9222")
    assert result["ok"]
    assert result["cdp_url"] == "http://localhost:9222"
    assert result["url"] == url

def test_parse_google_url_invalid(tmp_path):
    url = "https://invalid.google.com/document/d/1A2B3C4D5E6F7G8H9I0J1K2L3M4N5O6P7Q8R9S0T1U2V3W4X5Y6Z7"
    result = execute(action="parse_google_url", url=url)
    assert not result["ok"]
    assert "Invalid Google URL" in result["error"]
