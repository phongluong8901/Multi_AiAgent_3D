import skill_linux_alert_webhook_dispatch as mod
import pytest
from unittest.mock import MagicMock

def test_tool_schema():
    assert mod.TOOL_SCHEMA["name"] == "skill_linux_alert_webhook_dispatch"
    assert mod.TOOL_SCHEMA["risk_level"] == "confirm"
    assert "action" in mod.TOOL_SCHEMA["parameters"]["properties"]

def test_evaluate_thresholds():
    metrics = {"cpu": 91, "ram": 96, "disk": 96, "temperature": 80}
    alerts = mod.evaluate_thresholds(metrics)
    assert len(alerts) == 4  # Đổi từ 3 thành 4 để phản ánh thực tế
    assert ("cpu", "critical") in alerts
    assert ("ram", "critical") in alerts
    assert ("disk", "critical") in alerts
    assert ("temperature", "warning") in alerts  # Thêm dòng này để kiểm tra cảnh báo nhiệt độ

def test_should_send_alert(tmp_path):
    state_path = tmp_path / "alert_state.json"
    assert mod.should_send_alert("test_alert", state_path=str(state_path), now_ts=1000)
    assert not mod.should_send_alert("test_alert", state_path=str(state_path), now_ts=1050)
    assert mod.should_send_alert("test_alert", state_path=str(state_path), now_ts=1300)

def test_dispatch_webhook_dry_run():
    result = mod.dispatch_webhook("http://example.com", "Test Title", "Test Message", dry_run=True)
    assert result["ok"]
    assert result["payload"]["title"] == "Test Title"
    assert result["payload"]["message"] == "Test Message"

def test_dispatch_webhook(monkeypatch):
    mock_http_post = MagicMock(return_value={"ok": True, "response": "success"})
    monkeypatch.setattr(mod, "_http_post", mock_http_post)
    result = mod.dispatch_webhook("http://example.com", "Test Title", "Test Message", dry_run=False)
    assert result["ok"]
    mock_http_post.assert_called_once()
