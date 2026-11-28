import pytest
import sys
import types
from unittest.mock import MagicMock
from skill_http_api_tester import execute, TOOL_SCHEMA

def test_tool_schema():
    assert TOOL_SCHEMA["name"] == "skill_http_api_tester"
    assert TOOL_SCHEMA["risk_level"] == "safe"
    assert "description" in TOOL_SCHEMA
    assert "parameters" in TOOL_SCHEMA

def test_execute_unknown_action():
    result = execute(action="unknown")
    assert result == {"ok": False, "error": "Unknown action: unknown"}

def test_execute_request_get(monkeypatch):
    mock_httpx = MagicMock()
    mock_httpx.request.return_value.status_code = 200
    mock_httpx.request.return_value.headers = {"Content-Type": "application/json"}
    mock_httpx.request.return_value.json.return_value = {"key": "value"}
    monkeypatch.setitem(sys.modules, "httpx", mock_httpx)

    result = execute(action="request", url="http://example.com", method="GET")
    assert result["ok"] is True
    assert result["status_code"] == 200
    assert result["headers"] == {"Content-Type": "application/json"}
    assert result["json"] == {"key": "value"}

def test_execute_request_post(monkeypatch):
    mock_httpx = MagicMock()
    mock_httpx.request.return_value.status_code = 201
    mock_httpx.request.return_value.headers = {"Content-Type": "application/json"}
    mock_httpx.request.return_value.json.return_value = {"key": "value"}
    monkeypatch.setitem(sys.modules, "httpx", mock_httpx)

    result = execute(action="request", url="http://example.com", method="POST", body={"data": "value"})
    assert result["ok"] is True
    assert result["status_code"] == 201
    assert result["headers"] == {"Content-Type": "application/json"}
    assert result["json"] == {"key": "value"}

def test_execute_request_head(monkeypatch):
    mock_httpx = MagicMock()
    mock_httpx.request.return_value.status_code = 200
    mock_httpx.request.return_value.headers = {"Content-Type": "application/json"}
    monkeypatch.setitem(sys.modules, "httpx", mock_httpx)

    result = execute(action="request", url="http://example.com", method="HEAD")
    assert result["ok"] is True
    assert result["status_code"] == 200
    assert result["headers"] == {"Content-Type": "application/json"}

def test_execute_health_check(monkeypatch):
    mock_httpx = MagicMock()
    mock_httpx.request.return_value.status_code = 200
    mock_httpx.request.return_value.headers = {"Content-Type": "application/json"}
    monkeypatch.setitem(sys.modules, "httpx", mock_httpx)

    result = execute(action="health_check", urls=["http://example.com"])
    assert result["ok"] is True
    assert "http://example.com" in result["results"]
    assert result["results"]["http://example.com"]["status_code"] == 200
    assert result["results"]["http://example.com"]["headers"] == {"Content-Type": "application/json"}

def test_execute_missing_httpx(monkeypatch):
    monkeypatch.setitem(sys.modules, "httpx", None)
    result = execute(action="request", url="http://example.com", method="GET")
    assert result == {"ok": False, "error": "Missing package httpx"}
