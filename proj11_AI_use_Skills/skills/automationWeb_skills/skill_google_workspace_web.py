import re
import time
import urllib.parse
from typing import Any

TOOL_SCHEMA = {
    "name": "skill_google_workspace_web",
    "description": (
        "Create and edit real Google Sheets & Google Docs directly in Google Drive using the logged-in Chrome CDP session "
        "(C:\\ChromeAgentProfile on port 9222, runs silently in headless mode after 1st login), plus parse/export Google Workspace URLs."
    ),
    "risk_level": "safe",
    "parameters": {
        "type": "object",
        "properties": {
            "action": {
                "type": "string",
                "enum": [
                    "create_google_sheet",
                    "create_google_doc",
                    "parse_google_url",
                    "build_export_url",
                    "build_open_tab_plan",
                ],
                "description": (
                    "create_google_sheet: create a real Google Sheet on Google Drive, rename it, and write 2D rows/data; "
                    "create_google_doc: create a real Google Doc on Google Drive, rename it, and type content; "
                    "parse_google_url / build_export_url / build_open_tab_plan."
                ),
            },
            "title": {
                "type": "string",
                "default": "Untitled_Sheet",
                "description": "File name for create_google_sheet or create_google_doc (e.g. 'test_llm').",
            },
            "rows": {
                "type": "array",
                "items": {"type": "array", "items": {"type": "string"}},
                "description": "2D list of rows to write into Google Sheet (first row = headers, subsequent rows = data).",
            },
            "content": {
                "type": "string",
                "description": "Text content to write into Google Doc (for create_google_doc).",
            },
            "url": {
                "type": "string",
                "description": "Google Docs/Sheets/Drive URL (for parse_google_url / build_export_url / build_open_tab_plan).",
            },
            "export_format": {
                "type": "string",
                "default": "pdf",
            },
            "gid": {
                "type": "string",
                "default": "0",
            },
            "cdp_url": {
                "type": "string",
                "default": "http://127.0.0.1:9222",
            },
            "user_data_dir": {
                "type": "string",
                "default": r"C:\ChromeAgentProfile",
            },
        },
        "required": ["action"],
    },
}


def _ensure_cdp(cdp_url: str, user_data_dir: str, start_url: str) -> dict[str, Any] | None:
    from skills.automationPc_skills import skill_browser_cdp_controller as cdp

    return cdp._ensure_cdp_ready(cdp_url, user_data_dir, start_url)


def _is_google_login(url: str) -> bool:
    u = (url or "").lower()
    return any(k in u for k in ("accounts.google.com", "servicelogin", "/signin"))


def create_google_sheet(
    title: str = "Untitled_Sheet",
    rows: list[list[Any]] | None = None,
    cdp_url: str = "http://127.0.0.1:9222",
    user_data_dir: str = r"C:\ChromeAgentProfile",
) -> dict[str, Any]:
    """Create a real Google Sheet at sheets.new, rename it to `title`, and write `rows` via Chrome CDP."""
    err = _ensure_cdp(cdp_url, user_data_dir, "https://docs.google.com/spreadsheets/u/0/")
    if err:
        return err

    try:
        from agent_runtime.cdp_pool import get_cdp_pool
    except ImportError:
        return {"ok": False, "error": "Missing cdp_pool module."}

    clean_title = (title or "Untitled_Sheet").strip()
    data_rows = rows if isinstance(rows, list) else []

    def _op(browser, context):
        page = context.new_page()
        page.goto("https://sheets.new", wait_until="domcontentloaded", timeout=30000)

        try:
            page.wait_for_selector("input.docs-title-input", timeout=15000)
        except Exception:
            pass

        cur_url = page.url or ""
        if _is_google_login(cur_url):
            return {
                "ok": False,
                "login_required": True,
                "url": cur_url,
                "error": (
                    f"Chrome Agent Profile ({user_data_dir}) chua dang nhap Google. "
                    "Hay dang nhap Google 1 lan tren cua so Chrome Agent (hoac luu tai khoan vao Ho so & Bo nho -> Kho Tai khoan Web)."
                ),
            }

        title_input = page.locator("input.docs-title-input").first
        if title_input.count() > 0:
            title_input.click(timeout=5000)
            time.sleep(0.2)
            title_input.fill(clean_title, timeout=5000)
            title_input.press("Enter")
            time.sleep(0.8)

        written_rows = 0
        max_cols = 0
        if data_rows:
            name_box = page.locator("input#t-name-box").first
            if name_box.count() > 0:
                for r_idx, row in enumerate(data_rows[:100], start=1):
                    if not isinstance(row, (list, tuple)):
                        row = [row]
                    max_cols = max(max_cols, len(row))
                    name_box.click(timeout=4000)
                    name_box.fill(f"A{r_idx}", timeout=3000)
                    name_box.press("Enter")
                    time.sleep(0.1)
                    for c_idx, cell_val in enumerate(row[:26]):
                        val_str = "" if cell_val is None else str(cell_val)
                        if val_str:
                            page.keyboard.insert_text(val_str)
                        if c_idx < len(row) - 1:
                            page.keyboard.press("Tab")
                        else:
                            page.keyboard.press("Enter")
                        time.sleep(0.03)
                    written_rows += 1

        time.sleep(1.8)
        final_url = page.url or cur_url
        file_id = ""
        m = re.search(r"/d/([^/]+)", final_url)
        if m:
            file_id = m.group(1)

        return {
            "ok": True,
            "title": clean_title,
            "url": final_url,
            "file_id": file_id,
            "rows_written": written_rows,
            "cols_written": max_cols,
            "message": f"Created real Google Sheet '{clean_title}' on Google Drive with {written_rows} row(s).",
        }

    try:
        return get_cdp_pool().run(cdp_url, _op)
    except Exception as exc:
        return {"ok": False, "error": f"create_google_sheet failed: {type(exc).__name__}: {exc}"}


