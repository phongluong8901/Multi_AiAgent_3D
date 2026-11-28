from unittest.mock import patch
from skill_zalo_friend_counter import ZaloFriendCounter


def test_friend_counter_web_cdp_success(tmp_path):
    fc = ZaloFriendCounter(output_dir=str(tmp_path))
    with patch.object(
        fc,
        "_try_zalo_web_cdp",
        return_value={"ok": True, "source": "zalo_web_cdp_headless", "total_friends": 248, "sample_friends": ["A"]},
    ):
        res = fc.count_and_get_friends()
        assert res["ok"] is True
        assert res["total_friends"] == 248


def test_friend_counter_desktop_fallback(tmp_path):
    fc = ZaloFriendCounter(output_dir=str(tmp_path))
    with patch.object(fc, "_try_zalo_web_cdp", return_value={"ok": False, "reason": "zalo_web_not_logged_in"}), patch.object(
        fc,
        "_try_zalo_desktop_app",
        return_value={
            "ok": True,
            "source": "zalo_desktop_app_vision",
            "screenshot_path": str(tmp_path / "zalo_desktop_friends.png"),
        },
    ):
        res = fc.count_and_get_friends()
        assert res["ok"] is True
        assert res["source"] == "zalo_desktop_app_vision"
