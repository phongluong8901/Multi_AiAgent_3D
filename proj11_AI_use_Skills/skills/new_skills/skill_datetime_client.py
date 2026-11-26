"""Timezone-aware clock and timezone conversion skill (no API key required)."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

_TZ_ALIASES: dict[str, str] = {
    "hanoi": "Asia/Ho_Chi_Minh",
    "ha noi": "Asia/Ho_Chi_Minh",
    "ho chi minh": "Asia/Ho_Chi_Minh",
    "hcm": "Asia/Ho_Chi_Minh",
    "saigon": "Asia/Ho_Chi_Minh",
    "vietnam": "Asia/Ho_Chi_Minh",
    "vn": "Asia/Ho_Chi_Minh",
    "da nang": "Asia/Ho_Chi_Minh",
    "danang": "Asia/Ho_Chi_Minh",
    "tokyo": "Asia/Tokyo",
    "japan": "Asia/Tokyo",
    "seoul": "Asia/Seoul",
    "korea": "Asia/Seoul",
    "singapore": "Asia/Singapore",
    "bangkok": "Asia/Bangkok",
    "london": "Europe/London",
    "uk": "Europe/London",
    "paris": "Europe/Paris",
    "berlin": "Europe/Berlin",
    "new york": "America/New_York",
    "nyc": "America/New_York",
    "los angeles": "America/Los_Angeles",
    "san francisco": "America/Los_Angeles",
    "sydney": "Australia/Sydney",
    "utc": "UTC",
    "gmt": "UTC",
}

_WEEKDAYS_VI = [
    "Thứ Hai",
    "Thứ Ba",
    "Thứ Tư",
    "Thứ Năm",
    "Thứ Sáu",
    "Thứ Bảy",
    "Chủ Nhật",
]


def _resolve_tz(tz_name: str) -> tuple[str, timezone | ZoneInfo]:
    raw = (tz_name or "Asia/Ho_Chi_Minh").strip()
    canonical = _TZ_ALIASES.get(raw.lower(), raw)
    try:
        return canonical, ZoneInfo(canonical)
    except Exception:
        if canonical == "Asia/Ho_Chi_Minh":
            return canonical, timezone(timedelta(hours=7))
        if canonical.upper() in ("UTC", "GMT"):
            return "UTC", timezone.utc
        raise ValueError(
            f"Mui gio khong hop le: '{tz_name}'. Hay dung ten IANA nhu 'Asia/Ho_Chi_Minh', 'UTC', 'Asia/Tokyo'."
        )


class DateTimeClient:
    """Get accurate current date, time, weekday, and convert between timezones."""

    def get_current_time(self, timezone_name: str = "Asia/Ho_Chi_Minh") -> dict:
        """Return current date, local time, weekday (VI/EN), and UTC offset for a city or IANA timezone."""
        canonical, tz_obj = _resolve_tz(timezone_name)
        now = datetime.now(tz_obj)
        offset = now.utcoffset()
        offset_hours = (offset.total_seconds() / 3600.0) if offset is not None else 0.0
        sign = "+" if offset_hours >= 0 else "-"
        abs_h = int(abs(offset_hours))
        abs_m = int(round((abs(offset_hours) - abs_h) * 60))
        utc_offset_str = f"UTC{sign}{abs_h:02d}:{abs_m:02d}"

        return {
            "timezone": canonical,
            "utc_offset": utc_offset_str,
            "iso": now.isoformat(timespec="seconds"),
            "date": now.strftime("%Y-%m-%d"),
            "time": now.strftime("%H:%M:%S"),
            "weekday_vi": _WEEKDAYS_VI[now.weekday()],
            "weekday_en": now.strftime("%A"),
            "unix_timestamp": int(now.timestamp()),
        }

    def convert_timezone(
        self,
        datetime_str: str,
        from_tz: str = "UTC",
        to_tz: str = "Asia/Ho_Chi_Minh",
    ) -> dict:
        """Convert an ISO datetime string (e.g. '2026-11-26T02:00') from one timezone to another."""
        src_name, src_tz = _resolve_tz(from_tz)
        dst_name, dst_tz = _resolve_tz(to_tz)

        cleaned = (datetime_str or "").strip().replace("Z", "+00:00")
        dt = datetime.fromisoformat(cleaned)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=src_tz)
        converted = dt.astimezone(dst_tz)

        return {
            "source_iso": dt.isoformat(timespec="seconds"),
            "source_timezone": src_name,
            "target_iso": converted.isoformat(timespec="seconds"),
            "target_timezone": dst_name,
            "target_date": converted.strftime("%Y-%m-%d"),
            "target_time": converted.strftime("%H:%M:%S"),
            "target_weekday_vi": _WEEKDAYS_VI[converted.weekday()],
        }
