from skill_stealth_fetcher import StealthFetcher

def test_invalid_url():
    res = StealthFetcher().fetch("ftp://invalid-scheme")
    assert res["ok"] is False

def test_cascade_fallback_when_tier1_403(monkeypatch):
    f = StealthFetcher()
    monkeypatch.setattr(f, "_fetch_curl_cffi", lambda u: {"status_code": 403, "final_url": u, "html": "Access Denied", "method": "curl_cffi"})
    monkeypatch.setattr(f, "_fetch_httpx", lambda u: {"status_code": 200, "final_url": u, "html": "<html><body>" + "Valid content " * 20 + "</body></html>", "method": "httpx"})
    res = f.fetch("https://example.com", allow_browser=False, allow_archive=False)
    assert res["ok"] is True
    assert res["method"] == "httpx"

def test_wayback_url_builder():
    assert "archive.org/wayback/available" in StealthFetcher.build_wayback_url("https://example.com")
