import json
import os
import shutil
import subprocess
import time
from typing import Any, Dict

TOOL_SCHEMA = {
    "name": "skill_browser_cdp_controller",
    "description": (
        "Control and read live Chrome/Edge sessions over CDP (http://127.0.0.1:9222) using Playwright: "
        "launch stealth Chrome Agent Profile (C:\\ChromeAgentProfile), auto-login websites using Windows DPAPI Encrypted Web Vault, "
        "list tabs, open & read any logged-in web page, and read/summarize recent Gmail inbox messages."
    ),
    "risk_level": "safe",
    "parameters": {
        "type": "object",
        "properties": {
            "action": {
                "type": "string",
                "enum": [
                    "read_gmail_inbox",
                    "open_and_read_page",
                    "cdp_live_search",
                    "auto_login_site",
                    "list_saved_web_accounts",
                    "launch_agent_chrome",
                    "list_tabs",
                    "extract_active_tab",
                    "build_chrome_debug_cmd",
                ],
                "description": (
                    "read_gmail_inbox: open/read latest Gmail emails via Chrome CDP; "
                    "cdp_live_search: last-resort live search on real Chrome CDP (site='shopee'/'google'/'bing'/'lazada'/'tiki') for active product/web links; "
                    "open_and_read_page: open URL in CDP Chrome and extract live text; "
                    "auto_login_site / list_saved_web_accounts / launch_agent_chrome / list_tabs."
                ),
            },
            "query": {
                "type": "string",
                "description": "Search keywords for cdp_live_search (e.g. 'Luckfox Pico SC3336').",
            },
            "site": {
                "type": "string",
                "default": "gmail",
                "description": "Site key in Encrypted Web Vault (e.g. 'gmail', 'github', 'erp').",
            },
            "username": {
                "type": "string",
                "description": "Optional email/username for auto_login_site. Auto-saved encrypted (DPAPI) if login succeeds.",
            },
            "password": {
                "type": "string",
                "description": "Optional password for auto_login_site. Auto-saved encrypted (DPAPI) if login succeeds.",
            },
            "url": {
                "type": "string",
                "default": "https://mail.google.com/mail/u/0/#inbox",
                "description": "Target URL for open_and_read_page, auto_login_site, or launch_agent_chrome.",
            },
            "limit": {
                "type": "integer",
                "default": 5,
                "description": "Number of recent Gmail threads to extract (for read_gmail_inbox).",
            },
            "open_latest": {
                "type": "boolean",
                "default": True,
                "description": "If true, click the newest Gmail email to also extract its full body text.",
            },
            "port": {
                "type": "integer",
                "default": 9222,
            },
            "user_data_dir": {
                "type": "string",
                "default": r"C:\ChromeAgentProfile",
            },
            "cdp_url": {
                "type": "string",
                "default": "http://127.0.0.1:9222",
            },
            "wait_sec": {
                "type": "number",
                "default": 3.5,
            },
            "max_chars": {
                "type": "integer",
                "default": 6000,
            },
            "headless": {
                "type": "boolean",
                "description": "Run Chrome silently in background (--headless=new). Defaults to auto (headless if profile already logged in).",
            },
        },
        "required": ["action"],
    },
}


def _get_vault():
    from agent_runtime.credential_vault import EncryptedCredentialVault

    return EncryptedCredentialVault()


def _find_chrome_executable() -> str | None:
    candidates = [
        shutil.which("chrome"),
        shutil.which("chrome.exe"),
        r"C:\Program Files\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
        os.path.expandvars(r"%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe"),
        shutil.which("msedge"),
        r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
        r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
    ]
    for path in candidates:
        if path and os.path.isfile(path):
            return path
    return None


def _is_cdp_alive(cdp_url: str = "http://127.0.0.1:9222", timeout: float = 1.5) -> bool:
    try:
        import requests

        resp = requests.get(f"{cdp_url.rstrip('/')}/json/version", timeout=timeout)
        return resp.status_code == 200 and "Browser" in resp.text
    except Exception:
        return False


