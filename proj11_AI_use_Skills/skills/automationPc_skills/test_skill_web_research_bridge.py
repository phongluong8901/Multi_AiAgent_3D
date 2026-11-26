import pytest
from unittest.mock import MagicMock
from skill_web_research_bridge import execute, TOOL_SCHEMA, _fetch_raw

def test_tool_schema():
    assert isinstance(TOOL_SCHEMA, dict)
    assert TOOL_SCHEMA["name"] == "skill_web_research_bridge"
    assert "parameters" in TOOL_SCHEMA

def test_unknown_action():
    result = execute(action="unknown_action")
    assert result == {"ok": False, "error": "Unknown action"}

def test_search_news_rss(monkeypatch):
    mock_rss_content = b"""<rss><channel><item><title>Title 1</title><link>http://example.com/1</link></item><item><title>Title 2</title><link>http://example.com/2</link></item></channel></rss>"""
    monkeypatch.setattr("skill_web_research_bridge._fetch_raw", MagicMock(return_value=mock_rss_content.decode('utf-8')))  # Decode bytes to str
    result = execute(action="search_news_rss", query="test", limit=2)
    assert result == [{"title": "Title 1", "link": "http://example.com/1"}, {"title": "Title 2", "link": "http://example.com/2"}]

def test_extract_clean_text():
    html_content = "<html><body><p>This is a test.</p></body></html>"
    result = execute(action="extract_clean_text", html=html_content, max_chars=100)
    assert result == "This is a test."

def test_fetch_page_summary(monkeypatch):
    mock_html_content = b"<html><body><p>This is a test page.</p></body></html>"
    monkeypatch.setattr("skill_web_research_bridge._fetch_raw", MagicMock(return_value=mock_html_content.decode('utf-8')))  # Decode bytes to str
    result = execute(action="fetch_page_summary", url="http://example.com", max_chars=100)
    assert result == "This is a test page."
