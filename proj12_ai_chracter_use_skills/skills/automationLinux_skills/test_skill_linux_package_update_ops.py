import pytest
import skill_linux_package_update_ops as mod
from unittest.mock import MagicMock

def test_tool_schema():
    assert mod.TOOL_SCHEMA["name"] == "skill_linux_package_update_ops"
    assert "Kiểm tra cập nhật phần mềm Linux apt upgrade" in mod.TOOL_SCHEMA["description"]
    assert mod.TOOL_SCHEMA["risk_level"] == "confirm"
    assert "action" in mod.TOOL_SCHEMA["parameters"]["properties"]
    assert set(mod.TOOL_SCHEMA["parameters"]["properties"]["action"]["enum"]) == {"check_updates", "build_maintenance_plan"}

def test_parse_apt_upgradable(tmp_path):
    test_output = """Listing... Done
libssl1.1/focal-updates,focal-security 1.1.1f-1ubuntu2.10 amd64 [upgradable from: 1.1.1f-1ubuntu2.9]
libsystemd0/focal-updates 245.4-4ubuntu3.14 amd64 [upgradable from: 245.4-4ubuntu3.13]
"""
    (tmp_path / "apt_list_output.txt").write_text(test_output)
    with open(tmp_path / "apt_list_output.txt") as f:
        parsed_packages = mod.parse_apt_upgradable(f.read())
    assert parsed_packages == ["libssl1.1", "libsystemd0"]

def test_check_updates(monkeypatch):
    mock_output = """Listing... Done
libssl1.1/focal-updates,focal-security 1.1.1f-1ubuntu2.10 amd64 [upgradable from: 1.1.1f-1ubuntu2.9]
libsystemd0/focal-updates 245.4-4ubuntu3.14 amd64 [upgradable from: 245.4-4ubuntu3.13]
"""
    monkeypatch.setattr(mod, "_run_cmd", MagicMock(return_value=(0, mock_output, "")))
    result = mod.check_updates()
    assert result["ok"] is True
    assert result["packages"] == ["libssl1.1", "libsystemd0"]

def test_build_maintenance_plan_dry_run():
    result = mod.build_maintenance_plan(dry_run=True)
    assert result["ok"] is True
    assert result["commands"] == ['apt-get clean', 'apt-get autoremove -y']

def test_build_maintenance_plan_execute(monkeypatch):
    mock_results = [
        (0, "Cleaned cache", ""),
        (0, "Removed unused packages", "")
    ]
    monkeypatch.setattr(mod, "_run_cmd", MagicMock(side_effect=mock_results))
    result = mod.build_maintenance_plan(dry_run=False)
    assert result["ok"] is True
    assert result["results"][0]["command"] == "apt-get clean"
    assert result["results"][1]["command"] == "apt-get autoremove -y"