def build_chrome_debug_cmd(port: int = 9222, user_data_dir: str = r"C:\ChromeAgentProfile") -> Dict[str, Any]:
    exe = _find_chrome_executable() or "chrome.exe"
    profile = user_data_dir or r"C:\ChromeAgentProfile"
    cmd = (
        f'"{exe}" --remote-debugging-port={int(port)} --user-data-dir="{profile}" '
        '--disable-blink-features=AutomationControlled'
    )
    return {"ok": True, "command": cmd, "executable": exe, "user_data_dir": profile, "port": int(port)}


def list_saved_web_accounts() -> Dict[str, Any]:
    vault = _get_vault()
    accounts = vault.list_credentials()
    return {
        "ok": True,
        "count": len(accounts),
        "accounts": accounts,
        "note": "Passwords are encrypted with Windows DPAPI and never exposed.",
    }


def _profile_has_session(profile_dir: str) -> bool:
    """Return True if Chrome Agent Profile already exists (user likely signed in before)."""
    default_dir = os.path.join(profile_dir, "Default")
    return os.path.isdir(default_dir) and (
        os.path.exists(os.path.join(default_dir, "Preferences"))
        or os.path.exists(os.path.join(default_dir, "Network", "Cookies"))
        or os.path.exists(os.path.join(default_dir, "Cookies"))
    )


def launch_agent_chrome(
    port: int = 9222,
    user_data_dir: str = r"C:\ChromeAgentProfile",
    url: str = "https://mail.google.com/mail/u/0/#inbox",
    headless: bool | None = None,
) -> Dict[str, Any]:
    cdp_url = f"http://127.0.0.1:{int(port)}"
    if _is_cdp_alive(cdp_url):
        return {
            "ok": True,
            "already_running": True,
            "cdp_url": cdp_url,
            "user_data_dir": user_data_dir,
            "message": f"Chrome CDP is already running at {cdp_url}.",
        }

    exe = _find_chrome_executable()
    if not exe:
        return {"ok": False, "error": "Could not locate Chrome or Edge executable on this machine."}

    profile = user_data_dir or r"C:\ChromeAgentProfile"
    use_headless = _profile_has_session(profile) if headless is None else bool(headless)
    os.makedirs(profile, exist_ok=True)
    cmd = [
        exe,
        f"--remote-debugging-port={int(port)}",
        f"--user-data-dir={profile}",
        "--disable-blink-features=AutomationControlled",
        "--no-first-run",
        "--no-default-browser-check",
    ]
    if use_headless:
        cmd.extend(["--headless=new", "--window-size=1366,900", "--disable-gpu"])
    if url:
        cmd.append(url)

    creationflags = 0
    if os.name == "nt":
        creationflags = (
            getattr(subprocess, "DETACHED_PROCESS", 0)
            | getattr(subprocess, "CREATE_NEW_PROCESS_GROUP", 0)
            | getattr(subprocess, "CREATE_NO_WINDOW", 0)
        )

    try:
        subprocess.Popen(
            cmd,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            creationflags=creationflags,
        )
    except Exception as exc:
        return {"ok": False, "error": f"Failed to launch Chrome CDP: {exc}"}

    deadline = time.time() + 10.0
    while time.time() < deadline:
        if _is_cdp_alive(cdp_url, timeout=1.0):
            mode_label = "headless (chay an hoan toan)" if use_headless else "visible (hien cua so de dang nhap)"
            return {
                "ok": True,
                "already_running": False,
                "headless": use_headless,
                "cdp_url": cdp_url,
                "user_data_dir": profile,
                "url": url,
                "message": (
                    f"Launched stealth Chrome Agent Profile [{mode_label}] at {cdp_url} (profile: {profile})."
                ),
            }
        time.sleep(0.4)

    return {
        "ok": False,
        "cdp_url": cdp_url,
        "error": f"Chrome launched but CDP port {port} did not respond within 10s.",
    }


def list_tabs(cdp_url: str = "http://127.0.0.1:9222") -> Dict[str, Any]:
    try:
        import requests

        response = requests.get(f"{cdp_url.rstrip('/')}/json", timeout=3.0)
        response.raise_for_status()
        tabs = response.json()
    except Exception as exc:
        return {
            "ok": False,
            "error": (
                f"Cannot reach Chrome CDP at {cdp_url}: {exc}. "
                "Call action='launch_agent_chrome' first to start Chrome with --remote-debugging-port=9222."
            ),
        }
    pages = [
        {"title": t.get("title", ""), "url": t.get("url", ""), "type": t.get("type", "")}
        for t in tabs
        if t.get("type") == "page"
    ]
    return {"ok": True, "count": len(pages), "tabs": pages}


