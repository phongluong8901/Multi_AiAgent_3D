import pytest
from unittest.mock import patch, MagicMock
from skill_browser_cdp_controller import execute, TOOL_SCHEMA

def test_tool_schema():
    assert TOOL_SCHEMA["name"] == "skill_browser_cdp_controller"
    assert TOOL_SCHEMA["risk_level"] == "confirm"
    assert "parameters" in TOOL_SCHEMA
    assert "action" in TOOL_SCHEMA["parameters"]["properties"]
    assert "enum" in TOOL_SCHEMA["parameters"]["properties"]["action"]
    assert "build_chrome_debug_cmd" in TOOL_SCHEMA["parameters"]["properties"]["action"]["enum"]
    assert "list_tabs" in TOOL_SCHEMA["parameters"]["properties"]["action"]["enum"]
    assert "extract_active_tab" in TOOL_SCHEMA["parameters"]["properties"]["action"]["enum"]

def test_execute_invalid_action():
    result = execute("invalid_action")
    assert result == {"ok": False, "error": "Invalid action"}

def test_build_chrome_debug_cmd():
    result = execute("build_chrome_debug_cmd", port=9222, user_data_dir="")
    assert result == {"ok": True, "command": 'chrome --remote-debugging-port=9222'}
    
    result = execute("build_chrome_debug_cmd", port=9223, user_data_dir="/path/to/user/data")
    assert result == {"ok": True, "command": 'chrome --remote-debugging-port=9223 --user-data-dir="/path/to/user/data"'}

def test_list_tabs(monkeypatch):
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = [
        {"id": "1", "type": "page", "title": "Page 1", "url": "http://example.com/page1"},
        {"id": "2", "type": "page", "title": "Page 2", "url": "http://example.com/page2"}
    ]
    monkeypatch.setattr("requests.get", MagicMock(return_value=mock_response))
    
    result = execute("list_tabs", cdp_url="http://localhost:9222")
    assert result == {"ok": True, "tabs": mock_response.json.return_value}

def test_list_tabs_request_exception(monkeypatch):
    import requests  # Import requests here for the mock
    monkeypatch.setattr("requests.get", MagicMock(side_effect=requests.RequestException("Network Error")))
    
    result = execute("list_tabs", cdp_url="http://localhost:9222")
    assert result == {"ok": False, "error": "Network Error"}

def test_extract_active_tab(monkeypatch):
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = [
        {"id": "1", "type": "page", "title": "Page 1", "url": "http://example.com/page1"},
        {"id": "2", "type": "page", "title": "Page 2", "url": "http://example.com/page2"}
    ]
    monkeypatch.setattr("requests.get", MagicMock(return_value=mock_response))
    
    result = execute("extract_active_tab", cdp_url="http://localhost:9222")
    assert result == {"ok": True, "active_tab": mock_response.json.return_value[0]}

def test_extract_active_tab_no_active_tab(monkeypatch):
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = [
        {"id": "1", "type": "background_page", "url": "chrome-extension://example"},
        {"id": "2", "type": "page", "url": "chrome://newtab/"}
    ]
    monkeypatch.setattr("requests.get", MagicMock(return_value=mock_response))
    
    result = execute("extract_active_tab", cdp_url="http://localhost:9222")
    assert result == {"ok": False, "error": "No active tab found"}
