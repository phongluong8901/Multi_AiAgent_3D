import pytest
from unittest.mock import patch
from skill_bluetooth_usb_devices import execute, TOOL_SCHEMA

def test_tool_schema():
    assert TOOL_SCHEMA["name"] == "skill_bluetooth_usb_devices"
    assert TOOL_SCHEMA["risk_level"] == "safe"
    assert "description" in TOOL_SCHEMA
    assert "parameters" in TOOL_SCHEMA

def test_execute_list_usb_devices_dry_run():
    result = execute(action="list_usb_devices", dry_run=True)
    assert result["ok"] is True
    assert result["preview"] == "Listing USB devices (dry run)"

def test_execute_list_bluetooth_devices_dry_run():
    result = execute(action="list_bluetooth_devices", dry_run=True)
    assert result["ok"] is True
    assert result["preview"] == "Listing Bluetooth devices (dry run)"

def test_execute_list_printers_dry_run():
    result = execute(action="list_printers", dry_run=True)
    assert result["ok"] is True
    assert result["preview"] == "Listing printers (dry run)"

def test_execute_list_external_drives_dry_run():
    result = execute(action="list_external_drives", dry_run=True)
    assert result["ok"] is True
    assert result["preview"] == "Listing external drives (dry run)"

@patch("subprocess.run")
def test_execute_list_usb_devices(mock_run):
    mock_run.return_value.stdout = "USB Device 1\nUSB Device 2"
    result = execute(action="list_usb_devices", dry_run=False)
    assert result["ok"] is True
    assert result["devices"] == ["USB Device 1", "USB Device 2"]

@patch("subprocess.run")
def test_execute_list_bluetooth_devices(mock_run):
    mock_run.return_value.stdout = "Bluetooth Device 1\nBluetooth Device 2"
    result = execute(action="list_bluetooth_devices", dry_run=False)
    assert result["ok"] is True
    assert result["devices"] == ["Bluetooth Device 1", "Bluetooth Device 2"]

@patch("subprocess.run")
def test_execute_list_printers(mock_run):
    mock_run.return_value.stdout = "Printer 1\nPrinter 2"
    result = execute(action="list_printers", dry_run=False)
    assert result["ok"] is True
    assert result["printers"] == ["Printer 1", "Printer 2"]

@patch("subprocess.run")
def test_execute_list_external_drives(mock_run):
    mock_run.return_value.stdout = "Drive 1\nDrive 2"
    result = execute(action="list_external_drives", dry_run=False)
    assert result["ok"] is True
    assert result["drives"] == ["Drive 1", "Drive 2"]

def test_execute_unknown_action():
    result = execute(action="unknown_action")
    assert result["ok"] is False
    assert result["error"] == "Unknown action: unknown_action"