def extract_active_tab(cdp_url: str = "http://127.0.0.1:9222") -> Dict[str, Any]:
    tabs_result = list_tabs(cdp_url)
    if not tabs_result.get("ok"):
        return tabs_result
    for tab in tabs_result.get("tabs", []):
        if tab.get("title"):
            return {"ok": True, "active_tab": tab}
    return {"ok": False, "error": "No active page tab found."}


def _ensure_cdp_ready(cdp_url: str, user_data_dir: str, start_url: str) -> Dict[str, Any] | None:
    if _is_cdp_alive(cdp_url):
        return None
    port = 9222
    try:
        port = int(cdp_url.rstrip("/").rsplit(":", 1)[-1])
    except Exception:
        port = 9222
    res = launch_agent_chrome(port=port, user_data_dir=user_data_dir, url=start_url)
    if not res.get("ok"):
        return res
    return None


def _is_login_url(url: str) -> bool:
    u = (url or "").lower()
    return any(
        k in u
        for k in (
            "accounts.google.com",
            "servicelogin",
            "/signin",
            "/sign-in",
            "/login",
            "workspace.google.com/intl/",
            "workspace.google.com/gmail",
        )
    )


def _try_auto_login_on_page(
    page,
    site_hint: str,
    username_override: str = "",
    password_override: str = "",
) -> dict[str, Any]:
    """Fill login form on an open Playwright page using provided credentials or encrypted Windows DPAPI vault."""
    vault = _get_vault()
    if username_override and password_override:
        username = username_override.strip()
        password = password_override
    else:
        cred = vault.get_decrypted_for_automation(site_hint)
        if not cred:
            return {"attempted": False, "reason": "no_saved_credential"}
        username = cred["username"]
        password = cred["password"]
    cur_url = (page.url or "").lower()

    try:
        # Handle Google marketing landing page -> click Sign in
        if "workspace.google.com" in cur_url:
            sign_in = page.locator("a:has-text('Sign in'), a:has-text('Đăng nhập')").first
            if sign_in.count() > 0:
                sign_in.click(timeout=4000)
                time.sleep(2.5)
                cur_url = (page.url or "").lower()

        # Case 1: Google 2-step login flow (email -> Next -> password -> Next)
        if "accounts.google.com" in cur_url:
            email_inp = page.locator("input[type='email'], input#identifierId").first
            if email_inp.count() > 0 and email_inp.is_visible():
                email_inp.fill(username, timeout=4000)
                page.keyboard.press("Enter")
                time.sleep(2.5)
            pw_inp = page.locator("input[type='password'], input[name='Passwd']").first
            if pw_inp.count() > 0:
                pw_inp.wait_for(state="visible", timeout=6000)
                pw_inp.fill(password, timeout=4000)
                page.keyboard.press("Enter")
                time.sleep(4.0)
            after_url = (page.url or "").lower()
            if "challenge" in after_url or "signin/v2/challenge" in after_url:
                return {
                    "attempted": True,
                    "ok": False,
                    "needs_2fa": True,
                    "username": username,
                    "message": "Da tu dong dien tai khoan/mat khau Google, nhung Google dang yeu cau xac nhan 2FA tren dien thoai. Hay xac nhan tren cua so Chrome roi hoi lai.",
                }
            return {"attempted": True, "ok": not _is_login_url(page.url), "username": username}

        # Case 2: Generic web login form (username/email + password on same page)
        user_sel = "input[type='email'], input[name*='email' i], input[name*='user' i], input[id*='user' i], input[type='text']"
        pw_sel = "input[type='password']"
        u_inp = page.locator(user_sel).first
        p_inp = page.locator(pw_sel).first
        if u_inp.count() > 0 and u_inp.is_visible():
            u_inp.fill(username, timeout=4000)
        if p_inp.count() > 0 and p_inp.is_visible():
            p_inp.fill(password, timeout=4000)
            p_inp.press("Enter")
            time.sleep(3.5)
            return {"attempted": True, "ok": not _is_login_url(page.url), "username": username}
        return {"attempted": False, "reason": "no_login_form_detected"}
    except Exception as exc:
        return {"attempted": True, "ok": False, "error": f"{type(exc).__name__}: {exc}"}


