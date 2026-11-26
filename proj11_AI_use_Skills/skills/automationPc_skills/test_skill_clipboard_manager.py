import pytest
from unittest.mock import patch, MagicMock
from skill_clipboard_manager import execute, TOOL_SCHEMA, HISTORY_FILE
import os
import json

@pytest.fixture(autouse=True)
def cleanup_history_file():
    yield
    if os.path.exists(HISTORY_FILE):
        os.remove(HISTORY_FILE)

def test_tool_schema():
    assert TOOL_SCHEMA["name"] == "skill_clipboard_manager"
    assert TOOL_SCHEMA["risk_level"] == "safe"
    assert "parameters" in TOOL_SCHEMA
    assert "action" in TOOL_SCHEMA["parameters"]["properties"]
    assert "enum" in TOOL_SCHEMA["parameters"]["properties"]["action"]
    assert "get_text" in TOOL_SCHEMA["parameters"]["properties"]["action"]["enum"]

def test_execute_get_text(monkeypatch):
    mock_pyperclip = MagicMock()
    mock_pyperclip.paste.return_value = "Sample text"
    monkeypatch.setitem(__import__("sys").modules, "pyperclip", mock_pyperclip)
    result = execute("get_text")
    assert result == {"ok": True, "text": "Sample text"}

def test_execute_get_text_missing_pyperclip(monkeypatch):
    monkeypatch.delitem(__import__("sys").modules, "pyperclip", raising=False)
    result = execute("get_text")
    assert result == {"ok": False, "error": "Pyperclip could not find a copy/paste mechanism for your system. For more information, please visit https://pyperclip.readthedocs.io/en/latest/index.html#not-implemented-error\nOn Linux, you can run `sudo apt-get install xclip`, `sudo apt-get install xselect` (on X11) or `sudo apt-get install wl-clipboard` (on Wayland) to install a copy/paste mechanism."}

def test_execute_set_text(monkeypatch):
    mock_pyperclip = MagicMock()
    monkeypatch.setitem(__import__("sys").modules, "pyperclip", mock_pyperclip)
    result = execute("set_text", text="New text")
    assert result == {"ok": True}
    mock_pyperclip.copy.assert_called_once_with("New text")

def test_execute_set_text_missing_pyperclip(monkeypatch):
    monkeypatch.delitem(__import__("sys").modules, "pyperclip", raising=False)
    result = execute("set_text", text="New text")
    assert result == {"ok": False, "error": "Pyperclip could not find a copy/paste mechanism for your system. For more information, please visit https://pyperclip.readthedocs.io/en/latest/index.html#not-implemented-error\nOn Linux, you can run `sudo apt-get install xclip`, `sudo apt-get install xselect` (on X11) or `sudo apt-get install wl-clipboard` (on Wayland) to install a copy/paste mechanism."}

def test_execute_save_history():
    result = execute("save_history", entry="Test entry")
    assert result == {"ok": True}
    with open(HISTORY_FILE, "r") as file:
        history = json.load(file)
    assert history == ["Test entry"]

def test_execute_search_history():
    with open(HISTORY_FILE, "w") as file:
        json.dump(["Test entry 1", "Another entry", "Test entry 2"], file)
    result = execute("search_history", query="Test")
    assert result == {"ok": True, "results": ["Test entry 1", "Test entry 2"]}

def test_execute_invalid_action():
    result = execute("invalid_action")
    assert result == {"ok": False, "error": "Invalid action"}
