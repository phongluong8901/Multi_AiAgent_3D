import pytest
from unittest.mock import patch, MagicMock
from skill_gui_input_controller import execute, TOOL_SCHEMA

def test_tool_schema():
    assert TOOL_SCHEMA["name"] == "skill_gui_input_controller"
    assert TOOL_SCHEMA["risk_level"] == "confirm"
    assert "description" in TOOL_SCHEMA
    assert "parameters" in TOOL_SCHEMA
    assert "action" in TOOL_SCHEMA["parameters"]["properties"]
    assert "click" in TOOL_SCHEMA["parameters"]["properties"]["action"]["enum"]
    assert "type_unicode" in TOOL_SCHEMA["parameters"]["properties"]["action"]["enum"]
    assert "press_hotkey" in TOOL_SCHEMA["parameters"]["properties"]["action"]["enum"]
    assert "scroll" in TOOL_SCHEMA["parameters"]["properties"]["action"]["enum"]

def test_execute_click_dry_run():
    result = execute("click", x=100, y=200, button="right", clicks=2, dry_run=True)
    assert result == {"ok": True, "preview": "Click at (100, 200) with button 'right' 2 times"}

def test_execute_type_unicode_dry_run():
    result = execute("type_unicode", text="Hello, World!", dry_run=True)
    assert result == {"ok": True, "preview": "Type Unicode text: Hello, World!"}

def test_execute_press_hotkey_dry_run():
    result = execute("press_hotkey", keys=["ctrl", "c"], dry_run=True)
    assert result == {"ok": True, "preview": "Press hotkey: ctrl + c"}

def test_execute_scroll_dry_run():
    result = execute("scroll", amount=500, dry_run=True)
    assert result == {"ok": True, "preview": "Scroll by 500 units"}

def test_execute_unknown_action():
    result = execute("unknown_action")
    assert result == {"ok": False, "error": "Unknown action: unknown_action"}

@patch("skill_gui_input_controller.click")
def test_execute_click(mock_click):
    mock_click.return_value = {"ok": True}
    result = execute("click", x=100, y=200, button="right", clicks=2)
    mock_click.assert_called_once_with(100, 200, "right", 2, False)
    assert result == {"ok": True}

@patch("skill_gui_input_controller.type_unicode")
def test_execute_type_unicode(mock_type_unicode):
    mock_type_unicode.return_value = {"ok": True}
    result = execute("type_unicode", text="Hello, World!")
    mock_type_unicode.assert_called_once_with("Hello, World!", False)
    assert result == {"ok": True}

@patch("skill_gui_input_controller.press_hotkey")
def test_execute_press_hotkey(mock_press_hotkey):
    mock_press_hotkey.return_value = {"ok": True}
    result = execute("press_hotkey", keys=["ctrl", "c"])
    mock_press_hotkey.assert_called_once_with(["ctrl", "c"], False)
    assert result == {"ok": True}

@patch("skill_gui_input_controller.scroll")
def test_execute_scroll(mock_scroll):
    mock_scroll.return_value = {"ok": True}
    result = execute("scroll", amount=500)
    mock_scroll.assert_called_once_with(500, False)
    assert result == {"ok": True}
