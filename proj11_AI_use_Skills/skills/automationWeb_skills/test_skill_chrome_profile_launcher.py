import pytest
from unittest.mock import patch
from skill_chrome_profile_launcher import execute, _run_cmd, _fetch_raw

def test_tool_schema():
    schema = execute("schema")
    assert schema["ok"]
    assert schema["name"] == "skill_chrome_profile_launcher"
    assert schema["risk_level"] == "safe"
    assert "list_chrome_profiles" in schema["parameters"]
    assert "check_cdp_status" in schema["parameters"]
    assert "build_launch_command" in schema["parameters"]

def test_unknown_action():
    result = execute("unknown_action")
    assert not result["ok"]
    assert "Unknown action" in result["error"]

def test_list_chrome_profiles(tmp_path, monkeypatch):
    user_data_dir = tmp_path / "User Data"
    user_data_dir.mkdir()
    profile_dir = user_data_dir / "Default"
    profile_dir.mkdir()
    (profile_dir / "Preferences").touch()

    def mock_list_chrome_profiles(user_data_dir=''):
        return ["Default"]

    monkeypatch.setattr("skill_chrome_profile_launcher.list_chrome_profiles", mock_list_chrome_profiles)
    result = execute("list_chrome_profiles", user_data_dir=str(user_data_dir))
    assert result["ok"]
    assert result["profiles"] == ["Default"]

def test_check_cdp_status(monkeypatch):
    def mock_fetch_raw(url):
        if url == "http://127.0.0.1:9222/json/version":
            return '{"Browser": "Chrome/100.0.4896.127"}'
        return ""

    monkeypatch.setattr("skill_chrome_profile_launcher._fetch_raw", mock_fetch_raw)
    result = execute("check_cdp_status", port=9222, host="127.0.0.1")
    assert result["ok"]
    assert result["status"]

def test_build_launch_command():
    result = execute("build_launch_command", port=9222, profile_dir=r'C:\ChromeDebugProfile', headless=True, browser='chrome')
    assert result["ok"]
    assert result["command"] == '"chrome.exe" --remote-debugging-port=9222 --user-data-dir="C:\\ChromeDebugProfile" --headless'
