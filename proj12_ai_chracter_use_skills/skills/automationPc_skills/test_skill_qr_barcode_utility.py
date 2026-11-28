import pytest
import os  # Thêm dòng này để import os
from skill_qr_barcode_utility import execute, TOOL_SCHEMA, build_wifi_qr_payload, build_vcard_payload

def test_tool_schema():
    assert TOOL_SCHEMA["name"] == "skill_qr_barcode_utility"
    assert TOOL_SCHEMA["risk_level"] == "safe"
    assert len(TOOL_SCHEMA["parameters"]["actions"]) == 3

def test_unknown_action():
    result = execute(action="unknown_action")
    assert result == {"ok": False, "error": "Unknown action"}

def test_build_wifi_qr_payload():
    payload = build_wifi_qr_payload(ssid="TestSSID", password="TestPass", security="WPA2")
    assert payload == "WIFI:T:WPA2;S:TestSSID;P:TestPass;;"

def test_build_vcard_payload():
    vcard = build_vcard_payload(name="John Doe", phone="1234567890", email="john.doe@example.com")
    assert vcard == "BEGIN:VCARD\nVERSION:3.0\nFN:John Doe\nTEL;TYPE=CELL:1234567890\nEMAIL;TYPE=INTERNET:john.doe@example.com\nEND:VCARD"

def test_generate_qr_image(tmp_path, monkeypatch):
    def mock_generate_qr_image(data, output_path):
        with open(output_path, 'wb') as f:
            f.write(b"Mock QR Image")
        return {"ok": True, "output_path": output_path}

    monkeypatch.setattr("skill_qr_barcode_utility.generate_qr_image", mock_generate_qr_image)
    result = execute(action="generate_qr_image", data="Test Data", output_path=str(tmp_path / "test_qr.png"))
    assert result["ok"] == True
    assert os.path.exists(result["output_path"])
