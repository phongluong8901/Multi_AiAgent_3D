import pytest
import skill_linux_hardware_bus_inspector as mod
from unittest.mock import MagicMock

def test_tool_schema():
    assert mod.TOOL_SCHEMA["name"] == "skill_linux_hardware_bus_inspector"
    assert "description" in mod.TOOL_SCHEMA
    assert mod.TOOL_SCHEMA["risk_level"] == "safe"
    assert "parameters" in mod.TOOL_SCHEMA
    assert "action" in mod.TOOL_SCHEMA["parameters"]["properties"]
    assert "enum" in mod.TOOL_SCHEMA["parameters"]["properties"]["action"]

def test_unknown_action():
    result = mod.execute(action="unknown_action")
    assert not result["ok"]
    assert "Unknown action" in result["error"]

def test_list_serial_devices_dry_run(monkeypatch):
    result = mod.execute(action="list_serial_devices")
    assert result["ok"]
    assert result["devices"] == []

def test_parse_lsusb_output_dry_run(monkeypatch):
    result = mod.execute(action="parse_lsusb_output", raw_text="Bus 001 Device 002: ID 1234:5678 Device Description")
    assert result["ok"]
    assert result["devices"] == []

def test_check_bus_access_dry_run(monkeypatch):
    result = mod.execute(action="check_bus_access")
    assert result["ok"]
    assert result["access"] == {}

def test_parse_lsusb_output(monkeypatch):
    mock_output = "Bus 001 Device 002: ID 1234:5678 Device Description\nBus 002 Device 003: ID 8765:4321 Another Device"
    monkeypatch.setattr(mod, "_run_cmd", MagicMock(return_value=(0, mock_output, "")))
    result = mod.execute(action="parse_lsusb_output", raw_text=mock_output, dry_run=False)
    assert result["ok"]
    assert len(result["devices"]) == 2
    assert result["devices"][0] == {
        "bus": "001",
        "device": "002",
        "vendor_id": "1234",
        "product_id": "5678",
        "description": "Device Description"
    }
    assert result["devices"][1] == {
        "bus": "002",
        "device": "003",
        "vendor_id": "8765",
        "product_id": "4321",
        "description": "Another Device"
    }
