"""Minimal local contract helper compatible with AutoEvolve_AI skills."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any


def make_envelope(
    *,
    ok: bool,
    data: Any = None,
    error: str | None = None,
    error_kind: str | None = None,
    status: str = "ok",
    meta: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Return a standardized response envelope for skill methods."""
    envelope: dict[str, Any] = {
        "ok": ok,
        "status": status,
        "timestamp_utc": datetime.now(timezone.utc).isoformat(),
    }
    if data is not None:
        envelope["data"] = data
    if error is not None:
        envelope["error"] = error
    if error_kind is not None:
        envelope["error_kind"] = error_kind
    if meta:
        envelope["meta"] = meta
    return envelope
