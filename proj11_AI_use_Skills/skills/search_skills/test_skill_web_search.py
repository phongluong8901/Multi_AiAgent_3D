from unittest.mock import MagicMock, patch
import pytest
from skill_web_search import WebSearchClient


def test_search_ddg_happy_path():
    fake_html = '''
    <div class="result">
      <a class="result__a" href="https://duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.org%2Fai">AI News</a>
      <a class="result__snippet">Latest breakthrough in AI agents.</a>
    </div>
    '''
    mock_resp = MagicMock(status_code=200, text=fake_html)
    with patch("httpx.get", return_value=mock_resp):
        client = WebSearchClient()
        res = client.search("AI agents", max_results=3)
        assert len(res) == 1
        assert res[0]["title"] == "AI News"
        assert res[0]["url"] == "https://example.org/ai"
        assert "breakthrough" in res[0]["snippet"]


def test_search_fallback_to_rss():
    ddg_fail = MagicMock(status_code=403, text="Forbidden")
    rss_xml = '''<?xml version="1.0" encoding="UTF-8"?>
    <rss><channel><item>
      <title>RSS Headline</title>
      <link>https://news.example.org/1</link>
      <pubDate>Wed, 25 Nov 2026 03:00:00 GMT</pubDate>
      <description>Short summary</description>
    </item></channel></rss>'''
    rss_ok = MagicMock(status_code=200, text=rss_xml)
    with patch("httpx.get", side_effect=[ddg_fail, rss_ok]), patch.object(
        WebSearchClient, "_search_ddgs_pkg", return_value=[]
    ):
        client = WebSearchClient()
        res = client.search("AI", max_results=2)
        assert len(res) == 1
        assert res[0]["source"] == "google_news_rss"
        assert res[0]["title"] == "RSS Headline"


def test_search_all_backends_error():
    fail_resp = MagicMock(status_code=500, text="Server Error")
    with patch("httpx.get", return_value=fail_resp), patch.object(
        WebSearchClient, "_search_ddgs_pkg", side_effect=RuntimeError("DDGS blocked")
    ):
        client = WebSearchClient()
        with pytest.raises(Exception):
            client.search("AI")


def test_search_invalid_query():
    client = WebSearchClient()
    with pytest.raises(ValueError):
        client.search("   ")
