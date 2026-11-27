import os
import re
import shutil
import sqlite3
import tempfile
import time
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List

try:
    import psutil
except ImportError:
    raise RuntimeError("Missing package psutil. Please install it via pip install psutil")


def _filetime_to_iso(ft: int | None) -> str:
    """Convert Windows FILETIME (100-ns ticks since 1601-01-01 UTC) to local UTC+7 ISO string."""
    if not ft or int(ft) <= 0:
        return ""
    try:
        epoch_1601 = datetime(1601, 1, 1, tzinfo=timezone.utc)
        dt_utc = epoch_1601 + timedelta(microseconds=int(ft) / 10.0)
        dt_vn = dt_utc.astimezone(timezone(timedelta(hours=7)))
        return dt_vn.strftime("%Y-%m-%d %H:%M:%S")
    except Exception:
        return ""


def _parse_toast_xml(payload: bytes | str) -> Dict[str, str]:
    """Extract title (sender) and body lines from a Windows Toast Notification XML payload."""
    if not payload:
        return {}
    try:
        raw = payload.decode("utf-8", errors="replace") if isinstance(payload, (bytes, bytearray)) else str(payload)
        root = ET.fromstring(raw)
        texts = [(el.text or "").strip() for el in root.iter("text") if (el.text or "").strip()]
        if not texts:
            return {}
        return {
            "sender": texts[0],
            "message": " | ".join(texts[1:]) if len(texts) > 1 else "",
        }
    except Exception:
        return {}


