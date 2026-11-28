import skill_dev_code_search_grep as mod
import pytest
from pathlib import Path

def test_tool_schema():
    assert mod.TOOL_SCHEMA["parameters"]["properties"]["action"]["enum"] == ["grep_text", "find_files_by_name", "find_symbol_refs"]

def test_unknown_action():
    result = mod.execute("unknown_action")
    assert result == {"ok": False, "error": "Unknown action: unknown_action"}

def test_grep_text(tmp_path, monkeypatch):
    (tmp_path / "test.py").write_text("def test_function():\n    print('Hello, World!')")
    (tmp_path / "node_modules").mkdir()
    (tmp_path / "node_modules" / "test.js").write_text("console.log('Hello, World!');")
    
    def mock_run_cmd(cmd, cwd=None):
        return (0, "", "")
    
    monkeypatch.setattr(mod, "_run_cmd", mock_run_cmd)
    
    result = mod.execute("grep_text", root_dir=str(tmp_path), pattern="Hello", is_regex=False)
    assert result["ok"] is True
    assert len(result["results"]) == 1
    assert result["results"][0]["file_path"] == str(tmp_path / "test.py")
    assert result["results"][0]["line_number"] == 2
    assert "Hello, World!" in result["results"][0]["context"]

def test_find_files_by_name(tmp_path):
    (tmp_path / "test.py").write_text("def test_function():\n    print('Hello, World!')")
    (tmp_path / "test.txt").write_text("Hello, World!")
    (tmp_path / "node_modules").mkdir()
    (tmp_path / "node_modules" / "test.js").write_text("console.log('Hello, World!');")
    
    result = mod.execute("find_files_by_name", root_dir=str(tmp_path), name_substr="test")
    assert result["ok"] is True
    assert len(result["results"]) == 2
    assert str(tmp_path / "test.py") in result["results"]
    assert str(tmp_path / "test.txt") in result["results"]

def test_find_symbol_refs(tmp_path):
    (tmp_path / "test.py").write_text("def test_function():\n    print('Hello, World!')")
    (tmp_path / "node_modules").mkdir()
    (tmp_path / "node_modules" / "test.js").write_text("console.log('Hello, World!');")
    
    result = mod.execute("find_symbol_refs", root_dir=str(tmp_path), symbol="test_function")
    assert result["ok"] is True
    assert len(result["results"]) == 1
    assert result["results"][0]["file_path"] == str(tmp_path / "test.py")
    assert result["results"][0]["line_number"] == 1
    assert result["results"][0]["symbol"] == "test_function"
