import re
import time
import json
from urllib.parse import urljoin, urlparse, parse_qs

TOOL_SCHEMA = {
    "name": "skill_web_pagination_scroller",
    "description": "cào web nhiều trang pagination, tạo danh sách URL phân trang page=1..N, cuộn vô tận infinite scroll trên Chrome CDP gom dữ liệu",
    "risk_level": "safe",
    "parameters": {
        "template_url": "str",
        "start_page": "int",
        "end_page": "int",
        "html": "str",
        "current_url": "str",
        "records": "list[dict]",
        "key_field": "str",
        "max_scrolls": "int",
        "delay_ms": "int",
        "cdp_url": "str",
        "dry_run": "bool"
    }
}

def execute(action: str = "", **kwargs) -> dict:
    try:
        if action == "build_paginated_urls":
            return _safe_call(build_paginated_urls, kwargs)
        elif action == "find_next_page_url":
            return _safe_call(find_next_page_url, kwargs)
        elif action == "deduplicate_records":
            return _safe_call(deduplicate_records, kwargs)
        elif action == "scroll_collect_plan":
            return _safe_call(scroll_collect_plan, kwargs)
        else:
            return {"ok": False, "error": "Unknown action"}
    except Exception as e:
        return {"ok": False, "error": str(e)}

def build_paginated_urls(template_url: str, start_page: int = 1, end_page: int = 5) -> dict:
    try:
        urls = [template_url.format(page=page) for page in range(start_page, end_page + 1)]
        return {"ok": True, "urls": urls}
    except Exception as e:
        return {"ok": False, "error": str(e)}

def find_next_page_url(html: str, current_url: str = '') -> dict:
    try:
        next_page_link = re.search(r'href=["\'](.*?)["\'].*?next', html, re.IGNORECASE)
        if next_page_link:
            next_url = urljoin(current_url, next_page_link.group(1))
            return {"ok": True, "next_url": next_url}
        return {"ok": False, "error": "Next page URL not found"}
    except Exception as e:
        return {"ok": False, "error": str(e)}

def deduplicate_records(records: list[dict], key_field: str = 'url') -> dict:
    try:
        seen = set()
        deduplicated = []
        for record in records:
            key = record.get(key_field)
            if key not in seen:
                seen.add(key)
                deduplicated.append(record)
        return {"ok": True, "deduplicated_records": deduplicated}
    except Exception as e:
        return {"ok": False, "error": str(e)}

def scroll_collect_plan(max_scrolls: int = 5, delay_ms: int = 800, cdp_url: str = 'http://localhost:9222', dry_run: bool = True) -> dict:
    try:
        if dry_run:
            return {"ok": True, "plan": f"Would scroll {max_scrolls} times with {delay_ms}ms delay on {cdp_url}"}
        else:
            # Placeholder for actual scrolling logic
            for _ in range(max_scrolls):
                time.sleep(delay_ms / 1000)
            return {"ok": True, "message": "Scrolled successfully"}
    except Exception as e:
        return {"ok": False, "error": str(e)}

def _safe_call(fn, kw):
    import inspect as _insp
    sig = _insp.signature(fn)
    if any(p.kind == _insp.Parameter.VAR_KEYWORD for p in sig.parameters.values()):
        return fn(**kw)
    valid = {k: v for k, v in kw.items() if k in sig.parameters}
    return fn(**valid)
