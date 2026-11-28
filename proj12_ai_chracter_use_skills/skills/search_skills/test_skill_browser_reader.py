from unittest.mock import MagicMock, patch
import pytest
from skill_browser_reader import BrowserReaderClient


def _mock_playwright(status=200, title="Dynamic App", eval_result=None):
    mock_page = MagicMock()
    mock_page.goto.return_value = MagicMock(status=status)
    mock_page.title.return_value = title
    mock_page.url = "https://example.org/app"
    mock_page.evaluate.return_value = (
        eval_result
        if eval_result is not None
        else {"text": "Rendered JS content", "links": [{"text": "Docs", "href": "https://example.org/docs"}]}
    )

    mock_context = MagicMock()
    mock_context.new_page.return_value = mock_page

    mock_browser = MagicMock()
    mock_browser.new_context.return_value = mock_context

    mock_p = MagicMock()
    mock_p.chromium.launch.return_value = mock_browser

    mock_cm = MagicMock()
    mock_cm.__enter__.return_value = mock_p
    mock_cm.__exit__.return_value = None
    return mock_cm


def test_read_dynamic_page_happy_path():
    with patch("skill_browser_reader.sync_playwright", return_value=_mock_playwright()):
        client = BrowserReaderClient()
        res = client.read_dynamic_page("https://example.org/app", wait_ms=0)
        assert res["title"] == "Dynamic App"
        assert "Rendered JS content" in res["text"]
        assert len(res["links"]) == 1


def test_read_dynamic_page_http_error():
    with patch("skill_browser_reader.sync_playwright", return_value=_mock_playwright(status=403)):
        client = BrowserReaderClient()
        with pytest.raises(Exception):
            client.read_dynamic_page("https://example.org/blocked", wait_ms=0)


def test_read_dynamic_page_invalid_url():
    client = BrowserReaderClient()
    with pytest.raises(Exception):
        client.read_dynamic_page("not-a-url")
