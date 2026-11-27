import pytest
import skill_chrome_som_a11y_observer as mod
from unittest.mock import MagicMock

def test_tool_schema():
    assert mod.TOOL_SCHEMA['name'] == 'skill_chrome_som_a11y_observer'
    assert mod.TOOL_SCHEMA['risk_level'] == 'safe'
    assert 'description' in mod.TOOL_SCHEMA
    assert 'parameters' in mod.TOOL_SCHEMA

def test_unknown_action():
    result = mod.execute(action="unknown_action")
    assert not result["ok"]
    assert "Unknown action" in result["error"]

def test_build_som_inject_js():
    result = mod.execute(action="build_som_inject_js", max_elements=50, include_shadow=False)
    assert result["ok"]
    assert "Building SOM with max_elements=50 and include_shadow=False" in result["js"]

def test_format_a11y_tree():
    result = mod.execute(action="format_a11y_tree", max_items=30)
    assert result["ok"]
    assert "Formatted 0 elements." in result["formatted"]

def test_observe_page_som(monkeypatch, tmp_path):
    mock_fetch_raw = MagicMock(return_value='[{"id": 1, "name": "Button"}]')
    monkeypatch.setattr(mod, "_fetch_raw", mock_fetch_raw)
    mock_run_cmd = MagicMock()
    monkeypatch.setattr(mod, "_run_cmd", mock_run_cmd)

    screenshot_path = str(tmp_path / "som_view.png")
    result = mod.execute(action="observe_page_som", screenshot_path=screenshot_path, dry_run=False)
    assert result["ok"]
    assert "Formatted 1 elements." in result["data"]
    mock_run_cmd.assert_called_once_with(f"echo 'Formatted 1 elements.' > {screenshot_path}")

def test_act_by_som_id(monkeypatch):
    mock_fetch_raw = MagicMock(return_value='[{"id": 1, "name": "Button"}]')
    monkeypatch.setattr(mod, "_fetch_raw", mock_fetch_raw)
    mock_run_cmd = MagicMock()
    monkeypatch.setattr(mod, "_run_cmd", mock_run_cmd)

    result = mod.execute(action="act_by_som_id", som_id=1, op="click", dry_run=False)
    assert result["ok"]
    assert "Performing click on element 1" in result["action"]
    mock_run_cmd.assert_called_once_with("echo 'Performing click on element 1'")