def create_google_doc(
    title: str = "Untitled_Doc",
    content: str = "",
    cdp_url: str = "http://127.0.0.1:9222",
    user_data_dir: str = r"C:\ChromeAgentProfile",
) -> dict[str, Any]:
    """Create a real Google Doc at docs.new, rename it to `title`, and type `content` via Chrome CDP."""
    err = _ensure_cdp(cdp_url, user_data_dir, "https://docs.google.com/document/u/0/")
    if err:
        return err

    try:
        from agent_runtime.cdp_pool import get_cdp_pool
    except ImportError:
        return {"ok": False, "error": "Missing cdp_pool module."}

    clean_title = (title or "Untitled_Doc").strip()

    def _op(browser, context):
        page = context.new_page()
        page.goto("https://docs.new", wait_until="domcontentloaded", timeout=30000)
        try:
            page.wait_for_selector("input.docs-title-input", timeout=15000)
        except Exception:
            pass

        cur_url = page.url or ""
        if _is_google_login(cur_url):
            return {
                "ok": False,
                "login_required": True,
                "url": cur_url,
                "error": f"Chrome Agent Profile ({user_data_dir}) chua dang nhap Google.",
            }

        title_input = page.locator("input.docs-title-input").first
        if title_input.count() > 0:
            title_input.click(timeout=5000)
            time.sleep(0.2)
            title_input.fill(clean_title, timeout=5000)
            title_input.press("Enter")
            time.sleep(0.8)

        if content:
            editor = page.locator(".kix-appview-editor").first
            if editor.count() > 0:
                editor.click(timeout=4000)
                time.sleep(0.2)
            page.keyboard.insert_text(str(content)[:10000])
            time.sleep(1.5)

        final_url = page.url or cur_url
        m = re.search(r"/d/([^/]+)", final_url)
        return {
            "ok": True,
            "title": clean_title,
            "url": final_url,
            "file_id": m.group(1) if m else "",
            "chars_written": len(str(content or "")),
            "message": f"Created real Google Doc '{clean_title}' on Google Drive.",
        }

    try:
        return get_cdp_pool().run(cdp_url, _op)
    except Exception as exc:
        return {"ok": False, "error": f"create_google_doc failed: {type(exc).__name__}: {exc}"}


def parse_google_url(url: str) -> dict:
    try:
        parsed_url = urllib.parse.urlparse(url)
        if "docs.google.com" in parsed_url.netloc:
            match = re.search(r"/d/([^/]+)", parsed_url.path)
            if match:
                return {"ok": True, "file_id": match.group(1)}
        elif "drive.google.com" in parsed_url.netloc:
            query_params = urllib.parse.parse_qs(parsed_url.query)
            if "id" in query_params:
                return {"ok": True, "file_id": query_params["id"][0]}
        return {"ok": False, "error": "Invalid Google URL"}
    except Exception as e:
        return {"ok": False, "error": str(e)}


def build_export_url(url: str, export_format: str = "pdf", gid: str = "0") -> dict:
    try:
        parsed_url = urllib.parse.urlparse(url)
        if "docs.google.com" in parsed_url.netloc:
            file_id = parse_google_url(url).get("file_id")
            if file_id:
                if "spreadsheets" in parsed_url.path:
                    export_url = f"https://docs.google.com/spreadsheets/d/{file_id}/export?format={export_format}&gid={gid}"
                else:
                    export_url = f"https://docs.google.com/document/d/{file_id}/export?format={export_format}"
                return {"ok": True, "export_url": export_url}
        return {"ok": False, "error": "Invalid Google URL"}
    except Exception as e:
        return {"ok": False, "error": str(e)}


def build_open_tab_plan(url: str, cdp_url: str = "http://127.0.0.1:9222") -> dict:
    return {"ok": True, "cdp_url": cdp_url, "url": url}


def execute(action: str = "", **kwargs) -> dict:
    if action == "create_google_sheet":
        return _safe_call(create_google_sheet, kwargs)
    elif action == "create_google_doc":
        return _safe_call(create_google_doc, kwargs)
    elif action == "parse_google_url":
        return _safe_call(parse_google_url, kwargs)
    elif action == "build_export_url":
        return _safe_call(build_export_url, kwargs)
    elif action == "build_open_tab_plan":
        return _safe_call(build_open_tab_plan, kwargs)
    else:
        return {"ok": False, "error": f"Unknown action: {action}"}


def _safe_call(fn, kw):
    import inspect as _insp

    sig = _insp.signature(fn)
    if any(p.kind == _insp.Parameter.VAR_KEYWORD for p in sig.parameters.values()):
        return fn(**kw)
    valid = {k: v for k, v in kw.items() if k in sig.parameters}
    return fn(**valid)
