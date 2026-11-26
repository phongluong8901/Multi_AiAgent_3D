import pytest
from unittest.mock import patch, MagicMock
import httpx
from skill_xskt_scraper import XSKTScraperClient

@pytest.fixture
def scraper() -> XSKTScraperClient:
    return XSKTScraperClient()

def test_init_default(scraper: XSKTScraperClient) -> None:
    assert scraper.timeout == 10.0
    assert "User-Agent" in scraper.headers

def test_get_xskt_invalid_region(scraper: XSKTScraperClient) -> None:
    with pytest.raises(ValueError, match="Region phai la mot trong cac gia tri"):
        scraper.get_xskt_results(region="mien_tay")

@patch("httpx.Client")
def test_get_xskt_success_rss(mock_httpx_client: MagicMock, scraper: XSKTScraperClient) -> None:
    rss_xml = """<?xml version="1.0" encoding="UTF-8"?>
    <rss version="2.0">
        <channel>
            <title>XSKT Mien Bac</title>
            <item>
                <title>XSMB 25-11-2026</title>
                <pubDate>Wed, 25 Nov 2026 18:00:00 +0700</pubDate>
                <description>&lt;table&gt;&lt;tr&gt;&lt;td&gt;Đặc biệt&lt;/td&gt;&lt;td&gt;123456&lt;/td&gt;&lt;/tr&gt;&lt;/table&gt;</description>
            </item>
        </channel>
    </rss>
    """
    mock_response = MagicMock()
    mock_response.text = rss_xml
    mock_response.status_code = 200
    
    mock_instance = mock_httpx_client.return_value.__enter__.return_value
    mock_instance.get.return_value = mock_response

    result = scraper.get_xskt_results(region="mien_bac", date="25-11-2026")
    
    assert result["region"] == "mien_bac"
    assert result["date"] == "25-11-2026"
    assert "Đặc biệt" in result["prizes"]
    assert result["prizes"]["Đặc biệt"] == ["123456"]

@patch("httpx.Client")
def test_get_xskt_http_error(mock_httpx_client: MagicMock, scraper: XSKTScraperClient) -> None:
    mock_instance = mock_httpx_client.return_value.__enter__.return_value
    mock_instance.get.side_effect = httpx.HTTPError("Timeout")

    with pytest.raises(RuntimeError, match="Khong the ket noi den RSS feed"):
        scraper.get_xskt_results(region="mien_nam")

@patch("httpx.Client")
def test_get_xskt_invalid_xml(mock_httpx_client: MagicMock, scraper: XSKTScraperClient) -> None:
    mock_response = MagicMock()
    mock_response.text = "Not XML Content"
    mock_response.status_code = 200
    
    mock_instance = mock_httpx_client.return_value.__enter__.return_value
    mock_instance.get.return_value = mock_response

    with pytest.raises(RuntimeError, match="Loi parse du lieu XML"):
        scraper.get_xskt_results(region="mien_trung")

@patch("httpx.Client")
def test_get_xskt_no_channel(mock_httpx_client: MagicMock, scraper: XSKTScraperClient) -> None:
    mock_response = MagicMock()
    mock_response.text = "<root></root>"
    mock_response.status_code = 200
    
    mock_instance = mock_httpx_client.return_value.__enter__.return_value
    mock_instance.get.return_value = mock_response

    with pytest.raises(RuntimeError, match="RSS feed khong hop le: thieu the channel"):
        scraper.get_xskt_results(region="mien_bac")
