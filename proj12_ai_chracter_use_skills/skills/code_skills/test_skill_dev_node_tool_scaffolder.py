import pytest
import skill_dev_node_tool_scaffolder as mod
from unittest.mock import patch
import json  # Thêm dòng này để import json

def test_tool_schema_actions():
    assert mod.TOOL_SCHEMA["parameters"]["properties"]["action"]["enum"] == ["scaffold_node_tool", "generate_package_json", "generate_env_loader_js"]

def test_unknown_action():
    result = mod.execute(action="unknown_action")
    assert result == {"ok": False, "error": "Unknown action: unknown_action"}

def test_generate_package_json(tmp_path):
    package_json = mod.generate_package_json(app_name="test_app", deps={"express": "^4.17.1"}, scripts={"start": "node index.js"})
    assert json.loads(package_json) == {
        "name": "test_app",
        "version": "1.0.0",
        "description": "",
        "main": "index.js",
        "scripts": {"start": "node index.js"},
        "dependencies": {"express": "^4.17.1"},
        "author": "",
        "license": "ISC"
    }

def test_generate_env_loader_js(tmp_path):
    env_loader_js = mod.generate_env_loader_js(required_keys=["API_KEY", "DB_URL"])
    assert env_loader_js == """const dotenv = require('dotenv');
dotenv.config();

const requiredKeys = ["API_KEY", "DB_URL"];
requiredKeys.forEach(key => {
  if (!process.env[key]) {
    throw new Error(`Missing environment variable: ${key}`);
  }
});"""

def test_scaffold_node_tool(tmp_path):
    with patch.object(mod, "_run_cmd", return_value=""):
        result = mod.execute(action="scaffold_node_tool", project_dir=str(tmp_path), app_name="test_app", stack="express_js", port=3000, dry_run=False)
        assert result["ok"] == True
        assert (tmp_path / "test_app" / "package.json").exists()
        assert (tmp_path / "test_app" / ".env").exists()
        assert (tmp_path / "test_app" / "index.js").exists()
        with open(tmp_path / "test_app" / "package.json") as f:
            assert json.load(f) == json.loads(result["package_json"])
        with open(tmp_path / "test_app" / ".env") as f:
            assert f.read() == "PORT=3000"
        with open(tmp_path / "test_app" / "index.js") as f:
            assert f.read().startswith("const express = require('express');")
