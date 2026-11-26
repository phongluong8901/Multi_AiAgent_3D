"""Automated concurrent healthcheck for all registered skills."""
from __future__ import annotations

import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from agent_runtime.config import OUTPUTS_DIR
from agent_runtime.skill_registry import SkillRegistry, ToolEntry

# Safe, lightweight smoke-test payloads per tool: (kwargs, requires_network, is_browser)
_SMOKE_CASES: dict[str, tuple[dict[str, Any], bool, bool]] = {
    # new_skills (offline)
    "calculator__evaluate": ({"expression": "125 * 4 + sqrt(16)"}, False, False),
    "calculator__percent_change": ({"old_value": 100.0, "new_value": 125.0}, False, False),
    "datetime_client__get_current_time": ({"timezone_name": "Asia/Ho_Chi_Minh"}, False, False),
    "datetime_client__convert_timezone": (
        {"datetime_str": "2026-11-26T02:00", "from_tz": "UTC", "to_tz": "Asia/Ho_Chi_Minh"},
        False,
        False,
    ),
    "local_workspace__list_files": ({"subdir": ".", "max_items": 10}, False, False),
    "local_workspace__read_text_file": ({"relative_path": "requirements.txt", "max_chars": 300}, False, False),
    "user_memory__remember_fact": (
        {"key": "_hc_test_fact", "value": "ok", "category": "test"},
        False,
        False,
    ),
    "user_memory__recall_facts": ({"query": "_hc_test_fact"}, False, False),
    "user_memory__forget_fact": ({"key": "_hc_test_fact"}, False, False),
    # automationPc_skills (offline safe read-only / dry-run checks)
    "browser_cdp_controller__execute": ({"action": "build_chrome_debug_cmd", "port": 9222}, False, False),
    "clipboard_manager__execute": ({"action": "search_history", "query": "_hc"}, False, False),
    "office_com_excel__execute": ({"action": "read_sheet", "file_path": "_nonexistent_hc.xlsx"}, False, False),
    "pc_safety_guard__execute": ({"action": "evaluate_command", "command": "Get-ChildItem"}, False, False),
    "smart_file_ops__execute": ({"action": "search_files", "root": ".", "pattern": "*.md", "max_results": 5}, False, False),
    "win_registry_startup__execute": ({"action": "list_startup_apps"}, False, False),
    # report_exporter (offline, writes temp healthcheck files that get cleaned up)
    "report_exporter__export_json": ({"payload": {"ok": True}, "filename": "_hc_test.json"}, False, False),
    "report_exporter__export_csv": ({"rows": [{"k": "a", "v": 1}], "filename": "_hc_test.csv"}, False, False),
    "report_exporter__export_xlsx": ({"rows": [{"k": "a", "v": 1}], "filename": "_hc_test.xlsx"}, False, False),
    "report_exporter__export_markdown": (
        {"title": "Healthcheck", "sections": [{"heading": "Status", "body": "OK"}], "filename": "_hc_test.md"},
        False,
        False,
    ),
    # search_skills (network)
    "arxiv_api_client__search_papers": ({"query": "self-evolving agents", "max_results": 1}, True, False),
    "binance_crypto_client__get_crypto_price": ({"symbol": "BTCUSDT"}, True, False),
    "frankfurter_forex_client__get_exchange_rate": ({"from_currency": "USD", "to_currency": "VND"}, True, False),
    "github_api_client__search_repositories": ({"q": "fastapi", "per_page": 1}, True, False),
    "hacker_news_api_client__get_top_stories": ({}, True, False),
    "hacker_news_api_client__get_story": ({"story_id": 8863}, True, False),
    "huggingface_api_client__search_models": (
        {"filter_task": "text-generation", "sort": "downloads", "direction": -1, "limit": 1},
        True,
        False,
    ),
    "ip_geolocation_client__get_geolocation": ({"ip_address": "8.8.8.8"}, True, False),
    "network_inspector__inspect_url": ({"url": "https://example.com"}, True, False),
    "open_meteo_weather_client__get_current_weather": ({"city": "Hanoi"}, True, False),
    "openstreetmap_api_client__get_coordinates": ({"query": "Hanoi"}, True, False),
    "pypi_api_client__get_package_info": ({"package_name": "httpx"}, True, False),
    "rss_feed_reader__get_latest_articles": ({"limit": 1}, True, False),
    "weather_api_client__get_current_weather": ({"city": "Hanoi"}, True, False),
    "weather_api_client__get_latitude": ({"city": "Hanoi"}, True, False),
    "weather_api_client__get_longitude": ({"city": "Hanoi"}, True, False),
    "web_reader__read_url": ({"url": "https://example.com", "max_chars": 500}, True, False),
    "web_search__search": ({"query": "python programming language", "max_results": 2}, True, False),
    "wikipedia_api_client__get_summary": ({"topic": "Python (programming language)"}, True, False),
    "document_analyzer__read_pdf": (
        {"source": "https://arxiv.org/pdf/2508.07407.pdf", "max_pages": 1, "max_chars": 500},
        True,
        False,
    ),
    "document_analyzer__analyze_tabular": ({"source": "_hc_test.csv", "sample_rows": 1}, False, False),
    "browser_reader__read_dynamic_page": ({"url": "https://example.com", "max_chars": 500}, True, True),
    "browser_reader__extract_elements": ({"url": "https://example.com", "css_selector": "h1", "limit": 2}, True, True),
}


