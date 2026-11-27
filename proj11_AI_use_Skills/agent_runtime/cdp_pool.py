"""Thread-safe Persistent Playwright CDP Browser Pool (eliminates 3-5s reconnect overhead per tool call).

Playwright's sync_api is thread-affine (greenlet-bound), so all CDP operations execute on a dedicated
single-worker ThreadPoolExecutor that owns one persistent sync_playwright() + Browser connection.
If Chrome restarts or disconnects, the pool transparently reconnects on the next call.
"""
from __future__ import annotations

import atexit
from concurrent.futures import ThreadPoolExecutor
from typing import Any, Callable, TypeVar

T = TypeVar("T")


class CDPBrowserPool:
    """Keeps a warm Playwright CDP connection alive across tool calls on a dedicated worker thread."""

    def __init__(self) -> None:
        self._executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix="cdp_pool")
        self._pw: Any = None
        self._browser: Any = None
        self._cdp_url: str = ""
        atexit.register(self.close)

    def _connect_locked(self, cdp_url: str, timeout_ms: int = 8000) -> Any:
        url = (cdp_url or "http://127.0.0.1:9222").rstrip("/")
        if self._browser is not None and self._cdp_url == url:
            try:
                if self._browser.is_connected():
                    # Lightweight sanity check that context is still alive
                    _ = self._browser.contexts
                    return self._browser
            except Exception:
                self._reset_locked()

        self._reset_locked()
        from playwright.sync_api import sync_playwright

        self._pw = sync_playwright().start()
        self._browser = self._pw.chromium.connect_over_cdp(url, timeout=timeout_ms)
        self._cdp_url = url
        return self._browser

    def _reset_locked(self) -> None:
        if self._browser is not None:
            try:
                self._browser.close()
            except Exception:
                pass
            self._browser = None
        if self._pw is not None:
            try:
                self._pw.stop()
            except Exception:
                pass
            self._pw = None
        self._cdp_url = ""

    def run(
        self,
        cdp_url: str,
        fn: Callable[[Any, Any], T],
        *,
        timeout_ms: int = 8000,
        retry_once: bool = True,
    ) -> T:
        """Execute `fn(browser, context)` on the persistent CDP worker thread with auto-reconnect."""

        def _task() -> T:
            try:
                browser = self._connect_locked(cdp_url, timeout_ms=timeout_ms)
                context = browser.contexts[0] if browser.contexts else browser.new_context()
                return fn(browser, context)
            except Exception:
                if not retry_once:
                    raise
                self._reset_locked()
                browser = self._connect_locked(cdp_url, timeout_ms=timeout_ms)
                context = browser.contexts[0] if browser.contexts else browser.new_context()
                return fn(browser, context)

        return self._executor.submit(_task).result()

    def fetch_live_html(
        self,
        url: str,
        cdp_url: str = "http://127.0.0.1:9222",
        wait_sec: float = 2.0,
    ) -> dict[str, Any]:
        """Helper for web scraper/auditor skills to grab live rendered HTML from the warm CDP pool."""
        import time as _time

        def _op(browser: Any, context: Any) -> dict[str, Any]:
            target_host = url.split("//", 1)[-1].split("/", 1)[0].lower()
            page = None
            for existing in context.pages:
                if target_host and target_host in (existing.url or "").lower():
                    page = existing
                    break
            created = False
            if page is None:
                page = context.new_page()
                created = True
                page.goto(url, wait_until="domcontentloaded", timeout=25000)
            elif url and not (page.url or "").startswith(url.split("#")[0]):
                page.goto(url, wait_until="domcontentloaded", timeout=25000)
            _time.sleep(max(0.3, min(float(wait_sec or 2.0), 8.0)))
            html = page.content()
            title = page.title() or ""
            cur_url = page.url or url
            if created:
                try:
                    page.close()
                except Exception:
                    pass
            return {"ok": True, "url": cur_url, "title": title, "html": html}

        return self.run(cdp_url, _op)

    def close(self) -> None:
        try:
            self._executor.submit(self._reset_locked).result(timeout=3.0)
        except Exception:
            pass


_GLOBAL_CDP_POOL: CDPBrowserPool | None = None


def get_cdp_pool() -> CDPBrowserPool:
    global _GLOBAL_CDP_POOL
    if _GLOBAL_CDP_POOL is None:
        _GLOBAL_CDP_POOL = CDPBrowserPool()
    return _GLOBAL_CDP_POOL
