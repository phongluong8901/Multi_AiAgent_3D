"""Headless Chromium browser client via Playwright for reading JS-heavy/SPA webpages."""
import re
from playwright.sync_api import sync_playwright


class BrowserReaderClient:
    """Render dynamic JavaScript webpages and extract clean text or CSS elements."""

    def __init__(self, timeout_ms: int = 30000):
        self.timeout_ms = timeout_ms
        self.user_agent = (
            "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
            "(KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"
        )
        self.launch_args = [
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage",
            "--disable-gpu",
        ]

    def read_dynamic_page(
        self,
        url: str,
        wait_selector: str | None = None,
        wait_ms: int = 2000,
        max_chars: int = 6000,
    ) -> dict:
        """Return dict keys: url, final_url, title, text, links."""
        if not url or not url.startswith(("http://", "https://")):
            raise ValueError(f"URL khong hop le: {url}")

        try:
            with sync_playwright() as p:
                browser = p.chromium.launch(headless=True, args=self.launch_args)
                try:
                    context = browser.new_context(
                        user_agent=self.user_agent,
                        viewport={"width": 1280, "height": 800},
                    )
                    page = context.new_page()
                    page.set_default_timeout(self.timeout_ms)
                    resp = page.goto(url, wait_until="domcontentloaded", timeout=self.timeout_ms)
                    if resp is not None and resp.status >= 400:
                        raise RuntimeError(f"HTTP {resp.status} khi mo {url}")

                    if wait_selector:
                        page.wait_for_selector(wait_selector, timeout=min(self.timeout_ms, 15000))
                    if wait_ms > 0:
                        page.wait_for_timeout(wait_ms)

                    title = (page.title() or "").strip()
                    final_url = page.url

                    data = page.evaluate(
                        """() => {
                            const clone = document.body ? document.body.cloneNode(true) : null;
                            if (!clone) return { text: "", links: [] };
                            clone.querySelectorAll("script, style, noscript, svg, iframe").forEach(el => el.remove());
                            const text = clone.innerText || "";
                            const links = [];
                            const seen = new Set();
                            for (const a of document.querySelectorAll("a[href]")) {
                                const href = a.href || "";
                                const label = (a.innerText || "").trim().replace(/\\s+/g, " ");
                                if (href.startsWith("http") && label && !seen.has(href)) {
                                    seen.add(href);
                                    links.push({ text: label.slice(0, 120), href });
                                    if (links.length >= 25) break;
                                }
                            }
                            return { text, links };
                        }"""
                    )
                finally:
                    browser.close()
        except Exception as e:
            raise RuntimeError(f"Playwright loi khi doc {url}: {e}") from e

        raw_text = data.get("text", "") if isinstance(data, dict) else ""
        clean_text = re.sub(r"[ \t]+", " ", raw_text)
        clean_text = re.sub(r"\n{3,}", "\n\n", clean_text).strip()
        if not clean_text:
            raise RuntimeError(f"Khong trich xuat duoc noi dung van ban tu {url}")

        return {
            "url": url,
            "final_url": final_url,
            "title": title,
            "text": clean_text[:max_chars],
            "links": data.get("links", []) if isinstance(data, dict) else [],
        }

    def extract_elements(
        self,
        url: str,
        css_selector: str,
        wait_ms: int = 2000,
        limit: int = 20,
    ) -> list[dict]:
        """Return list of dicts with keys: text, href."""
        if not url or not url.startswith(("http://", "https://")):
            raise ValueError(f"URL khong hop le: {url}")
        if not css_selector or not css_selector.strip():
            raise ValueError("css_selector khong duoc rong")

        try:
            with sync_playwright() as p:
                browser = p.chromium.launch(headless=True, args=self.launch_args)
                try:
                    context = browser.new_context(user_agent=self.user_agent)
                    page = context.new_page()
                    page.set_default_timeout(self.timeout_ms)
                    resp = page.goto(url, wait_until="domcontentloaded", timeout=self.timeout_ms)
                    if resp is not None and resp.status >= 400:
                        raise RuntimeError(f"HTTP {resp.status} khi mo {url}")
                    page.wait_for_selector(css_selector, timeout=min(self.timeout_ms, 15000))
                    if wait_ms > 0:
                        page.wait_for_timeout(wait_ms)

                    items = page.evaluate(
                        """([sel, maxItems]) => {
                            const out = [];
                            for (const el of document.querySelectorAll(sel)) {
                                const text = (el.innerText || "").trim().replace(/\\s+/g, " ");
                                const a = el.tagName === "A" ? el : el.querySelector("a[href]");
                                const href = a ? a.href : "";
                                if (text || href) {
                                    out.push({ text: text.slice(0, 300), href });
                                    if (out.length >= maxItems) break;
                                }
                            }
                            return out;
                        }""",
                        [css_selector, limit],
                    )
                finally:
                    browser.close()
        except Exception as e:
            raise RuntimeError(f"Playwright loi khi trich xuat `{css_selector}` tu {url}: {e}") from e

        if not items:
            raise RuntimeError(f"Khong tim thay phan tu nao khop selector `{css_selector}` tai {url}")
        return items
