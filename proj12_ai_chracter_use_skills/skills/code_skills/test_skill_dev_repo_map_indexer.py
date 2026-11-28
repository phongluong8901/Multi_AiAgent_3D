import pytest
import skill_dev_repo_map_indexer as mod
from pathlib import Path

def test_tool_schema_actions():
    actions = mod.TOOL_SCHEMA["parameters"]["properties"]["action"]["enum"]
    assert set(actions) == {"build_tree", "extract_python_symbols", "build_repo_map"}

def test_unknown_action():
    result = mod.execute("unknown_action")
    assert result == {"ok": False, "error": "Unknown action: unknown_action"}

def test_build_tree(tmp_path):
    (tmp_path / ".git").mkdir()
    (tmp_path / "node_modules").mkdir()
    (tmp_path / "__pycache__").mkdir()
    (tmp_path / "src").mkdir()
    (tmp_path / "src" / "main.py").touch()
    (tmp_path / "src" / "subdir").mkdir()
    (tmp_path / "src" / "subdir" / "subfile.py").touch()

    result = mod.execute("build_tree", root_dir=str(tmp_path))
    assert result["ok"] is True
    assert "src" in result["result"]
    assert ".git" not in result["result"]
    assert "node_modules" not in result["result"]
    assert "__pycache__" not in result["result"]

def test_extract_python_symbols(tmp_path):
    test_file = tmp_path / "test.py"
    test_file.write_text("def test_func():\n    pass\nclass TestClass:\n    pass")

    result = mod.execute("extract_python_symbols", file_path=str(test_file))
    assert result["ok"] is True
    assert set(result["result"]) == {"test_func", "TestClass"}

def test_build_repo_map(tmp_path):
    (tmp_path / "src").mkdir()
    (tmp_path / "src" / "main.py").write_text("def main_func():\n    pass")
    (tmp_path / "src" / "subdir").mkdir()
    (tmp_path / "src" / "subdir" / "subfile.py").write_text("def sub_func():\n    pass")

    result = mod.execute("build_repo_map", root_dir=str(tmp_path))
    assert result["ok"] is True
    assert "src/main.py" in result["result"]["files"]
    assert "src/subdir/subfile.py" in result["result"]["files"]
    assert set(result["result"]["files"]["src/main.py"]) == {"main_func"}
    assert set(result["result"]["files"]["src/subdir/subfile.py"]) == {"sub_func"}