@dataclass(frozen=True)
class HealthResult:
    pack: str
    tool: str
    status: str  # PASS | FAIL | SKIP
    elapsed_ms: int
    detail: str


def _run_one(entry: ToolEntry, offline_only: bool, include_browser: bool) -> HealthResult:
    case = _SMOKE_CASES.get(entry.name)
    if case is None:
        return HealthResult(entry.pack, entry.name, "SKIP", 0, "No smoke test configured")

    kwargs, requires_network, is_browser = case
    if offline_only and requires_network:
        return HealthResult(entry.pack, entry.name, "SKIP", 0, "Skipped (offline mode)")
    if is_browser and not include_browser:
        return HealthResult(entry.pack, entry.name, "SKIP", 0, "Skipped (use --include-browser)")

    run_kwargs = dict(kwargs)
    # Prepare local CSV/XLSX paths for tabular/excel tools
    if entry.name == "document_analyzer__analyze_tabular":
        OUTPUTS_DIR.mkdir(parents=True, exist_ok=True)
        tmp_csv = OUTPUTS_DIR / "_hc_tabular.csv"
        tmp_csv.write_text("col_a,col_b\n1,10\n2,20\n", encoding="utf-8")
        run_kwargs["source"] = str(tmp_csv)
    elif entry.name == "office_com_excel__execute":
        import openpyxl

        OUTPUTS_DIR.mkdir(parents=True, exist_ok=True)
        tmp_xlsx = OUTPUTS_DIR / "_hc_office.xlsx"
        wb = openpyxl.Workbook()
        ws = wb.active
        ws.append(["A", "B"])
        ws.append([1, 2])
        wb.save(tmp_xlsx)
        run_kwargs["file_path"] = str(tmp_xlsx)

    t0 = time.perf_counter()
    res = entry.handler(**run_kwargs)
    elapsed_ms = int((time.perf_counter() - t0) * 1000)

    if res.get("ok"):
        return HealthResult(entry.pack, entry.name, "PASS", elapsed_ms, "OK")
    err = str(res.get("error") or "Unknown error")
    return HealthResult(entry.pack, entry.name, "FAIL", elapsed_ms, err[:90])


def _cleanup_temp_files() -> None:
    try:
        from agent_runtime.memory_store import SQLiteMemoryStore

        SQLiteMemoryStore().delete_fact("_hc_test_fact")
    except Exception:
        pass
    if not OUTPUTS_DIR.exists():
        return
    for name in ("_hc_test.json", "_hc_test.csv", "_hc_test.xlsx", "_hc_test.md", "_hc_tabular.csv", "_hc_office.xlsx"):
        p = OUTPUTS_DIR / name
        if p.exists():
            try:
                p.unlink()
            except OSError:
                pass


def run_healthcheck(
    registry: SkillRegistry,
    offline_only: bool = False,
    include_browser: bool = False,
    max_workers: int = 8,
) -> list[HealthResult]:
    """Run smoke tests concurrently across all registered tools and return sorted results."""
    results: list[HealthResult] = []
    try:
        with ThreadPoolExecutor(max_workers=max_workers) as pool:
            futures = {
                pool.submit(_run_one, entry, offline_only, include_browser): entry
                for entry in registry.entries
            }
            for fut in as_completed(futures):
                results.append(fut.result())
    finally:
        _cleanup_temp_files()

    results.sort(key=lambda r: (r.pack, r.tool))
    return results


def print_healthcheck_report(results: list[HealthResult]) -> int:
    """Print an aligned ASCII healthcheck report and return exit code (0 if zero failures)."""
    passed = sum(1 for r in results if r.status == "PASS")
    failed = sum(1 for r in results if r.status == "FAIL")
    skipped = sum(1 for r in results if r.status == "SKIP")

    print("=" * 98)
    print(f"{'PACK':<15} | {'TOOL':<42} | {'STATUS':<6} | {'TIME':>7} | DETAIL")
    print("-" * 98)
    for r in results:
        t_str = f"{r.elapsed_ms}ms" if r.status != "SKIP" else "-"
        print(f"{r.pack:<15} | {r.tool:<42} | {r.status:<6} | {t_str:>7} | {r.detail}")
    print("=" * 98)
    print(f"[HEALTHCHECK] total={len(results)} | PASS={passed} | FAIL={failed} | SKIP={skipped}")
    return 0 if failed == 0 else 1
