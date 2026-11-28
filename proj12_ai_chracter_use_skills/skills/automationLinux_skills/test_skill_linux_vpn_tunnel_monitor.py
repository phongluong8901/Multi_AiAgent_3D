import pytest
import skill_linux_vpn_tunnel_monitor as mod

def test_tool_schema():
    assert mod.TOOL_SCHEMA["name"] == "skill_linux_vpn_tunnel_monitor"
    assert mod.TOOL_SCHEMA["risk_level"] == "safe"
    assert "action" in mod.TOOL_SCHEMA["parameters"]["properties"]
    assert set(mod.TOOL_SCHEMA["parameters"]["properties"]["action"]["enum"]) == {
        "parse_tailscale_status", "parse_wireguard_show", "check_tunnel_service"
    }

def test_execute_unknown_action():
    result = mod.execute("unknown_action")
    assert result == {"ok": False, "error": "Unknown action: unknown_action"}

def test_parse_tailscale_status(monkeypatch):
    mock_json = '{"Peer": [{"HostName": "peer1", "Online": true, "LastSeen": "2023-10-01T12:00:00Z"}]}'
    result = mod.parse_tailscale_status(mock_json)
    assert result == {
        "ok": True,
        "summary": {
            "peers": [
                {"name": "peer1", "status": True, "last_seen": "2023-10-01T12:00:00Z"}
            ]
        }
    }

def test_parse_wireguard_show(monkeypatch):
    mock_wg_output = "peer: ABC123\nendpoint: 192.168.1.1:51820\nallowed ips: 10.0.0.1/32"
    result = mod.parse_wireguard_show(mock_wg_output)
    assert result == {
        "ok": True,
        "summary": {
            "peers": [
                {"public_key": "ABC123"}
            ]
        }
    }

def test_check_tunnel_service_active(monkeypatch):
    def mock_run_cmd(cmd):
        if cmd == ['systemctl', 'is-active', 'tailscaled']:
            return (0, 'active', '')
        elif cmd == ['systemctl', 'restart', 'tailscaled']:
            return (0, '', '')
        return (1, '', 'Unknown command')
    
    monkeypatch.setattr(mod, "_run_cmd", mock_run_cmd)
    result = mod.check_tunnel_service(dry_run=False)
    assert result == {"ok": True, "message": "Service tailscaled restarted successfully."}

def test_check_tunnel_service_dry_run(monkeypatch):
    def mock_run_cmd(cmd):
        if cmd == ['systemctl', 'is-active', 'tailscaled']:
            return (0, 'active', '')
        return (1, '', 'Unknown command')
    
    monkeypatch.setattr(mod, "_run_cmd", mock_run_cmd)
    result = mod.check_tunnel_service(dry_run=True)
    assert result == {"ok": True, "message": "Service tailscaled is active. Restart planned (dry run)."}
