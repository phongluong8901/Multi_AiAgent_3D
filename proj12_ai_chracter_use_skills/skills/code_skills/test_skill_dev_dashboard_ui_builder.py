import pytest
import skill_dev_dashboard_ui_builder as mod
from pathlib import Path

def test_tool_schema_actions():
    actions = mod.TOOL_SCHEMA["parameters"]["properties"]["action"]["enum"]
    assert actions == ["build_skills_explorer_html", "build_monitor_cards_html", "build_table_chart_page"]

def test_unknown_action():
    result = mod.execute("unknown_action")
    assert result == {"ok": False, "error": "Unknown action: unknown_action"}

def test_build_skills_explorer_html(tmp_path, monkeypatch):
    catalog = [
        {"skill_name": "Skill1", "category": "Category1"},
        {"skill_name": "Skill2", "category": "Category2"}
    ]
    def mock_run_cmd(cmd, cwd=None):
        return ""
    monkeypatch.setattr(mod, "_run_cmd", mock_run_cmd)
    
    output_path = tmp_path / "skills_explorer.html"
    result = mod.execute("build_skills_explorer_html", catalog=catalog, dry_run=False, output_path=output_path)
    assert result["ok"]
    assert output_path.exists()
    with output_path.open("r") as f:
        content = f.read()
        assert "Skill1" in content
        assert "Skill2" in content

def test_build_monitor_cards_html(tmp_path, monkeypatch):
    def mock_run_cmd(cmd, cwd=None):
        return ""
    monkeypatch.setattr(mod, "_run_cmd", mock_run_cmd)
    
    output_path = tmp_path / "monitor_cards.html"
    result = mod.execute("build_monitor_cards_html", title="Monitor Cards", dry_run=False, output_path=output_path)
    assert result["ok"]
    assert output_path.exists()
    with output_path.open("r") as f:
        content = f.read()
        assert "Monitor Cards" in content

def test_build_table_chart_page(tmp_path, monkeypatch):
    columns = ["Column1", "Column2"]
    def mock_run_cmd(cmd, cwd=None):
        return ""
    monkeypatch.setattr(mod, "_run_cmd", mock_run_cmd)
    
    output_path = tmp_path / "table_chart.html"
    result = mod.execute("build_table_chart_page", title="Table Chart", columns=columns, dry_run=False, output_path=output_path)
    assert result["ok"]
    assert output_path.exists()
    with output_path.open("r") as f:
        content = f.read()
        assert "Table Chart" in content
        assert "Column1" in content
        assert "Column2" in content
