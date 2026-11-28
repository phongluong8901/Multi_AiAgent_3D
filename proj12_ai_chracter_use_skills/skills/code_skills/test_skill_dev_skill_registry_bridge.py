import skill_dev_skill_registry_bridge as mod
import pytest
import json

def test_tool_schema_actions():
    actions = mod.TOOL_SCHEMA["parameters"]["properties"]["action"]["enum"]
    assert "scan_skill_repos" in actions
    assert "export_catalog_json" in actions
    assert "generate_fastapi_bridge" in actions

def test_unknown_action():
    result = mod.execute("unknown_action")
    assert result == {"ok": False, "error": "Unknown action: unknown_action"}

def test_scan_skill_repos(tmp_path):
    repo_dir = tmp_path / "repo"
    repo_dir.mkdir()
    skill_file = repo_dir / "skill_example.py"
    skill_file.write_text('TOOL_SCHEMA = {"name": "example_skill", "description": "Example skill", "risk_level": "safe"}')
    result = mod.execute("scan_skill_repos", repo_dirs=[str(repo_dir)])
    assert result["ok"] is True
    assert len(result["skills"]) == 1
    assert result["skills"][0]["name"] == "example_skill"

def test_export_catalog_json(tmp_path):
    repo_dir = tmp_path / "repo"
    repo_dir.mkdir()
    skill_file = repo_dir / "skill_example.py"
    skill_file.write_text('TOOL_SCHEMA = {"name": "example_skill", "description": "Example skill", "risk_level": "safe"}')
    out_path = tmp_path / "catalog.json"
    result = mod.execute("export_catalog_json", repo_dirs=[str(repo_dir)], out_path=str(out_path))
    assert result["ok"] is True
    assert out_path.exists()
    with open(out_path, 'r') as f:
        catalog = json.load(f)
    assert len(catalog) == 1
    assert catalog[0]["name"] == "example_skill"

def test_generate_fastapi_bridge(tmp_path):
    catalog = [{"name": "example_skill", "description": "Example skill", "risk_level": "safe"}]
    result = mod.execute("generate_fastapi_bridge", catalog=catalog, port=8765)
    assert result["ok"] is True
    assert "FastAPI" in result["script"]
    assert "example_skill" in result["script"]
