import skill_dev_api_client_generator as mod
import pytest
from pathlib import Path

def test_tool_schema():
    schema = mod.TOOL_SCHEMA
    assert schema["name"] == "skill_dev_api_client_generator"
    assert schema["risk_level"] == "safe"
    assert set(schema["parameters"]["properties"]["action"]["enum"]) == {"infer_json_schema", "generate_api_client_code", "generate_mock_server_stub"}

def test_unknown_action():
    result = mod.execute(action="unknown_action")
    assert result == {"ok": False, "error": "Unknown action: unknown_action"}

def test_infer_json_schema(tmp_path):
    sample_json = '{"name": "John", "age": 30, "is_student": false, "courses": ["Math", "Science"], "address": {"city": "New York", "zip": "10001"}}'
    result = mod.execute(action="infer_json_schema", sample_json=sample_json)
    assert result["ok"]
    expected_schema = {
        "type": "object",
        "properties": {
            "name": "string",
            "age": "integer",
            "is_student": "boolean",
            "courses": {"type": "array", "items": "string"},
            "address": {
                "type": "object",
                "properties": {
                    "city": "string",
                    "zip": "string"
                },
                "required": ["city", "zip"]
            }
        },
        "required": ["name", "age", "is_student", "courses", "address"]
    }
    assert result["schema"] == expected_schema

def test_generate_api_client_code(tmp_path, monkeypatch):
    base_url = "http://example.com/api"
    endpoints = [
        {"name": "get_user", "method": "GET", "path": "/user", "params": []},
        {"name": "create_user", "method": "POST", "path": "/user", "params": ["data"], "data": True}
    ]
    def mock_run_cmd(cmd, cwd=None):
        return ""
    monkeypatch.setattr(mod, "_run_cmd", mock_run_cmd)
    result = mod.execute(action="generate_api_client_code", base_url=base_url, endpoints=endpoints, lang="python")
    assert result["ok"]
    assert "def get_user():" in result["code"]
    assert "def create_user(data):" in result["code"]

def test_generate_mock_server_stub(tmp_path, monkeypatch):
    endpoints = [
        {"name": "get_user", "method": "GET", "path": "/user", "response": {"id": 1, "name": "John"}},
        {"name": "create_user", "method": "POST", "path": "/user", "response": {"id": 2, "name": "Jane"}}
    ]
    def mock_run_cmd(cmd, cwd=None):
        return ""
    monkeypatch.setattr(mod, "_run_cmd", mock_run_cmd)
    result = mod.execute(action="generate_mock_server_stub", endpoints=endpoints, port=8080)
    assert result["ok"]
    assert "def do_GET(self):" in result["code"]
    assert "def do_POST(self):" in result["code"]
    assert "/user" in result["code"]
