import skill_dev_local_preview_runner as mod
import pytest
from unittest.mock import MagicMock
import socket  # Thêm dòng import socket

def test_tool_schema_actions():
    actions = mod.TOOL_SCHEMA["parameters"]["properties"]["action"]["enum"]
    assert actions == ["find_free_port", "build_launch_command", "check_preview_health"]

def test_unknown_action():
    result = mod.execute("unknown_action")
    assert result == {"ok": False, "error": "Unknown action: unknown_action"}

def test_find_free_port(tmp_path, monkeypatch):
    def mock_socket_connect_ex(*args, **kwargs):
        return 0 if args[1][1] == 8000 else 1

    monkeypatch.setattr(socket.socket, "connect_ex", mock_socket_connect_ex)
    result = mod.execute("find_free_port", start_port=8000, end_port=8001)
    assert result == {"ok": True, "port": 8001}

def test_build_launch_command(tmp_path):
    result = mod.execute("build_launch_command", project_dir=str(tmp_path), stack='fastapi', port=8000)
    assert result == {"ok": True, "command": "uvicorn main:app --host 0.0.0.0 --port 8000"}

def test_check_preview_health(monkeypatch):
    def mock_http_get(*args, **kwargs):
        return "OK"

    monkeypatch.setattr(mod, "_http_get", mock_http_get)
    result = mod.execute("check_preview_health", url="http://localhost:8000")
    assert result == {"ok": True, "is_healthy": True}
