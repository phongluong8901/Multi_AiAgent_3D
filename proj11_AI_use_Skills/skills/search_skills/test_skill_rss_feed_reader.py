import pytest
from unittest.mock import patch, MagicMock
from skill_rss_feed_reader import RSSFeedReaderClient

@patch("httpx.get")
def test_get_latest_articles_happy_path(mock_get):
    mock_response = MagicMock()
    mock_get.return_value = mock_response
    mock_response.status_code = 200
    mock_response.content = b"""<?xml version="1.0"?>
<rss>
    <channel>
        <item>
            <title>Article 1</title>
            <link>http://example.com/1</link>
            <author>Author 1</author>
            <pubDate>Sun, 01 Jan 2023 00:00:00 GMT</pubDate>
        </item>
        <item>
            <title>Article 2</title>
            <link>http://example.com/2</link>
            <author>Author 2</author>
            <pubDate>Mon, 02 Jan 2023 00:00:00 GMT</pubDate>
        </item>
    </channel>
</rss>"""
    client = RSSFeedReaderClient("http://example.com")
    articles = client.get_latest_articles(limit=2)
    assert len(articles) == 2
    assert all("title" in article for article in articles)
    assert all("link" in article for article in articles)
    assert all("author" in article for article in articles)
    assert all("published_time" in article for article in articles)

@patch("httpx.get")
def test_get_latest_articles_http_error(mock_get):
    mock_response = MagicMock()
    mock_get.return_value = mock_response
    mock_response.status_code = 404
    client = RSSFeedReaderClient("http://example.com")
    with pytest.raises(RuntimeError):
        client.get_latest_articles()

@patch("httpx.get")
def test_get_latest_articles_empty_data(mock_get):
    mock_response = MagicMock()
    mock_get.return_value = mock_response
    mock_response.status_code = 200
    mock_response.content = b"""<?xml version="1.0"?>
<rss>
    <channel>
        <!-- No items here -->
    </channel>
</rss>"""
    client = RSSFeedReaderClient("http://example.com")
    articles = client.get_latest_articles()
    assert len(articles) == 0