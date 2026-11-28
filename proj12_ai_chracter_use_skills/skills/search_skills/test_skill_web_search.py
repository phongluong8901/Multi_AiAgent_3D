from unittest.mock import MagicMock, patch
import pytest

from skill_web_search import WebSearchClient


def test_search_bing_html_happy_path():
    fake_bing = """
    <ol id="b_results">
      <li class="b_algo">
        <h2><a href="https://shopee.vn/luckfox-pico-sc3336">Camera SC3336 Luckfox Pico Shopee</a></h2>
        <p>Cam bien 3MP chinh hang cho Luckfox Pico RV1103.</p>
      </li>
    </ol>
    """
    mock_resp = MagicMock(status_code=200, text=fake_bing)
    with patch.object(WebSearchClient, "_search_ddgs_pkg", return_value=[]), patch("httpx.get", return_value=mock_resp):
        client = WebSearchClient()
        res = client.search("Luckfox Pico SC3336 shopee", max_results=3)
        assert len(res) == 1
        assert res[0]["source"] == "bing_html"
        assert "shopee.vn" in res[0]["url"]


def test_decode_bing_redirect():
    import base64

    target = "https://shopee.vn/product/12345"
    b64 = base64.urlsafe_b64encode(target.encode()).decode().rstrip("=")
    wrapped = f"https://www.bing.com/ck/a?!&&u=a1{b64}&ntb=1"
    assert WebSearchClient._decode_bing_redirect(wrapped) == target


def test_search_fallback_to_rss():
    rss_xml = """<?xml version="1.0" encoding="UTF-8"?>
    <rss><channel><item>
      <title>RSS Headline</title>
      <link>https://news.example.org/1</link>
      <pubDate>Wed, 25 Nov 2026 03:00:00 GMT</pubDate>
      <description>Short summary</description>
    </item></channel></rss>"""
    fail_resp = MagicMock(status_code=202, text="Accepted")
    rss_ok = MagicMock(status_code=200, text=rss_xml)
    with patch.object(WebSearchClient, "_search_ddgs_pkg", return_value=[]), patch(
        "httpx.get", side_effect=[fail_resp, fail_resp, fail_resp, rss_ok]
    ):
        client = WebSearchClient()
        res = client.search("AI", max_results=2)
        assert len(res) == 1
        assert res[0]["source"] == "google_news_rss"
        assert res[0]["title"] == "RSS Headline"


def test_empty_query_raises():
    client = WebSearchClient()
    with pytest.raises(ValueError):
        client.search("   ")
