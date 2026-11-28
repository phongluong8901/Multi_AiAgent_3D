"""Zing MP3 #zingchart real-time crawler powered by Playwright headless browser."""
from __future__ import annotations

from typing import Any


class ZingMP3Crawler:
    """Crawler lay bang xep hang nhac truc tuyen #zingchart real-time tu Zing MP3."""

    def __init__(self, timeout: int = 20):
        self.timeout = timeout
        self.chart_url = "https://zingmp3.vn/zing-chart"

    @staticmethod
    def _parse_api_items(items: list[dict[str, Any]], limit: int) -> list[dict[str, Any]]:
        songs: list[dict[str, Any]] = []
        for idx, item in enumerate(items[:limit], 1):
            if not isinstance(item, dict):
                continue
            title = str(item.get("title") or "").strip()
            if not title:
                continue
            artists_names = str(item.get("artistsNames") or "").strip()
            if not artists_names:
                raw_artists = item.get("artists")
                if isinstance(raw_artists, list):
                    artists_names = ", ".join(
                        str(a.get("name") or "").strip()
                        for a in raw_artists
                        if isinstance(a, dict) and a.get("name")
                    )
                elif isinstance(raw_artists, str):
                    artists_names = raw_artists.strip()
            link = str(item.get("link") or "").strip()
            full_url = f"https://zingmp3.vn{link}" if link.startswith("/") else (link or "https://zingmp3.vn/zing-chart")
            songs.append(
                {
                    "rank": idx,
                    "title": title,
                    "artists": artists_names or "Unknown",
                    "duration": int(item.get("duration") or 0),
                    "url": full_url,
                }
            )
        return songs

    def get_zing_chart(self, limit: int = 20) -> list[dict[str, Any]]:
        """Lay danh sach Top bai hat tren bang xep hang #zingchart real-time cua Zing MP3.

        Args:
            limit: So luong bai hat toi da can lay (mac dinh 20, toi da 100).

        Returns:
            list[dict]: Danh sach bai hat gom rank, title, artists, duration, url.
        """
        try:
            from playwright.sync_api import sync_playwright
        except ImportError as exc:
            raise RuntimeError("Missing package 'playwright'. Install with: pip install playwright") from exc

        cap_limit = max(1, min(int(limit or 20), 100))
        captured_items: list[dict[str, Any]] = []
        rendered_html = ""

        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            try:
                context = browser.new_context(
                    user_agent=(
                        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
                    ),
                    locale="vi-VN",
                )
                page = context.new_page()

                def _on_response(response: Any) -> None:
                    if captured_items:
                        return
                    url_low = str(getattr(response, "url", "") or "").lower()
                    if "zingmp3.vn" in url_low and ("chart-home" in url_low or "chart" in url_low) and "/api/" in url_low:
                        try:
                            payload = response.json()
                            data = payload.get("data") if isinstance(payload, dict) else None
                            if isinstance(data, dict):
                                rt = data.get("RTChart") or data.get("rtChart") or {}
                                items = rt.get("items") if isinstance(rt, dict) else None
                                if not items:
                                    items = data.get("items")
                                if isinstance(items, list) and items:
                                    captured_items.extend(items)
                        except Exception:
                            pass

                page.on("response", _on_response)
                try:
                    page.goto(self.chart_url, timeout=self.timeout * 1000, wait_until="networkidle")
                except Exception:
                    # Even if networkidle times out on analytics scripts, XHR or DOM may already be ready
                    pass

                if not captured_items:
                    try:
                        page.wait_for_selector(".chart-song-item, .list-item, .song-item", timeout=4000)
                    except Exception:
                        pass
                    rendered_html = page.content()
            finally:
                browser.close()

        if captured_items:
            songs = self._parse_api_items(captured_items, cap_limit)
            if songs:
                return songs

        if rendered_html:
            from bs4 import BeautifulSoup

            soup = BeautifulSoup(rendered_html, "html.parser")
            dom_songs: list[dict[str, Any]] = []
            for row in soup.select(".chart-song-item, .list-item, .song-item"):
                t_el = row.select_one(".item-title, .song-title, .title, [class*='title']")
                a_el = row.select_one(".is-one-line.subtitle, .subtitle, .artists, [class*='artist']")
                title = t_el.get_text(" ", strip=True) if t_el else ""
                artists = a_el.get_text(" ", strip=True) if a_el else ""
                if title and len(dom_songs) < cap_limit:
                    dom_songs.append(
                        {
                            "rank": len(dom_songs) + 1,
                            "title": title,
                            "artists": artists or "Unknown",
                            "duration": 0,
                            "url": self.chart_url,
                        }
                    )
            if dom_songs:
                return dom_songs

        raise RuntimeError(
            "Khong the trich xuat du lieu bang xep hang #zingchart tu Zing MP3 (khong bat duoc API RTChart hay DOM)."
        )
