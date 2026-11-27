"""Vietnam Lottery (XSKT) 3-region results client using official xskt.com.vn RSS feeds."""
from __future__ import annotations

import xml.etree.ElementTree as ET
from typing import Any

import httpx


class XSKTScraperClient:
    """Client lay ket qua xo so kien thiet 3 mien (Bac, Trung, Nam) tu RSS chinh thuc cua xskt.com.vn."""

    _RSS_URLS: dict[str, str] = {
        "mien_bac": "https://xskt.com.vn/rss-feed/mien-bac-xsmb.rss",
        "mien_trung": "https://xskt.com.vn/rss-feed/mien-trung-xsmt.rss",
        "mien_nam": "https://xskt.com.vn/rss-feed/mien-nam-xsmn.rss",
    }

    def __init__(self, timeout: float = 12.0) -> None:
        self.timeout = timeout
        self.headers = {
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
            ),
            "Accept": "application/rss+xml, application/xml, text/xml, */*",
        }

    @staticmethod
    def _normalize_region(region: str) -> str:
        clean = (region or "mien_bac").strip().lower().replace("-", "_").replace(" ", "_")
        aliases = {
            "mb": "mien_bac",
            "xsmb": "mien_bac",
            "bac": "mien_bac",
            "mien_bac": "mien_bac",
            "mt": "mien_trung",
            "xsmt": "mien_trung",
            "trung": "mien_trung",
            "mien_trung": "mien_trung",
            "mn": "mien_nam",
            "xsmn": "mien_nam",
            "nam": "mien_nam",
            "mien_nam": "mien_nam",
        }
        if clean not in aliases:
            raise ValueError("Region khong hop le. Dung mot trong: mien_bac, mien_trung, mien_nam.")
        return aliases[clean]

    @staticmethod
    def _normalize_date_tokens(date_str: str) -> list[str]:
        raw = (date_str or "").strip()
        if not raw:
            return []
        sep = "-" if "-" in raw else ("/" if "/" in raw else "")
        if not sep:
            return [raw]
        parts = raw.split(sep)
        if len(parts) != 3:
            return [raw]
        if len(parts[0]) == 4:
            yyyy, mm, dd = parts
        else:
            dd, mm, yyyy = parts
        dd_i, mm_i = dd.lstrip("0") or dd, mm.lstrip("0") or mm
        return [f"{dd}/{mm}", f"{dd_i}/{mm_i}", f"{dd}-{mm}-{yyyy}", f"{dd}/{mm}/{yyyy}"]

    def get_xskt_results(self, region: str = "mien_bac", date: str = "") -> dict[str, Any]:
        """Lay ket qua chi tiet cac giai xo so 3 mien (mien_bac, mien_trung, mien_nam) tu RSS xskt.com.vn.

        Args:
            region: Vung mien ('mien_bac', 'mien_trung', 'mien_nam').
            date: Ngay can xem dinh dang DD-MM-YYYY hoac YYYY-MM-DD (de trong de lay ngay moi nhat).

        Returns:
            dict: Ket qua chi tiet cac giai thuong, ngay mo thuong va link nguon.
        """
        norm_region = self._normalize_region(region)
        rss_url = self._RSS_URLS[norm_region]

        try:
            with httpx.Client(timeout=self.timeout, headers=self.headers, follow_redirects=True) as client:
                resp = client.get(rss_url)
                resp.raise_for_status()
        except httpx.HTTPError as exc:
            raise RuntimeError(f"Loi ket noi RSS xskt.com.vn ({rss_url}): {exc}") from exc

        try:
            root = ET.fromstring(resp.text)
        except ET.ParseError as exc:
            raise RuntimeError(f"Loi parse XML tu RSS xskt.com.vn: {exc}") from exc

        items: list[dict[str, str]] = []
        for item in root.findall(".//item"):
            title = (item.findtext("title") or "").strip()
            desc = (item.findtext("description") or "").strip()
            link = (item.findtext("link") or rss_url).strip()
            pub_date = (item.findtext("pubDate") or "").strip()
            if title or desc:
                items.append({"title": title, "description": desc, "url": link, "pub_date": pub_date})

        if not items:
            raise RuntimeError(f"RSS {rss_url} khong co du lieu ket qua xo so.")

        tokens = self._normalize_date_tokens(date)
        matched = None
        if tokens:
            for it in items:
                hay = f"{it['title']} {it['description']}"
                if any(tok in hay for tok in tokens):
                    matched = it
                    break

        chosen = matched or items[0]
        return {
            "region": norm_region,
            "requested_date": date or "latest",
            "exact_date_matched": bool(matched) if tokens else True,
            "title": chosen["title"],
            "pub_date": chosen["pub_date"],
            "details": chosen["description"],
            "url": chosen["url"],
            "available_recent_titles": [it["title"] for it in items[:5]],
        }