def auto_login_site(
    site: str = "gmail",
    url: str = "",
    username: str = "",
    password: str = "",
    cdp_url: str = "http://127.0.0.1:9222",
    user_data_dir: str = r"C:\ChromeAgentProfile",
) -> Dict[str, Any]:
    vault = _get_vault()
    provided_inline = bool((username or "").strip() and (password or ""))
    cred = vault.get_decrypted_for_automation(site) if not provided_inline else None
    if not provided_inline and not cred:
        return {
            "ok": False,
            "error": (
                f"Khong tim thay tai khoan '{site}' trong Kho Tai khoan Web (Ma hoa). "
                "Hay cung cap username/password hoac luu trong Ho so & Bo nho -> Kho Tai khoan Web (Ma hoa DPAPI)."
            ),
        }

    eff_user = username.strip() if provided_inline else cred["username"]
    eff_pass = password if provided_inline else cred["password"]
    target_url = (
        url
        or (cred.get("login_url") if cred else "")
        or ("https://mail.google.com/mail/u/0/#inbox" if "gmail" in site.lower() else "")
    )
    if not target_url:
        return {"ok": False, "error": "Can cung cap login_url cho trang web nay."}

    err = _ensure_cdp_ready(cdp_url, user_data_dir, target_url)
    if err:
        return err

    try:
        from agent_runtime.cdp_pool import get_cdp_pool
    except ImportError:
        return {"ok": False, "error": "Missing cdp_pool module."}

    def _op(browser, context):
        page = context.pages[0] if context.pages else context.new_page()
        page.goto(target_url, wait_until="domcontentloaded", timeout=25000)
        time.sleep(2.5)
        if not _is_login_url(page.url):
            saved_flag = False
            if provided_inline:
                vault.save_credential(site=site, username=eff_user, password=eff_pass, login_url=target_url)
                saved_flag = True
            return {
                "ok": True,
                "already_logged_in": True,
                "saved_to_vault": saved_flag,
                "site": site,
                "username": eff_user,
                "url": page.url,
                "message": (
                    f"Da dang nhap san vao {site} ({eff_user})"
                    + (" va da tu dong luu ma hoa (Windows DPAPI) vao Kho Tai khoan Web." if saved_flag else ".")
                ),
            }
        res = _try_auto_login_on_page(page, site, username_override=eff_user, password_override=eff_pass)
        login_ok = bool(res.get("ok"))
        needs_2fa = bool(res.get("needs_2fa"))
        saved_flag = False
        if provided_inline and (login_ok or needs_2fa):
            vault.save_credential(site=site, username=eff_user, password=eff_pass, login_url=target_url)
            saved_flag = True
        return {
            "ok": login_ok,
            "saved_to_vault": saved_flag,
            "site": site,
            "username": eff_user,
            "url": page.url,
            "needs_2fa": needs_2fa,
            "message": (
                res.get("message")
                or (
                    f"Dang nhap thanh cong vao {site} ({eff_user})"
                    + (" va da tu dong ma hoa luu vao Kho Tai khoan Web (DPAPI)." if saved_flag else ".")
                    if login_ok
                    else "Chua vuot qua man hinh dang nhap (kiem tra lai user/pass hoac 2FA/CAPTCHA)."
                )
            ),
        }

    try:
        return get_cdp_pool().run(cdp_url, _op)
    except Exception as exc:
        return {"ok": False, "error": f"Auto-login failed: {type(exc).__name__}: {exc}"}