class ZaloNotificationReader:
    """Doc thong bao / tin nhan chua doc Zalo theo 3 tang uu tien:
    C1: Zalo Web (Chrome CDP chay an + tu dong luu login DPAPI) ->
    C2: Windows Notification Center (wpndatabase.db, chay an 100%) ->
    C3: Chup cua so Zalo Desktop cho Gemini Vision (xong tu tra ve trang thai cua so ban dau).
    """

    def __init__(self, output_dir: str = "outputs"):
        self.output_dir = output_dir
        os.makedirs(self.output_dir, exist_ok=True)

    def _check_zalo_process(self) -> bool:
        for proc in psutil.process_iter(["name"]):
            try:
                name = proc.info.get("name")
                if name and "zalo" in name.lower():
                    return True
            except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
                continue
        return False

    # ------------------------------------------------------------------
    # C1: Zalo Web via persistent Chrome CDP (headless=new + Vault login)
    # ------------------------------------------------------------------
    def _try_c1_zalo_web_cdp(
        self,
        cdp_url: str = "http://127.0.0.1:9222",
        user_data_dir: str = r"C:\ChromeAgentProfile",
        username: str = "",
        password: str = "",
    ) -> Dict[str, Any]:
        try:
            from agent_runtime.cdp_pool import get_cdp_pool
            from agent_runtime.credential_vault import EncryptedCredentialVault
            from skills.automationPc_skills import skill_browser_cdp_controller as cdp
        except ImportError as exc:
            return {"ok": False, "reason": f"missing_runtime_dep: {exc}"}

        err = cdp._ensure_cdp_ready(cdp_url, user_data_dir, "https://chat.zalo.me/")
        if err:
            return {"ok": False, "reason": err.get("error", "cdp_unavailable")}

        vault = EncryptedCredentialVault()
        provided_inline = bool((username or "").strip() and (password or ""))
        cred = vault.get_decrypted_for_automation("zalo") if not provided_inline else None
        eff_user = username.strip() if provided_inline else (cred["username"] if cred else "")
        eff_pass = password if provided_inline else (cred["password"] if cred else "")

        def _op(browser, context):
            page = None
            for p_tab in context.pages:
                u = (p_tab.url or "").lower()
                if "chat.zalo.me" in u or "id.zalo.me" in u:
                    page = p_tab
                    break
            if page is None:
                page = context.new_page()
                page.goto("https://chat.zalo.me/", wait_until="domcontentloaded", timeout=20000)
            elif "chat.zalo.me" not in (page.url or "").lower():
                page.goto("https://chat.zalo.me/", wait_until="domcontentloaded", timeout=20000)

            time.sleep(2.5)
            cur_url = (page.url or "").lower()

            # If redirected to Zalo login page and we have credentials, try phone+password login
            if "id.zalo.me" in cur_url and eff_user and eff_pass:
                try:
                    pw_tab = page.locator("a:has-text('Với mật khẩu'), a:has-text('With password'), li:has-text('mật khẩu')").first
                    if pw_tab.count() > 0:
                        pw_tab.click(timeout=3000)
                        time.sleep(0.6)
                    u_inp = page.locator("input[name='phone_num'], input[type='tel'], input[type='text']").first
                    p_inp = page.locator("input[type='password']").first
                    if u_inp.count() > 0 and p_inp.count() > 0:
                        u_inp.fill(eff_user, timeout=3000)
                        p_inp.fill(eff_pass, timeout=3000)
                        p_inp.press("Enter")
                        time.sleep(3.5)
                        cur_url = (page.url or "").lower()
                except Exception:
                    pass

            if "id.zalo.me" in cur_url:
                return {"ok": False, "login_required": True, "url": page.url}

            saved_flag = False
            if provided_inline:
                vault.save_credential(
                    site="zalo",
                    username=eff_user,
                    password=eff_pass,
                    login_url="https://chat.zalo.me/",
                )
                saved_flag = True

            dom_probe = page.evaluate(
                """() => {
                    const bodyTxt = ((document.body && document.body.innerText) || '').toLowerCase();
                    const looksLikeLogin = (
                        bodyTxt.includes('quét mã qr') ||
                        bodyTxt.includes('quet ma qr') ||
                        bodyTxt.includes('đăng nhập zalo') ||
                        bodyTxt.includes('với mã qr') ||
                        bodyTxt.includes('với mật khẩu') ||
                        bodyTxt.includes('log in with qr')
                    );
                    const convs = Array.from(document.querySelectorAll('.msg-item, .conv-item, [data-id^="div_LastMsg"]'));
                    const unread = [];
                    for (const c of convs) {
                        const badge = c.querySelector('.n-badge, .unread-count, .fa-num, [class*="unread"]');
                        if (badge && (badge.innerText || '').trim()) {
                            const nameEl = c.querySelector('.conv-item-title__name, .conv-title, .name, .truncate');
                            const msgEl = c.querySelector('.conv-message, .conv-snippet, .message');
                            unread.push({
                                sender: nameEl ? (nameEl.innerText || '').trim() : 'Unknown',
                                message: msgEl ? (msgEl.innerText || '').trim() : '',
                                unread_count: (badge.innerText || '').trim(),
                            });
                        }
                    }
                    return { looksLikeLogin, totalConvs: convs.length, unread };
                }"""
            )
            if dom_probe.get("looksLikeLogin") or int(dom_probe.get("totalConvs") or 0) == 0:
                return {
                    "ok": False,
                    "login_required": True,
                    "url": page.url,
                    "reason": "zalo_web_qr_or_empty_conv_list",
                }

            items = dom_probe.get("unread") or []
            return {
                "ok": True,
                "source": "c1_zalo_web_cdp_headless",
                "saved_to_vault": saved_flag,
                "total_conversations_loaded": int(dom_probe.get("totalConvs") or 0),
                "unread_count": len(items),
                "unread_items": items,
                "message": (
                    f"[C1 - Zalo Web chay an] Da xac nhan dang nhap ({dom_probe.get('totalConvs')} hoi thoai), "
                    f"tim thay {len(items)} hoi thoai chua doc."
                    + (" Da tu dong luu ma hoa (DPAPI) vao Kho Tai khoan Web." if saved_flag else "")
                ),
            }

        try:
            return get_cdp_pool().run(cdp_url, _op)
        except Exception as exc:
            return {"ok": False, "reason": f"cdp_error: {type(exc).__name__}: {exc}"}

    # ------------------------------------------------------------------
    # C2: Windows Notification Center (wpndatabase.db — 100% silent)
    # ------------------------------------------------------------------
    def _try_c2_windows_notifications(self, limit: int = 10) -> Dict[str, Any]:
        db_src = os.path.expandvars(r"%LOCALAPPDATA%\Microsoft\Windows\Notifications\wpndatabase.db")
        if not os.path.isfile(db_src):
            return {"ok": False, "reason": "wpndatabase_not_found"}

        tmp_dir = tempfile.mkdtemp(prefix="zalo_wpn_")
        try:
            db_copy = os.path.join(tmp_dir, "wpndatabase.db")
            shutil.copy2(db_src, db_copy)
            for suffix in ("-wal", "-shm"):
                aux = db_src + suffix
                if os.path.isfile(aux):
                    try:
                        shutil.copy2(aux, db_copy + suffix)
                    except Exception:
                        pass

            conn = sqlite3.connect(f"file:{db_copy}?mode=ro", uri=True, timeout=5.0)
            try:
                rows = conn.execute(
                    """
                    SELECT n.Payload, n.ArrivalTime, h.PrimaryId
                    FROM Notification n
                    LEFT JOIN NotificationHandler h ON n.HandlerId = h.RecordId
                    WHERE lower(COALESCE(h.PrimaryId, '')) LIKE '%zalo%'
                       OR lower(CAST(n.Payload AS TEXT)) LIKE '%zalo%'
                    ORDER BY n.ArrivalTime DESC
                    LIMIT ?
                    """,
                    (max(1, min(int(limit or 10), 30)),),
                ).fetchall()
            finally:
                conn.close()

            items: List[Dict[str, Any]] = []
            for payload, arrival_ft, primary_id in rows:
                parsed = _parse_toast_xml(payload)
                if parsed:
                    items.append(
                        {
                            "sender": parsed.get("sender", "Zalo"),
                            "message": parsed.get("message", ""),
                            "time": _filetime_to_iso(arrival_ft),
                            "app_id": str(primary_id or "Zalo"),
                        }
                    )

            if not items:
                return {"ok": False, "reason": "no_zalo_toast_in_action_center"}

            return {
                "ok": True,
                "source": "c2_windows_notification_center_silent",
                "unread_count": len(items),
                "unread_items": items,
                "message": f"[C2 - Windows Notification Center chay an] Tim thay {len(items)} thong bao Zalo gan day.",
            }
        except Exception as exc:
            return {"ok": False, "reason": f"wpn_read_error: {type(exc).__name__}: {exc}"}
        finally:
            shutil.rmtree(tmp_dir, ignore_errors=True)

    # ------------------------------------------------------------------
    # C3: Zalo Desktop Window Snapshot + Vision (restores original window state!)
    # ------------------------------------------------------------------
    def _try_c3_zalo_desktop_vision(self) -> Dict[str, Any]:
        if not self._check_zalo_process():
            return {"ok": False, "zalo_desktop_running": False, "error": "Zalo Desktop khong chay."}

        try:
            import pygetwindow as gw
        except ImportError:
            return {"ok": False, "error": "Missing package pygetwindow."}

        zalo_win = None
        for w in gw.getAllWindows():
            title = (w.title or "").strip()
            low = title.lower()
            if "zalo" in low and not any(b in low for b in ("chrome", "edge", "firefox", "visual studio", "antigravity")):
                zalo_win = w
                break

        if zalo_win is None:
            return {
                "ok": False,
                "zalo_desktop_running": True,
                "error": (
                    "Zalo Desktop dang an trong khay he thong (System Tray) va chua co thong bao nao trong Windows Action Center. "
                    "Hay dang nhap chat.zalo.me 1 lan tren Chrome Agent (9222) de doc ngam vinh vien."
                ),
            }

        prev_active = None
        try:
            prev_active = gw.getActiveWindow()
        except Exception:
            prev_active = None

        was_minimized = bool(getattr(zalo_win, "isMinimized", False))
        title = (zalo_win.title or "").strip()
        m_cnt = re.search(r"\((\d+)\)", title)
        title_unread = int(m_cnt.group(1)) if m_cnt else None
        screenshot_path = os.path.join(self.output_dir, "zalo_desktop_notifications.png")

        try:
            if was_minimized:
                zalo_win.restore()
                time.sleep(0.45)
            zalo_win.activate()
            time.sleep(0.35)

            import mss
            from PIL import Image

            left = max(0, int(zalo_win.left))
            top = max(0, int(zalo_win.top))
            width = max(320, int(zalo_win.width))
            height = max(320, int(zalo_win.height))
            with mss.mss() as sct:
                raw = sct.grab({"left": left, "top": top, "width": width, "height": height})
                img = Image.frombytes("RGB", raw.size, raw.bgra, "raw", "BGRX")
                if img.width > 1400:
                    ratio = 1400 / float(img.width)
                    img = img.resize((1400, int(img.height * ratio)))
                img.save(screenshot_path, format="PNG")
        except Exception as exc:
            return {
                "ok": False,
                "window_title": title,
                "title_unread_count": title_unread,
                "error": f"Khong chup duoc cua so Zalo Desktop: {exc}",
            }
        finally:
            # Always restore Zalo & previous active window to original state immediately!
            try:
                if was_minimized:
                    zalo_win.minimize()
                if prev_active is not None and prev_active != zalo_win:
                    prev_active.activate()
            except Exception:
                pass

        return {
            "ok": True,
            "source": "c3_zalo_desktop_vision_restored",
            "zalo_desktop_running": True,
            "window_title": title,
            "title_unread_count": title_unread,
            "restored_previous_state": True,
            "screenshot_path": screenshot_path,
            "message": (
                f"[C3 - Zalo Desktop Vision, da tu tra cua so ve trang thai ban dau] "
                f"Tieu de: '{title}'. HAY NHIN TRUC TIEP ANH DINH KEM de doc chinh xac cac cham do/tin chua doc!"
            ),
        }

    def get_unread_notifications(
        self,
        username: str = "",
        password: str = "",
        limit: int = 10,
    ) -> Dict[str, Any]:
        """Doc thong bao / tin nhan Zalo chua doc theo thu tu uu tien: C1 (Zalo Web chay an + Vault) -> C2 (Windows Action Center chay an) -> C3 (Zalo Desktop Vision + tra lai trang thai cua so)."""
        fallback_notes: List[str] = []

        # Tier C1: Zalo Web via persistent Chrome CDP (headless + Vault)
        c1 = self._try_c1_zalo_web_cdp(username=username, password=password)
        if c1.get("ok"):
            return c1
        fallback_notes.append(f"C1(Web CDP): {'chua dang nhap chat.zalo.me' if c1.get('login_required') else c1.get('reason', 'skip')}")

        # Tier C2: Windows Notification Center (wpndatabase.db — 100% silent)
        c2 = self._try_c2_windows_notifications(limit=limit)
        if c2.get("ok"):
            c2["fallback_trace"] = fallback_notes
            return c2
        fallback_notes.append(f"C2(Windows Notifications): {c2.get('reason', 'empty')}")

        # Tier C3: Zalo Desktop window capture + Gemini Vision (restores window state in finally)
        c3 = self._try_c3_zalo_desktop_vision()
        c3["fallback_trace"] = fallback_notes
        return c3
