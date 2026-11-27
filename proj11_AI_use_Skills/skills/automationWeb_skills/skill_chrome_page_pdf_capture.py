import os
import json

TOOL_SCHEMA = {
    "name": "skill_chrome_page_pdf_capture",
    "description": "Export active Chrome CDP page to PDF or capture full-page/element screenshots via Playwright (lazy-imported), with output path validation and dry_run planning.",
    "risk_level": "safe",
    "parameters": {
        "export_page_pdf": {
            "output_path": "Path to save the PDF file",
            "page_format": "Format of the PDF (e.g., 'A4')",
            "cdp_url": "URL of the Chrome DevTools Protocol",
            "dry_run": "If True, only simulate the action without executing it"
        },
        "capture_full_page": {
            "output_path": "Path to save the screenshot file",
            "selector": "CSS selector for the element to capture",
            "cdp_url": "URL of the Chrome DevTools Protocol",
            "dry_run": "If True, only simulate the action without executing it"
        }
    }
}

def _lazy_import_playwright():
    try:
        from playwright.sync_api import sync_playwright
        return sync_playwright
    except ImportError:
        return None

def _validate_output_path(output_path):
    if not output_path:
        return False, "Output path is required"
    directory = os.path.dirname(output_path)
    if directory and not os.path.exists(directory):
        return False, f"Directory {directory} does not exist"
    return True, ""

def execute(action: str = "export_page_pdf", **kwargs) -> dict:
    if action == "export_page_pdf":
        return _safe_call(export_page_pdf, kwargs)
    elif action == "capture_full_page":
        return _safe_call(capture_full_page, kwargs)
    else:
        return {"ok": False, "error": f"Unknown action: {action}"}

def export_page_pdf(output_path: str = 'page.pdf', page_format: str = 'A4', cdp_url: str = 'http://localhost:9222', dry_run: bool = True) -> dict:
    valid, error = _validate_output_path(output_path)
    if not valid:
        return {"ok": False, "error": error}

    sync_playwright = _lazy_import_playwright()
    if not sync_playwright and not dry_run:
        return {"ok": False, "error": "Missing package playwright"}

    if dry_run:
        return {"ok": True, "message": f"Dry run: Exporting page to {output_path} in {page_format} format"}

    try:
        with sync_playwright() as p:
            browser = p.chromium.connect_over_cdp(cdp_url)
            page = browser.pages[0]
            page.pdf(path=output_path, format=page_format)
            browser.close()
        return {"ok": True, "message": f"Page exported to {output_path}"}
    except Exception as e:
        return {"ok": False, "error": str(e)}

def capture_full_page(output_path: str = 'fullpage.png', selector: str = '', cdp_url: str = 'http://localhost:9222', dry_run: bool = True) -> dict:
    valid, error = _validate_output_path(output_path)
    if not valid:
        return {"ok": False, "error": error}

    sync_playwright = _lazy_import_playwright()
    if not sync_playwright and not dry_run:
        return {"ok": False, "error": "Missing package playwright"}

    if dry_run:
        return {"ok": True, "message": f"Dry run: Capturing full page to {output_path} with selector '{selector}'"}

    try:
        with sync_playwright() as p:
            browser = p.chromium.connect_over_cdp(cdp_url)
            page = browser.pages[0]
            if selector:
                element = page.query_selector(selector)
                if not element:
                    return {"ok": False, "error": f"Element with selector '{selector}' not found"}
                element.screenshot(path=output_path)
            else:
                page.screenshot(path=output_path, full_page=True)
            browser.close()
        return {"ok": True, "message": f"Screenshot saved to {output_path}"}
    except Exception as e:
        return {"ok": False, "error": str(e)}

def _safe_call(fn, kw):
    import inspect as _insp
    sig = _insp.signature(fn)
    if any(p.kind == _insp.Parameter.VAR_KEYWORD for p in sig.parameters.values()):
        return fn(**kw)
    valid = {k: v for k, v in kw.items() if k in sig.parameters}
    return fn(**valid)
