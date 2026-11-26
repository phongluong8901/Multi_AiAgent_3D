import pytest
from unittest.mock import MagicMock, patch

from skill_zingmp3_crawler import ZingMP3Crawler


@pytest.fixture
def crawler():
    return ZingMP3Crawler(timeout=5)


def test_get_zing_chart_from_xhr_api(crawler):
    fake_api_payload = {
        "data": {
            "RTChart": {
                "items": [
                    {
                        "title": "Mất Kết Nối",
                        "artistsNames": "Dương Domic",
                        "duration": 215,
                        "link": "/bai-hat/Mat-Ket-Noi/Z123.html",
                    },
                    {
                        "title": "Bắc Bling",
                        "artists": [{"name": "Hòa Minzy"}, {"name": "NSƯT Xuân Hinh"}],
                        "duration": 240,
                        "link": "/bai-hat/Bac-Bling/Z456.html",
                    },
                ]
            }
        }
    }

    mock_page = MagicMock()
    callbacks = []
    mock_page.on.side_effect = lambda event, fn: callbacks.append(fn) if event == "response" else None

    def fake_goto(*args, **kwargs):
        resp = MagicMock()
        resp.url = "https://zingmp3.vn/api/v2/page/get/chart-home?ctime=123"
        resp.json.return_value = fake_api_payload
        for cb in callbacks:
            cb(resp)

    mock_page.goto.side_effect = fake_goto
    mock_ctx = MagicMock()
    mock_ctx.new_page.return_value = mock_page
    mock_browser = MagicMock()
    mock_browser.new_context.return_value = mock_ctx
    mock_pw = MagicMock()
    mock_pw.chromium.launch.return_value = mock_browser

    cm = MagicMock()
    cm.__enter__.return_value = mock_pw
    cm.__exit__.return_value = False

    with patch("playwright.sync_api.sync_playwright", return_value=cm):
        songs = crawler.get_zing_chart(limit=10)
        assert len(songs) == 2
        assert songs[0]["rank"] == 1
        assert songs[0]["title"] == "Mất Kết Nối"
        assert songs[0]["artists"] == "Dương Domic"
        assert songs[0]["url"] == "https://zingmp3.vn/bai-hat/Mat-Ket-Noi/Z123.html"
        assert songs[1]["artists"] == "Hòa Minzy, NSƯT Xuân Hinh"


def test_get_zing_chart_raises_when_empty(crawler):
    mock_page = MagicMock()
    mock_page.content.return_value = "<html><body><div id='root'></div></body></html>"
    mock_ctx = MagicMock()
    mock_ctx.new_page.return_value = mock_page
    mock_browser = MagicMock()
    mock_browser.new_context.return_value = mock_ctx
    mock_pw = MagicMock()
    mock_pw.chromium.launch.return_value = mock_browser

    cm = MagicMock()
    cm.__enter__.return_value = mock_pw
    cm.__exit__.return_value = False

    with patch("playwright.sync_api.sync_playwright", return_value=cm):
        with pytest.raises(RuntimeError, match="Khong the trich xuat"):
            crawler.get_zing_chart()
