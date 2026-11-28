import skill_dev_rust_cli_scaffolder as mod
import pytest
from unittest.mock import patch

def test_tool_schema_actions():
    actions = mod.TOOL_SCHEMA["parameters"]["properties"]["action"]["enum"]
    assert actions == ["scaffold_rust_tool", "generate_cargo_toml", "generate_rust_main_rs"]

def test_unknown_action():
    result = mod.execute("unknown_action", crate_name="test")
    assert result == {"ok": False, "error": "Unknown action: unknown_action"}

def test_generate_cargo_toml(tmp_path):
    result = mod.execute("generate_cargo_toml", crate_name="test", features=["serde"])
    assert result["ok"]
    assert "serde" in result["cargo_toml"]

def test_generate_rust_main_rs(tmp_path):
    result = mod.execute("generate_rust_main_rs", crate_name="test", preset="file_watcher")
    assert result["ok"]
    assert "file watcher" in result["main_rs"]

def test_scaffold_rust_tool(tmp_path):
    result = mod.execute("scaffold_rust_tool", project_dir=str(tmp_path), crate_name="test", preset="http_checker", dry_run=False)
    assert result["ok"]
    assert (tmp_path / "test" / "Cargo.toml").exists()
    assert (tmp_path / "test" / "src" / "main.rs").exists()
    assert "HTTP checker" in (tmp_path / "test" / "src" / "main.rs").read_text()
