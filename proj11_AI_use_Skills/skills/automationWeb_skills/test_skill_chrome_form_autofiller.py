import pytest
from skill_chrome_form_autofiller import execute, TOOL_SCHEMA

def test_tool_schema():
    assert isinstance(TOOL_SCHEMA, dict)
    assert TOOL_SCHEMA["name"] == "skill_chrome_form_autofiller"
    assert TOOL_SCHEMA["risk_level"] == "confirm"
    assert "parameters" in TOOL_SCHEMA

def test_unknown_action():
    result = execute(action="unknown")
    assert result["ok"] is False
    assert "error" in result

def test_parse_form_fields(tmp_path):
    html_content = '<form><input name="first_name"><input name="email"></form>'
    result = execute(action="parse_form_fields", html=html_content)
    assert result["ok"] is True
    assert len(result["fields"]) == 2
    assert result["fields"][0]["name"] == "first_name"
    assert result["fields"][1]["name"] == "email"

def test_map_data_to_fields(tmp_path):
    fields = [{"tag": "input", "name": "first_name"}, {"tag": "input", "name": "email"}]
    user_data = {"first_name": "John Doe", "email": "john@example.com"}
    result = execute(action="map_data_to_fields", fields=fields, user_data=user_data)
    assert result["ok"] is True
    assert len(result["plan"]) == 2
    assert result["plan"][0]["field"]["name"] == "first_name"
    assert result["plan"][0]["value"] == "John Doe"
    assert result["plan"][1]["field"]["name"] == "email"
    assert result["plan"][1]["value"] == "john@example.com"

def test_execute_fill_plan(monkeypatch):
    plan = [
        {"field": {"tag": "input", "name": "first_name"}, "value": "John Doe"},
        {"field": {"tag": "input", "name": "email"}, "value": "john@example.com"}
    ]

    def mock_send_cdp_command(url, command):
        return {"ok": True}

    monkeypatch.setattr("skill_chrome_form_autofiller._send_cdp_command", mock_send_cdp_command)
    result = execute(action="execute_fill_plan", plan=plan, dry_run=False)
    assert result["ok"] is True
