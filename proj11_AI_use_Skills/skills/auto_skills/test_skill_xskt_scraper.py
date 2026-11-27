import pytest
from unittest.mock import MagicMock, patch
import httpx

from skill_xskt_scraper import XSKTScraperClient

SAMPLE_RSS = """<?xml version="1.0" encoding="utf-8"?>
<rss version="2.0">
  <channel>
    <title>Ket qua xo so Mien Bac</title>
    <item>
      <title>KẾT QUẢ XỔ SỐ MIỀN BẮC NGÀY 25/11 (Thứ Tư)</title>
      <description>ĐB: 12345 - G1: 67890 - G2: 11111, 22222</description>
      <link>https://xskt.com.vn/xsmb/ngay-25-11-2026</link>
      <pubDate>Wed, 25 Nov 2026 18:30:00 +0700</pubDate>
    </item>
    <item>
      <title>KẾT QUẢ XỔ SỐ MIỀN BẮC NGÀY 24/11 (Thứ Ba)</title>
      <description>ĐB: 54321 - G1: 09876</description>
      <link>https://xskt.com.vn/xsmb/ngay-24-11-2026</link>
      <pubDate>Tue, 24 Nov 2026 18:30:00 +0700</pubDate>
    </item>
  </channel>
</rss>
"""


def test_get_xskt_results_latest_and_date_match():
    mock_resp = MagicMock()
    mock_resp.text = SAMPLE_RSS
    mock_resp.raise_for_status.return_value = None

    client = XSKTScraperClient()
    with patch("httpx.Client.get", return_value=mock_resp):
        res = client.get_xskt_results(region="mien-bac", date="2026-11-25")
        assert res["region"] == "mien_bac"
        assert res["exact_date_matched"] is True
        assert "12345" in res["details"]
        assert res["url"].startswith("https://xskt.com.vn/")


def test_get_xskt_results_invalid_region():
    client = XSKTScraperClient()
    with pytest.raises(ValueError):
        client.get_xskt_results(region="invalid_region")


def test_get_xskt_results_http_error():
    client = XSKTScraperClient()
    with patch("httpx.Client.get", side_effect=httpx.HTTPError("timeout")):
        with pytest.raises(RuntimeError, match="Loi ket noi RSS"):
            client.get_xskt_results(region="mien_bac")
