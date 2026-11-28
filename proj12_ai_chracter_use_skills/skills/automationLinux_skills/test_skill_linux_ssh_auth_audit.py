import pytest
import skill_linux_ssh_auth_audit as mod
from unittest.mock import MagicMock

def test_tool_schema():
    assert mod.TOOL_SCHEMA["name"] == "skill_linux_ssh_auth_audit"

def test_unknown_action():
    result = mod.execute(action="unknown_action")
    assert result == {"ok": False, "error": "Unknown action: unknown_action"}

def test_parse_auth_log_failures(tmp_path):
    auth_log_path = tmp_path / "auth.log"
    auth_log_path.write_text("""
    Jan  1 00:00:00 host sshd[1234]: Failed password for invalid user admin from 192.168.1.1 port 1234 ssh2
    Jan  1 00:01:00 host sshd[1235]: Failed password for invalid user admin from 192.168.1.1 port 1235 ssh2
    Jan  1 00:02:00 host sshd[1236]: Failed password for invalid user admin from 192.168.1.1 port 1236 ssh2
    Jan  1 00:03:00 host sshd[1237]: Failed password for invalid user admin from 192.168.1.1 port 1237 ssh2
    Jan  1 00:04:00 host sshd[1238]: Failed password for invalid user admin from 192.168.1.1 port 1238 ssh2
    Jan  1 00:05:00 host sshd[1239]: Failed password for invalid user admin from 192.168.1.2 port 1239 ssh2
    """)
    with auth_log_path.open('r') as f:
        lines = f.readlines()
    result = mod.parse_auth_log_failures(lines, threshold=5)
    assert result == {"ok": True, "brute_force_ips": ["192.168.1.1"]}

def test_audit_sshd_config():
    config_text = """
    # Package generated configuration file
    # See the sshd_config(5) manpage for details

    # What ports, IPs and protocols we listen for
    Port 22

    # Use these options to restrict which interfaces/protocols sshd will bind to
    #ListenAddress ::
    #ListenAddress 0.0.0.0
    Protocol 2

    # HostKeys for protocol version 2
    HostKey /etc/ssh/ssh_host_rsa_key
    HostKey /etc/ssh/ssh_host_dsa_key
    HostKey /etc/ssh/ssh_host_ecdsa_key
    HostKey /etc/ssh/ssh_host_ed25519_key

    # To disable tunneled clear text passwords, change to no here!
    PasswordAuthentication yes

    #PermitRootLogin prohibit-password
    PermitRootLogin yes
    """
    result = mod.audit_sshd_config(config_text)
    assert result == {"ok": True, "issues": [
        "PermitRootLogin should be no, but found yes",
        "PasswordAuthentication should be no, but found yes"
    ]}

def test_list_authorized_keys(tmp_path, monkeypatch):
    auth_keys_path = tmp_path / "authorized_keys"
    auth_keys_path.write_text("""
    ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQC6eNtGpNGwstc.... user1@example.com
    ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQC6eNtGpNGwstc.... user2@example.com
    """)
    monkeypatch.setattr(mod.Path, "expanduser", lambda x: auth_keys_path)
    result = mod.list_authorized_keys(auth_keys_path=str(auth_keys_path))
    assert result == {"ok": True, "authorized_keys": [
        "ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQC6eNtGpNGwstc.... user1@example.com",
        "ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQC6eNtGpNGwstc.... user2@example.com"
    ]}
