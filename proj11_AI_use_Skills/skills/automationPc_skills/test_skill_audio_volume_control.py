import pytest
import sys
import types
from unittest.mock import MagicMock, patch
from skill_audio_volume_control import execute, TOOL_SCHEMA

def test_tool_schema():
    assert TOOL_SCHEMA["name"] == "skill_audio_volume_control"
    assert TOOL_SCHEMA["risk_level"] == "safe"
    assert "description" in TOOL_SCHEMA
    assert "parameters" in TOOL_SCHEMA
    assert "action" in TOOL_SCHEMA["parameters"]["properties"]
    assert "percent" in TOOL_SCHEMA["parameters"]["properties"]
    assert "delta" in TOOL_SCHEMA["parameters"]["properties"]

def test_execute_set_volume(monkeypatch):
    mock_pycaw = MagicMock()
    monkeypatch.setitem(sys.modules, "pycaw.pycaw", mock_pycaw)
    mock_sessions = MagicMock()
    mock_sessions._ctl.QueryInterface.return_value.GetMasterVolume.return_value = 0.5
    mock_sessions._ctl.QueryInterface.return_value.SetMasterVolume.return_value = None
    mock_pycaw.AudioUtilities.GetAllSessions.return_value = [mock_sessions]
    
    result = execute("set_volume", percent=75)
    assert result == {"ok": True, "message": "Volume set to 75%"}

def test_execute_toggle_mute(monkeypatch):
    mock_pycaw = MagicMock()
    monkeypatch.setitem(sys.modules, "pycaw.pycaw", mock_pycaw)
    mock_sessions = MagicMock()
    mock_sessions._ctl.QueryInterface.return_value.GetMute.return_value = False
    mock_sessions._ctl.QueryInterface.return_value.SetMute.return_value = None
    mock_pycaw.AudioUtilities.GetAllSessions.return_value = [mock_sessions]
    
    result = execute("toggle_mute")
    assert result == {"ok": True, "message": "Mute toggled"}

def test_execute_volume_step(monkeypatch):
    mock_pycaw = MagicMock()
    monkeypatch.setitem(sys.modules, "pycaw.pycaw", mock_pycaw)
    mock_sessions = MagicMock()
    mock_sessions._ctl.QueryInterface.return_value.GetMasterVolume.return_value = 0.5
    mock_sessions._ctl.QueryInterface.return_value.SetMasterVolume.return_value = None
    mock_pycaw.AudioUtilities.GetAllSessions.return_value = [mock_sessions]
    
    result = execute("volume_step", delta=10)
    assert result == {"ok": True, "message": "Volume adjusted by 10%"}

def test_execute_list_audio_devices(monkeypatch):
    mock_pycaw = MagicMock()
    monkeypatch.setitem(sys.modules, "pycaw.pycaw", mock_pycaw)
    mock_device = MagicMock()
    mock_device.FriendlyName = "Speakers"
    mock_pycaw.AudioUtilities.GetSpeakers.return_value = [mock_device]
    
    result = execute("list_audio_devices")
    assert result == {"ok": True, "devices": ["Speakers"]}

def test_execute_unknown_action():
    result = execute("unknown_action")
    assert result == {"ok": False, "error": "Unknown action: unknown_action"}

def test_execute_missing_pycaw(monkeypatch):
    monkeypatch.setitem(sys.modules, "pycaw", None)
    
    result = execute("set_volume", percent=75)
    assert result == {"ok": False, "error": "Missing package pycaw"}
