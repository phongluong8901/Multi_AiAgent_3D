"""4-Tier Stealth Fetcher: curl_cffi TLS impersonation -> httpx -> Playwright XHR -> Wayback Archive."""
import time
from typing import Any
from urllib.parse import quote, urlparse
import httpx


class StealthFetcher:
    """Fetch web pages resiliently using a 4-tier anti-bot fallback cascade."""

    DEFAULT_HEADERS = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
        ),
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7",
    }

    def __init__(self, timeout: float = 18.0):
        self.timeout = timeout

    @staticmethod
    def is_valid_url(url: str) -> bool:
        try:
            p = urlparse((url or "").strip())
            return p.scheme in ("http", "https") and bool(p.netloc)
        except Exception:
            return False

    @staticmethod
    def build_wayback_url(url: str) -> str:
        return f"https://archive.org/wayback/available?url={quote(url, safe='')}"

    @staticmethod
    def _looks_blocked(status_code: int, html: str) -> bool:
        if status_code in (401, 403, 429, 503):
            return True
        head = (html or "")[:2500].lower()
        return any(sig in head for sig in ("just a moment...", "cf-browser-verification", "captcha", "access denied"))

    def _fetch_curl_cffi(self, url: str) -> dict[str, Any]:
        from curl_cffi import requests as curl_requests  # type: ignore
        r = curl_requests.get(url, impersonate="chrome120", headers=self.DEFAULT_HEADERS, timeout=self.timeout, allow_redirects=True)
        return {"status_code": r.status_code, "final_url": str(r.url), "html": r.text, "method": "curl_cffi"}

    def _fetch_httpx(self, url: str) -> dict[str, Any]:
        with httpx.Client(headers=self.DEFAULT_HEADERS, follow_redirects=True, timeout=self.timeout) as client:
            r = client.get(url)
            return {"status_code": r.status_code, "final_url": str(r.url), "html": r.text, "method": "httpx"}

    def _fetch_playwright(self, url: str) -> dict[str, Any]:
        from playwright.sync_api import sync_playwright  # type: ignore
        xhr_json: list[dict[str, Any]] = []
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True, args=["--disable-blink-features=AutomationControlled"])
            context = browser.new_context(user_agent=self.DEFAULT_HEADERS["User-Agent"], locale="vi-VN")
            context.add_init_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined});")
            page = context.new_page()

            def on_response(resp):
                try:
                    ct = resp.headers.get("content-type", "")
                    if "application/json" in ct and resp.status == 200 and len(xhr_json) < 8:
                        body = resp.json()
                        xhr_json.append({"url": resp.url, "data": body})
                except Exception:
                    pass

            page.on("response", on_response)
            resp = page.goto(url, wait_until="domcontentloaded", timeout=int(self.timeout * 1000))
            page.wait_for_timeout(1200)
            html = page.content()
            final_url = page.url
            status = resp.status if resp else 200
            browser.close()
        return {"status_code": status, "final_url": final_url, "html": html, "method": "playwright_stealth", "xhr_json": xhr_json}

    def _fetch_wayback(self, url: str) -> dict[str, Any]:
        with httpx.Client(headers=self.DEFAULT_HEADERS, follow_redirects=True, timeout=self.timeout) as client:
            meta = client.get(self.build_wayback_url(url)).json()
            snap = (meta.get("archived_snapshots") or {}).get("closest") or {}
            snap_url = snap.get("url")
            if not snap_url:
                raise ValueError("No Wayback snapshot available")
            r = client.get(snap_url)
            return {"status_code": r.status_code, "final_url": snap_url, "html": r.text, "method": "wayback_archive"}

    def fetch(self, url: str, allow_browser: bool = True, allow_archive: bool = True) -> dict[str, Any]:
        if not self.is_valid_url(url):
            return {"ok": False, "status_code": 0, "final_url": url, "html": "", "method": "none", "xhr_json": [], "error": "Invalid URL"}

        tiers = [("curl_cffi", self._fetch_curl_cffi), ("httpx", self._fetch_httpx)]
        if allow_browser:
            tiers.append(("playwright_stealth", self._fetch_playwright))
        if allow_archive:
            tiers.append(("wayback_archive", self._fetch_wayback))

        errors: list[str] = []
        last_res: dict[str, Any] = {}
        t0 = time.perf_counter()

        for name, fn in tiers:
            try:
                res = fn(url)
                last_res = res
                html = res.get("html") or ""
                status = int(res.get("status_code") or 0)
                if 200 <= status < 400 and len(html.strip()) >= 80 and not self._looks_blocked(status, html):
                    return {
                        "ok": True,
                        "status_code": status,
                        "final_url": res.get("final_url", url),
                        "html": html,
                        "method": res.get("method", name),
                        "xhr_json": res.get("xhr_json", []),
                        "elapsed_s": round(time.perf_counter() - t0, 2),
                        "error": "",
                    }
                errors.append(f"{name}: status={status}, len={len(html)}")
            except Exception as e:
                errors.append(f"{name}: {type(e).__name__}: {str(e)[:120]}")

        return {
            "ok": False,
            "status_code": int(last_res.get("status_code") or 0),
            "final_url": last_res.get("final_url", url),
            "html": last_res.get("html", ""),
            "method": last_res.get("method", "failed"),
            "xhr_json": last_res.get("xhr_json", []),
            "elapsed_s": round(time.perf_counter() - t0, 2),
            "error": " | ".join(errors),
        }
