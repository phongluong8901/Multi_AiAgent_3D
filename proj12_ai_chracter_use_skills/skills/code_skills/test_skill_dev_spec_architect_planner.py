import skill_dev_spec_architect_planner as mod
import pytest
from pathlib import Path

def test_tool_schema_actions():
    actions = mod.TOOL_SCHEMA["parameters"]["properties"]["action"]["enum"]
    assert set(actions) == {"build_app_spec", "validate_app_spec", "export_spec_files"}

def test_unknown_action():
    result = mod.execute(action="unknown_action")
    assert result == {"ok": False, "error": "Unknown action: unknown_action"}

def test_build_app_spec(tmp_path):
    spec = mod.execute(action="build_app_spec", app_name="test_app", goal="Test Goal", features=["Feature 1", "Feature 2"], dry_run=True)
    assert spec["app_name"] == "test_app"
    assert spec["goal"] == "Test Goal"
    assert spec["features"] == ["Feature 1", "Feature 2"]
    assert spec["stack"] == "fastapi_tailwind"
    assert len(spec["db_tables"]) > 0
    assert len(spec["api_endpoints"]) > 0
    assert len(spec["ui_views"]) > 0
    assert len(spec["milestones"]) > 0

def test_validate_app_spec():
    valid_spec = {
        "app_name": "test_app",
        "db_tables": [{"name": "users", "fields": ["id", "name", "email"]}],
        "api_endpoints": [{"path": "/users", "method": "GET"}],
        "ui_views": [{"name": "UserList", "path": "/users"}]
    }
    result = mod.validate_app_spec(valid_spec)
    assert result == {"ok": True, "issues": []}

    invalid_spec = {
        "app_name": "test_app",
        "db_tables": [{"name": "users", "fields": ["id", "name", "email"]}],
        "api_endpoints": [{"path": "/users", "method": "GET"}]
    }
    result = mod.validate_app_spec(invalid_spec)
    assert result == {"ok": False, "issues": ["ui_views"]}

def test_export_spec_files(tmp_path):
    spec = {
        "app_name": "test_app",
        "goal": "Test Goal",
        "features": ["Feature 1", "Feature 2"],
        "stack": "fastapi_tailwind",
        "db_tables": [{"name": "users", "fields": ["id", "name", "email"]}],
        "api_endpoints": [{"path": "/users", "method": "GET"}],
        "ui_views": [{"name": "UserList", "path": "/users"}],
        "milestones": ["Design database schema", "Implement API endpoints", "Build UI views"]
    }
    result = mod.execute(action="export_spec_files", spec=spec, project_dir=str(tmp_path), dry_run=False)
    assert result["ok"] == True
    assert Path(tmp_path / "spec.json").exists()
    assert Path(tmp_path / "SPEC.md").exists()
