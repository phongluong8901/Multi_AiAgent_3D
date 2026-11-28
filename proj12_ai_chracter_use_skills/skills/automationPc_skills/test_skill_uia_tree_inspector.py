import pytest
from unittest.mock import patch, MagicMock
from skill_uia_tree_inspector import execute, TOOL_SCHEMA

def test_tool_schema():
    assert TOOL_SCHEMA["name"] == "skill_uia_tree_inspector"
    assert TOOL_SCHEMA["risk_level"] == "safe"
    assert "Đọc cây giao diện ứng dụng Windows UI Automation, tìm nút bấm ô nhập liệu của phần mềm đang mở" in TOOL_SCHEMA["description"]
    assert "Inspect active Windows UI Automation tree" in TOOL_SCHEMA["description"]
    assert "parameters" in TOOL_SCHEMA

def test_execute_get_active_window_tree(monkeypatch):
    mock_auto = MagicMock()
    mock_auto.GetForegroundWindow.return_value = MagicMock(
        Name="Test Window",
        ControlTypeName="Window",
        BoundingRectangle=(0, 0, 100, 100),
        GetChildren=lambda: []
    )
    monkeypatch.setitem(__import__("sys").modules, "uiautomation", mock_auto)
    
    result = execute("get_active_window_tree")
    assert result["ok"]
    assert result["tree"]["name"] == "Test Window"
    assert result["tree"]["control_type"] == "Window"
    assert result["tree"]["bounding_box"] == (0, 0, 100, 100)
    assert result["tree"]["children"] == []

def test_execute_get_active_window_tree_no_active_window(monkeypatch):
    mock_auto = MagicMock()
    mock_auto.GetForegroundWindow.return_value = None
    monkeypatch.setitem(__import__("sys").modules, "uiautomation", mock_auto)
    
    result = execute("get_active_window_tree")
    assert not result["ok"]
    assert result["error"] == "No active window found"

def test_execute_get_active_window_tree_import_error(monkeypatch):
    monkeypatch.setitem(__import__("sys").modules, "uiautomation", None)
    
    result = execute("get_active_window_tree")
    assert not result["ok"]
    assert result["error"] == "Missing package uiautomation"

def test_execute_filter_interactive_nodes():
    nodes = [
        {
            "name": "Button1",
            "control_type": "Button",
            "bounding_box": (0, 0, 100, 100),
            "children": []
        },
        {
            "name": "Edit1",
            "control_type": "Edit",
            "bounding_box": (100, 100, 200, 200),
            "children": []
        },
        {
            "name": "Label1",
            "control_type": "Text",
            "bounding_box": (200, 200, 300, 300),
            "children": []
        }
    ]
    
    result = execute("filter_interactive_nodes", nodes=nodes)
    assert result["ok"]
    assert len(result["filtered_nodes"]) == 2
    assert result["filtered_nodes"][0]["name"] == "Button1"
    assert result["filtered_nodes"][1]["name"] == "Edit1"

def test_execute_filter_interactive_nodes_with_query():
    nodes = [
        {
            "name": "Button1",
            "control_type": "Button",
            "bounding_box": (0, 0, 100, 100),
            "children": []
        },
        {
            "name": "Edit1",
            "control_type": "Edit",
            "bounding_box": (100, 100, 200, 200),
            "children": []
        },
        {
            "name": "Label1",
            "control_type": "Text",
            "bounding_box": (200, 200, 300, 300),
            "children": []
        }
    ]
    
    result = execute("filter_interactive_nodes", nodes=nodes, query="edit")
    assert result["ok"]
    assert len(result["filtered_nodes"]) == 1
    assert result["filtered_nodes"][0]["name"] == "Edit1"

def test_execute_unknown_action():
    result = execute("unknown_action")
    assert not result["ok"]
    assert result["error"] == "Unknown action: unknown_action"