def open_and_read_page(
    url: str = "https://mail.google.com/mail/u/0/#inbox",
    cdp_url: str = "http://127.0.0.1:9222",
    user_data_dir: str = r"C:\ChromeAgentProfile",
    wait_sec: float = 3.0,
    max_chars: int = 6000,
) -> Dict[str, Any]:
    err = _ensure_cdp_ready(cdp_url, user_data_dir, url)
    if err:
        return err

    try:
        from agent_runtime.cdp_pool import get_cdp_pool
    except ImportError:
        return {"ok": False, "error": "Missing cdp_pool module."}

    def _op(browser, context):
        target_host = url.split("//", 1)[-1].split("/", 1)[0].lower()
        page = None
        for existing in context.pages:
            if target_host and target_host in (existing.url or "").lower():
                page = existing
                break
        if page is None:
            page = context.new_page()
            page.goto(url, wait_until="domcontentloaded", timeout=20000)
        else:
            if url and not (page.url or "").startswith(url.split("#")[0]):
                page.goto(url, wait_until="domcontentloaded", timeout=20000)

        time.sleep(max(0.5, min(float(wait_sec or 3.0), 10.0)))
        if _is_login_url(page.url):
            _try_auto_login_on_page(page, target_host)
            time.sleep(1.5)

        cur_url = page.url or ""
        title = page.title() or ""
        login_required = _is_login_url(cur_url)
        body_text = page.evaluate("() => (document.body && document.body.innerText) ? document.body.innerText : ''")
        text = (body_text or "").strip()[: max(500, int(max_chars or 6000))]
        return {
            "ok": True,
            "url": cur_url,
            "title": title,
            "login_required": login_required,
            "text": text,
            "note": (
                "Trang dang o man hinh dang nhap. Hay dang nhap 1 lan tren cua so Chrome hoac luu tai khoan vao Tab 3 -> Kho Tai khoan Web (Ma hoa DPAPI)."
                if login_required
                else "Extracted live page text from persistent Chrome CDP pool."
            ),
        }

    try:
        return get_cdp_pool().run(cdp_url, _op)
    except Exception as exc:
        return {"ok": False, "error": f"CDP read failed: {type(exc).__name__}: {exc}"}


