from unittest.mock import MagicMock, patch
import pytest

from skill_zalo_read_notifications import ZaloNotificationReader, _parse_toast_xml


def test_parse_toast_xml():
    xml_data = b"<toast><visual><binding><text>Nguyen Van A</text><text>Chieu nay hop 3h nhe</text></binding></visual></toast>"
    parsed = _parse_toast_xml(xml_data)
    assert parsed["sender"] == "Nguyen Van A"
    assert "hop 3h" in parsed["message"]


def test_priority_c1_zalo_web_cdp(tmp_path):
    reader = ZaloNotificationReader(output_dir=str(tmp_path))
    c1_ok = {"ok": True, "source": "c1_zalo_web_cdp_headless", "unread_count": 2, "unread_items": []}
    with patch.object(reader, "_try_c1_zalo_web_cdp", return_value=c1_ok), patch.object(
        reader, "_try_c2_windows_notifications"
    ) as m_c2:
        res = reader.get_unread_notifications()
        assert res["ok"] is True
        assert res["source"] == "c1_zalo_web_cdp_headless"
        m_c2.assert_not_called()


def test_priority_c2_windows_notifications_fallback(tmp_path):
    reader = ZaloNotificationReader(output_dir=str(tmp_path))
    c1_fail = {"ok": False, "login_required": True}
    c2_ok = {
        "ok": True,
        "source": "c2_windows_notification_center_silent",
        "unread_count": 1,
        "unread_items": [{"sender": "Dev Group", "message": "Deploy done"}],
    }
    with patch.object(reader, "_try_c1_zalo_web_cdp", return_value=c1_fail), patch.object(
        reader, "_try_c2_windows_notifications", return_value=c2_ok
    ), patch.object(reader, "_try_c3_zalo_desktop_vision") as m_c3:
        res = reader.get_unread_notifications()
        assert res["ok"] is True
        assert res["source"] == "c2_windows_notification_center_silent"
        assert len(res["fallback_trace"]) == 1
        m_c3.assert_not_called()


def test_priority_c3_desktop_vision_and_restore(tmp_path):
    reader = ZaloNotificationReader(output_dir=str(tmp_path))
    c1_fail = {"ok": False, "login_required": True}
    c2_fail = {"ok": False, "reason": "no_zalo_toast_in_action_center"}
    c3_ok = {
        "ok": True,
        "source": "c3_zalo_desktop_vision_restored",
        "restored_previous_state": True,
        "screenshot_path": str(tmp_path / "zalo_desktop_notifications.png"),
    }
    with patch.object(reader, "_try_c1_zalo_web_cdp", return_value=c1_fail), patch.object(
        reader, "_try_c2_windows_notifications", return_value=c2_fail
    ), patch.object(reader, "_try_c3_zalo_desktop_vision", return_value=c3_ok):
        res = reader.get_unread_notifications()
        assert res["ok"] is True
        assert res["source"] == "c3_zalo_desktop_vision_restored"
        assert res["restored_previous_state"] is True
        assert len(res["fallback_trace"]) == 2
