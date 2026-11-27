import pytest
from skill_bluetooth_usb_devices import BluetoothUSBDevicesClient, execute

def test_client_init():
    client = BluetoothUSBDevicesClient()
    assert client.output_dir == "outputs"

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

def test_execute_list_usb_devices_live():
    result = execute(action="list_usb_devices", dry_run=False)
    assert "ok" in result
    assert "devices" in result or "error" in result

def test_execute_list_bluetooth_devices_live():
    result = execute(action="list_bluetooth_devices", dry_run=False)
    assert "ok" in result
    assert "devices" in result or "error" in result

def test_execute_list_printers_live():
    result = execute(action="list_printers", dry_run=False)
    assert "ok" in result
    assert "printers" in result or "error" in result

def test_execute_list_external_drives_live():
    result = execute(action="list_external_drives", dry_run=False)
    assert "ok" in result
    assert "drives" in result or "error" in result

def test_execute_unknown_action():
    result = execute(action="unknown_action", dry_run=True)
    assert result["ok"] is False
    assert "Unknown action" in result["error"]
