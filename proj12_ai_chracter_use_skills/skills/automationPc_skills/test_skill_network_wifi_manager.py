import pytest
import sys
import types
from unittest.mock import MagicMock

from skill_network_wifi_manager import TOOL_SCHEMA, execute, _run_cmd

def test_tool_schema():
    assert TOOL_SCHEMA["name"] == "skill_network_wifi_manager"
    assert TOOL_SCHEMA["risk_level"] == "safe"
    assert "description" in TOOL_SCHEMA
    assert "parameters" in TOOL_SCHEMA
    assert "action" in TOOL_SCHEMA["parameters"]["properties"]
    assert "host" in TOOL_SCHEMA["parameters"]["properties"]
    assert "count" in TOOL_SCHEMA["parameters"]["properties"]

def test_execute_get_network_info(monkeypatch):
    mock_run_cmd = MagicMock(return_value="IPv4 Address. . . . . . . . . . . : 192.168.1.100\nSSID 1 : MyWiFiNetwork")
    monkeypatch.setattr("skill_network_wifi_manager._run_cmd", mock_run_cmd)
    result = execute("get_network_info")
    assert result["ok"] is True
    assert result["ip_address"] == "192.168.1.100"
    assert result["ssid"] == "MyWiFiNetwork"

def test_execute_list_wifi_networks(monkeypatch):
    mock_run_cmd = MagicMock(return_value="SSID 1 : MyWiFiNetwork\nAuthentication : WPA2-PSK\nCipher : CCMP\nSSID 2 : GuestNetwork\nAuthentication : Open\nCipher : CCMP")
    monkeypatch.setattr("skill_network_wifi_manager._run_cmd", mock_run_cmd)
    result = execute("list_wifi_networks")
    assert result["ok"] is True
    assert len(result["networks"]) == 2
    assert result["networks"][0]["ssid"] == "MyWiFiNetwork"
    assert result["networks"][0]["authentication"] == "WPA2-PSK"
    assert result["networks"][0]["cipher"] == "CCMP"
    assert result["networks"][1]["ssid"] == "GuestNetwork"
    assert result["networks"][1]["authentication"] == "Open"
    assert result["networks"][1]["cipher"] == "CCMP"

def test_execute_ping_host(monkeypatch):
    mock_run_cmd = MagicMock(return_value="Pinging 8.8.8.8 with 32 bytes of data:\nReply from 8.8.8.8: bytes=32 time=12ms TTL=56\nReply from 8.8.8.8: bytes=32 time=13ms TTL=56\nReply from 8.8.8.8: bytes=32 time=12ms TTL=56\nPing statistics for 8.8.8.8:\nPackets: Sent = 3, Received = 3, Lost = 0 (0% loss),\nApproximate round trip times in milli-seconds:\nMinimum = 12ms, Maximum = 13ms, Average = 12ms")
    monkeypatch.setattr("skill_network_wifi_manager._run_cmd", mock_run_cmd)
    result = execute("ping_host", host="8.8.8.8", count=3)
    assert result["ok"] is True
    assert "Pinging 8.8.8.8 with 32 bytes of data:" in result["ping_info"]

def test_execute_check_proxy(monkeypatch):
    mock_run_cmd = MagicMock(return_value="Current WinHTTP proxy settings:\n    Direct access (no proxy server).")
    monkeypatch.setattr("skill_network_wifi_manager._run_cmd", mock_run_cmd)
    result = execute("check_proxy")
    assert result["ok"] is True
    assert "Direct access (no proxy server)." in result["proxy_info"]

def test_execute_unknown_action():
    result = execute("unknown_action")
    assert result["ok"] is False
    assert "Unknown action: unknown_action" in result["error"]