def read_gmail_inbox(
    limit: int = 5,
    open_latest: bool = True,
    cdp_url: str = "http://127.0.0.1:9222",
    user_data_dir: str = r"C:\ChromeAgentProfile",
    wait_sec: float = 3.5,
) -> Dict[str, Any]:
    inbox_url = "https://mail.google.com/mail/u/0/#inbox"
    err = _ensure_cdp_ready(cdp_url, user_data_dir, inbox_url)
    if err:
        return err

    try:
        from agent_runtime.cdp_pool import get_cdp_pool
    except ImportError:
        return {"ok": False, "error": "Missing cdp_pool module."}

    lim = max(1, min(int(limit or 5), 20))

    def _op(browser, context):
        page = None
        for existing in context.pages:
            u = (existing.url or "").lower()
            if "mail.google.com" in u or "accounts.google.com" in u or "workspace.google.com" in u:
                page = existing
                break
        if page is None:
            page = context.new_page()
            page.goto(inbox_url, wait_until="domcontentloaded", timeout=25000)
        else:
            if "mail.google.com" not in (page.url or "").lower():
                page.goto(inbox_url, wait_until="domcontentloaded", timeout=25000)
            elif "#inbox" not in (page.url or "").lower():
                page.goto(inbox_url, wait_until="domcontentloaded", timeout=25000)

        try:
            page.wait_for_selector("tr.zA", timeout=int(max(2.5, float(wait_sec or 3.5)) * 1000))
        except Exception:
            pass

        cur_url = page.url or ""
        if _is_login_url(cur_url):
            login_res = _try_auto_login_on_page(page, "gmail")
            if login_res.get("attempted"):
                try:
                    page.wait_for_selector("tr.zA", timeout=6000)
                except Exception:
                    pass
                cur_url = page.url or ""
            if _is_login_url(cur_url):
                extra = f" ({login_res.get('message')})" if login_res.get("message") else ""
                return {
                    "ok": False,
                    "login_required": True,
                    "url": cur_url,
                    "cdp_url": cdp_url,
                    "user_data_dir": user_data_dir,
                    "error": (
                        f"Chrome Agent Profile ({user_data_dir}) chua vao duoc hop thu Gmail{extra}. "
                        "Hay hoan tat dang nhap / 2FA 1 lan tren cua so Chrome dang mo (hoac luu tai khoan vao Tab 3 -> Kho Tai khoan Web Ma hoa DPAPI), sau do hoi lai."
                    ),
                }

        rows = page.evaluate(
            """(lim) => {
                const trs = Array.from(document.querySelectorAll('tr.zA')).slice(0, lim);
                return trs.map((tr) => {
                    const senderEl = tr.querySelector('.yW span[email], .yW .yP, .yW .zF, .yW');
                    const subjEl = tr.querySelector('.bog, .y6 span');
                    const snipEl = tr.querySelector('.y2');
                    const timeEl = tr.querySelector('.xW span[title], .xW');
                    return {
                        sender: senderEl ? (senderEl.innerText || senderEl.getAttribute('email') || '').trim() : '',
                        subject: subjEl ? (subjEl.innerText || '').trim() : '',
                        snippet: snipEl ? (snipEl.innerText || '').replace(/^\\s*-\\s*/, '').trim() : '',
                        time: timeEl ? (timeEl.getAttribute('title') || timeEl.innerText || '').trim() : '',
                        unread: tr.classList.contains('zE'),
                    };
                });
            }""",
            lim,
        )

        latest_body = ""
        if open_latest and rows:
            try:
                first_row = page.locator("tr.zA").first
                first_row.click(timeout=4000)
                time.sleep(1.5)
                latest_body = page.evaluate(
                    """() => {
                        const bodies = Array.from(document.querySelectorAll('div.a3s, div.ii.gt'));
                        if (bodies.length > 0) {
                            return bodies.map(b => (b.innerText || '').trim()).filter(Boolean).join('\\n---\\n');
                        }
                        return (document.body && document.body.innerText) ? document.body.innerText : '';
                    }"""
                )
                latest_body = (latest_body or "").strip()[:3500]
            except Exception:
                latest_body = ""

        if not rows:
            fallback_text = page.evaluate("() => (document.body && document.body.innerText) ? document.body.innerText : ''")
            return {
                "ok": True,
                "url": cur_url,
                "emails": [],
                "fallback_text": (fallback_text or "").strip()[:3000],
                "note": "Gmail DOM rows (tr.zA) not detected; returned raw page text.",
            }

        return {
            "ok": True,
            "url": cur_url,
            "count": len(rows),
            "emails": rows,
            "latest_email_body": latest_body,
        }

    try:
        return get_cdp_pool().run(cdp_url, _op)
    except Exception as exc:
        return {"ok": False, "error": f"Gmail CDP read failed: {type(exc).__name__}: {exc}"}


