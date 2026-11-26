"""SQLite-backed TTL Cache for tool calls to accelerate repeated queries."""
from __future__ import annotations

import hashlib
import json
from typing import Any

from agent_runtime.memory_store import SQLiteMemoryStore

# Per-skill TTL in seconds (0 = never cache)
_TOOL_TTL_SECONDS: dict[str, int] = {
    "datetime_client": 0,
    "report_exporter": 0,
    "user_memory": 0,
    "local_workspace": 0,
    "calculator": 0,
    "system_monitor": 0,
    "clipboard_manager": 0,
    "binance_crypto_client": 60,
    "frankfurter_forex_client": 300,
    "open_meteo_weather_client": 300,
    "weather_api_client": 300,
    "web_search": 300,
    "rss_feed_reader": 300,
    "hacker_news_api_client": 300,
    "web_reader": 600,
    "browser_reader": 600,
    "network_inspector": 300,
    "document_analyzer": 900,
    "arxiv_api_client": 900,
    "github_api_client": 600,
    "huggingface_api_client": 600,
    "pypi_api_client": 900,
    "wikipedia_api_client": 1800,
    "openstreetmap_api_client": 3600,
    "ip_geolocation_client": 1800,
}


class ToolTTLCache:
    """Caches successful tool responses in SQLite with domain-aware TTL."""

    def __init__(self, store: SQLiteMemoryStore, enabled: bool = True):
        self.store = store
        self.enabled = enabled
        self.hits = 0
        self.misses = 0

    def ttl_for(self, tool_name: str) -> int:
        # Never cache local PC automation / stateful action tools ending with '__execute'
        if (tool_name or "").endswith("__execute"):
            return 0
        prefix = (tool_name or "").split("__", 1)[0]
        return _TOOL_TTL_SECONDS.get(prefix, 300)

    @staticmethod
    def _make_key(tool_name: str, args: dict[str, Any]) -> str:
        normalized = json.dumps(args or {}, sort_keys=True, ensure_ascii=False, default=str)
        digest = hashlib.sha256(f"{tool_name}::{normalized}".encode("utf-8")).hexdigest()
        return digest

    def get(self, tool_name: str, args: dict[str, Any]) -> dict[str, Any] | None:
        if not self.enabled or self.ttl_for(tool_name) <= 0:
            return None
        key = self._make_key(tool_name, args)
        cached = self.store.cache_get(key)
        if cached is not None:
            self.hits += 1
            return cached
        self.misses += 1
        return None

    def set(self, tool_name: str, args: dict[str, Any], payload: dict[str, Any]) -> None:
        if not self.enabled or not payload.get("ok"):
            return
        ttl = self.ttl_for(tool_name)
        if ttl <= 0:
            return
        key = self._make_key(tool_name, args)
        self.store.cache_set(key, tool_name, payload, ttl_sec=ttl)

    def clear(self) -> int:
        self.hits = 0
        self.misses = 0
        return self.store.cache_clear()
