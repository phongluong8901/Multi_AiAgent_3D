import pytest
import skill_linux_nginx_proxy_helper as mod
from unittest.mock import MagicMock

def test_tool_schema():
    assert mod.TOOL_SCHEMA["name"] == "skill_linux_nginx_proxy_helper"

def test_parse_nginx_server_blocks():
    config_text = """
    server {
        listen 80;
        server_name example.com;
        proxy_pass http://127.0.0.1:8000;
    }
    server {
        listen 8080;
        server_name test.com;
        proxy_pass http://127.0.0.1:8080;
    }
    """
    result = mod.parse_nginx_server_blocks(config_text)
    assert len(result) == 2
    assert result[0] == {'server_name': 'example.com', 'listen': '80', 'proxy_pass': 'http://127.0.0.1:8000'}
    assert result[1] == {'server_name': 'test.com', 'listen': '8080', 'proxy_pass': 'http://127.0.0.1:8080'}

def test_generate_reverse_proxy_conf(tmp_path, monkeypatch):
    monkeypatch.setattr(mod, "_run_cmd", MagicMock(return_value=(0, "", "")))
    domain = "test.com"
    upstream = "http://127.0.0.1:8000"
    result = mod.generate_reverse_proxy_conf(domain, upstream, dry_run=False)
    assert result["ok"] is True
    config_path = tmp_path / f"{domain}"
    with open(config_path, "w") as f:
        f.write(result["config"])
    with open(config_path, "r") as f:
        config_content = f.read()
    assert "proxy_pass http://127.0.0.1:8000;" in config_content

def test_check_tls_expiry(monkeypatch):
    mock_ssock = MagicMock()
    mock_ssock.__enter__.return_value = mock_ssock
    mock_ssock.getpeercert.return_value = {"notAfter": "Dec 31 23:59:59 2030 GMT"}

    mock_ctx = MagicMock()
    mock_ctx.wrap_socket.return_value = mock_ssock

    mock_sock = MagicMock()
    mock_sock.__enter__.return_value = mock_sock

    monkeypatch.setattr(mod.ssl, "create_default_context", lambda: mock_ctx)
    monkeypatch.setattr(mod.socket, "create_connection", lambda *a, **kw: mock_sock)
    result = mod.check_tls_expiry("example.com")
    assert result["ok"] is True
    assert "expiry_date" in result

def test_unknown_action():
    result = mod.execute("unknown_action")
    assert result["ok"] is False
    assert "Unknown action" in result["error"]