def cdp_live_search(
    query: str,
    site: str = "google",
    limit: int = 5,
    cdp_url: str = "http://127.0.0.1:9222",
    user_data_dir: str = r"C:\ChromeAgentProfile",
    wait_sec: float = 4.0,
) -> Dict[str, Any]:
    """Last-Resort Web Search via real Chrome CDP (gets live active Shopee/Lazada/Tiki/Google/Bing links)."""
    import urllib.parse as _up

    q = (query or "").strip()
    if not q:
        return {"ok": False, "error": "Missing search query for cdp_live_search."}

    site_key = (site or "google").strip().lower()
    enc_q = _up.quote_plus(q)
    url_map = {
        "shopee": f"https://shopee.vn/search?keyword={_up.quote(q)}",
        "lazada": f"https://www.lazada.vn/catalog/?q={enc_q}",
        "tiki": f"https://tiki.vn/search?q={enc_q}",
        "bing": f"https://www.bing.com/search?q={enc_q}",
        "google": f"https://www.google.com/search?q={enc_q}",
    }
    target_url = url_map.get(site_key, url_map["google"])
    err = _ensure_cdp_ready(cdp_url, user_data_dir, target_url)
    if err:
        return err

    try:
        from agent_runtime.cdp_pool import get_cdp_pool
    except ImportError:
        return {"ok": False, "error": "Missing cdp_pool module."}

    lim = max(1, min(int(limit or 5), 10))

    def _op(browser, context):
        page = context.new_page()
        try:
            page.goto(target_url, wait_until="domcontentloaded", timeout=25000)
            time.sleep(max(1.5, min(float(wait_sec or 4.0), 8.0)))
            cur_url = page.url or target_url
            items = page.evaluate(
                """(args) => {
                    const { siteKey, lim } = args;
                    const out = [];
                    const seen = new Set();
                    const pushItem = (title, href, snippet) => {
                        const t = (title || '').replace(/\\s+/g, ' ').trim();
                        const u = (href || '').trim();
                        if (!t || t.length < 4 || !u.startsWith('http') || seen.has(u)) return;
                        seen.add(u);
                        out.push({ title: t.slice(0, 160), url: u, snippet: (snippet || '').slice(0, 220), source: 'chrome_cdp_' + siteKey, readable: true });
                    };
                    if (siteKey === 'shopee') {
                        const cards = Array.from(document.querySelectorAll('a[data-sqe="link"], a[href*="-i."], li.shopee-search-item-result__item a'));
                        for (const a of cards) {
                            const href = a.href || '';
                            if (!href.includes('shopee.vn')) continue;
                            const txt = (a.innerText || '').trim();
                            pushItem(txt.split('\\n')[0] || txt, href, txt);
                            if (out.length >= lim) break;
                        }
                    } else if (siteKey === 'google') {
                        const links = Array.from(document.querySelectorAll('div#search a h3'));
                        for (const h3 of links) {
                            const a = h3.closest('a');
                            if (!a || !a.href) continue;
                            const parent = a.closest('div.g, div.MjjYud') || a.parentElement;
                            pushItem(h3.innerText, a.href, parent ? parent.innerText : '');
                            if (out.length >= lim) break;
                        }
                    } else {
                        const anchors = Array.from(document.querySelectorAll('a[href]'));
                        for (const a of anchors) {
                            const href = a.href || '';
                            const txt = (a.innerText || '').trim();
                            if (txt.length >= 12 && href.startsWith('http') && !href.includes('javascript:')) {
                                pushItem(txt, href, '');
                                if (out.length >= lim) break;
                            }
                        }
                    }
                    return out;
                }""",
                {"siteKey": site_key, "lim": lim},
            )
            return {
                "ok": bool(items),
                "site": site_key,
                "query": q,
                "search_url": cur_url,
                "count": len(items or []),
                "results": items or [],
                "note": (
                    f"Lay duoc {len(items)} ket qua song truc tiep tu Chrome CDP ({site_key})."
                    if items
                    else f"Trang {site_key} co the yeu cau dang nhap/CAPTCHA tren Chrome Agent Profile ({cur_url})."
                ),
            }
        finally:
            try:
                page.close()
            except Exception:
                pass

    try:
        return get_cdp_pool().run(cdp_url, _op)
    except Exception as exc:
        return {"ok": False, "error": f"cdp_live_search failed: {type(exc).__name__}: {exc}"}


def execute(action: str = "read_gmail_inbox", **kwargs) -> Dict[str, Any]:
    if action == "read_gmail_inbox":
        return _safe_call(read_gmail_inbox, kwargs)
    elif action == "open_and_read_page":
        return _safe_call(open_and_read_page, kwargs)
    elif action == "cdp_live_search":
        return _safe_call(cdp_live_search, kwargs)
    elif action == "auto_login_site":
        return _safe_call(auto_login_site, kwargs)
    elif action == "list_saved_web_accounts":
        return _safe_call(list_saved_web_accounts, kwargs)
    elif action == "launch_agent_chrome":
        return _safe_call(launch_agent_chrome, kwargs)
    elif action == "build_chrome_debug_cmd":
        return _safe_call(build_chrome_debug_cmd, kwargs)
    elif action == "list_tabs":
        return _safe_call(list_tabs, kwargs)
    elif action == "extract_active_tab":
        return _safe_call(extract_active_tab, kwargs)
    else:
        return {"ok": False, "error": f"Invalid action: {action}"}


def _safe_call(fn, kw):
    import inspect as _insp

    sig = _insp.signature(fn)
    if any(p.kind == _insp.Parameter.VAR_KEYWORD for p in sig.parameters.values()):
        return fn(**kw)
    valid = {k: v for k, v in kw.items() if k in sig.parameters}
    return fn(**valid)
