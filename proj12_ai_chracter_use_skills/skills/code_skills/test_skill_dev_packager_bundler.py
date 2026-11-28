import os
import skill_dev_packager_bundler as mod
import pytest
from unittest.mock import MagicMock

def test_tool_schema_actions():
    actions = mod.TOOL_SCHEMA["parameters"]["properties"]["action"]["enum"]
    assert set(actions) == {"build_package_plan", "generate_build_script", "audit_release_artifacts"}

def test_unknown_action():
    result = mod.execute("unknown_action")
    assert result == {"ok": False, "error": "Unknown action: unknown_action"}

def test_build_package_plan(tmp_path, monkeypatch):
    mock_run_cmd = MagicMock(return_value="")
    monkeypatch.setattr(mod, "_run_cmd", mock_run_cmd)
    result = mod.execute("build_package_plan", project_dir=str(tmp_path), lang='python', entry_file='main.py', onefile=True, dry_run=False)
    assert result == {"ok": True, "cmd": "pyinstaller --onefile main.py"}
    mock_run_cmd.assert_called_once_with(['pyinstaller', '--onefile', 'main.py'], cwd=str(tmp_path))

def test_generate_build_script(tmp_path, monkeypatch):
    mock_run_cmd = MagicMock(return_value="")
    monkeypatch.setattr(mod, "_run_cmd", mock_run_cmd)
    result = mod.execute("generate_build_script", project_dir=str(tmp_path), lang='python', target_os='windows', dry_run=False)
    script_path = os.path.join(tmp_path, "build_python.bat")
    assert result == {"ok": True, "script_path": script_path}
    assert os.path.exists(script_path)

def test_audit_release_artifacts(tmp_path):
    dist_dir = tmp_path / "dist"
    dist_dir.mkdir()
    test_file = dist_dir / "test_file.txt"
    test_file.write_text("test content")
    result = mod.execute("audit_release_artifacts", dist_dir=str(dist_dir))
    assert result == {"ok": True, "artifacts": [{"name": "test_file.txt", "path": str(test_file), "size": 12}]}
