import skill_dev_doc_readme_builder as mod
import pytest
from pathlib import Path

def test_tool_schema_actions():
    actions = mod.TOOL_SCHEMA["parameters"]["properties"]["action"]["enum"]
    assert actions == ["extract_project_meta", "render_readme_md", "write_readme_file"]

def test_unknown_action():
    result = mod.execute("unknown_action")
    assert result == {"ok": False, "error": "Unknown action: unknown_action"}

def test_extract_project_meta(tmp_path):
    project_dir = tmp_path / "test_project"
    project_dir.mkdir()
    (project_dir / "setup.py").touch()

    meta = mod.execute("extract_project_meta", project_dir=str(project_dir))
    assert meta["lang"] == "python"
    assert meta["entry_files"] == ["setup.py"]
    assert meta["commands"] == ["pip install .", "python -m <module_name>"]

def test_render_readme_md():
    content = mod.execute("render_readme_md", project_name="TestProject", description="A test project", lang="python", commands=["pip install .", "python -m <module_name>"])
    assert content["ok"] is True
    assert "TestProject" in content["content"]
    assert "A test project" in content["content"]
    assert "- `pip install .`" in content["content"]
    assert "- `python -m <module_name>`" in content["content"]

def test_write_readme_file(tmp_path, monkeypatch):
    project_dir = tmp_path / "test_project"
    project_dir.mkdir()
    content = mod.render_readme_md("TestProject", "A test project", commands=["pip install .", "python -m <module_name>"])

    def mock_run_cmd(cmd, cwd=None):
        return ""

    monkeypatch.setattr(mod, "_run_cmd", mock_run_cmd)
    result = mod.execute("write_readme_file", project_dir=str(project_dir), content=content, dry_run=True)
    assert result == {"ok": True, "message": "Dry run: README.md would be written to disk."}

    result = mod.execute("write_readme_file", project_dir=str(project_dir), content=content, dry_run=False)
    assert result == {"ok": True, "message": "README.md written to disk."}
    assert (project_dir / "README.md").exists()
