from unittest.mock import MagicMock, patch
import pytest
from skill_web_reader import WebReaderClient


def test_read_url_happy_path():
    html_doc = """
    <html>
      <head><title>Test Page</title><style>body{color:red}</style></head>
      <body>
        <nav>Menu</nav>
        <main><h1>Hello World</h1><p>Main article content here.</p></main>
        <script>console.log("noise")</script>
      </body>
    </html>
    """
    mock_resp = MagicMock(status_code=200, text=html_doc, url="https://example.org/final")
    with patch("httpx.get", return_value=mock_resp):
        reader = WebReaderClient()
        res = reader.read_url("https://example.org/start", max_chars=500)
        assert res["title"] == "Test Page"
        assert "Main article content here." in res["text"]
        assert "console.log" not in res["text"]
        assert "Menu" not in res["text"]


def test_read_url_http_error():
    mock_resp = MagicMock(status_code=404, text="Not Found", url="https://example.org/404")
    with patch("httpx.get", return_value=mock_resp):
        reader = WebReaderClient()
        with pytest.raises(Exception):
            reader.read_url("https://example.org/404")


def test_read_url_invalid_url():
    reader = WebReaderClient()
    with pytest.raises(Exception):
        reader.read_url("ftp://invalid-scheme")
