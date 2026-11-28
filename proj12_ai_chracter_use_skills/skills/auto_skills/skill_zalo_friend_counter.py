import os
import re
import time
from typing import Any, Dict

try:
    import psutil
except ImportError:
    raise RuntimeError("Missing package psutil. Please install it via pip install psutil")


class ZaloFriendCounter:
    """Thong ke tong so luong ban be Zalo tu ca 2 nguon:
    1) Zalo Web chay an qua Chrome CDP (C:\\ChromeAgentProfile cong 9222),
    2) Truc tiep tren app Zalo Desktop Windows (click tab Danh ba -> chup anh gui Gemini Vision -> tra cua so ve trang thai ban dau).
    """

    def __init__(self, output_dir: str = "outputs") -> None:
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

    def _try_zalo_web_cdp(
        self,
        cdp_url: str = "http://127.0.0.1:9222",
        user_data_dir: str = r"C:\ChromeAgentProfile",
    ) -> Dict[str, Any]:
        try:
            from agent_runtime.cdp_pool import get_cdp_pool
            from skills.automationPc_skills import skill_browser_cdp_controller as cdp
        except ImportError as exc:
            return {"ok": False, "reason": f"missing_dep: {exc}"}

        err = cdp._ensure_cdp_ready(cdp_url, user_data_dir, "https://chat.zalo.me/")
        if err:
            return {"ok": False, "reason": err.get("error", "cdp_unavailable")}

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
            probe = page.evaluate(
                """() => {
                    const txt = ((document.body && document.body.innerText) || '').toLowerCase();
                    const isLogin = txt.includes('quét mã qr') || txt.includes('đăng nhập zalo') || txt.includes('với mật khẩu');
                    return { isLogin, url: location.href };
                }"""
            )
            if probe.get("isLogin") or "id.zalo.me" in str(probe.get("url", "")).lower():
                return {"ok": False, "login_required": True, "reason": "zalo_web_not_logged_in"}

            # Click Contacts / Danh bạ tab on left sidebar
            clicked = page.evaluate(
                """() => {
                    const sels = [
                        '[data-id="div_Main_TabContact"]',
                        '[title*="Danh bạ"]',
                        '[title*="Contacts"]',
                        '.fa-Contact_28_Line',
                        '#contactTab'
                    ];
                    for (const s of sels) {
                        const el = document.querySelector(s);
                        if (el) { el.click(); return s; }
                    }
                    return '';
                }"""
            )
            if clicked:
                time.sleep(1.5)

            data = page.evaluate(
                """() => {
                    const txt = (document.body && document.body.innerText) || '';
                    const m = txt.match(/(?:Bạn bè|Friends)\\s*\\((\\d+)\\)/i);
                    const countFromHeader = m ? parseInt(m[1], 10) : null;
                    const names = Array.from(document.querySelectorAll('.contact-item .name, .friend-item .name, .contact-item-v2 .name'))
                        .map(el => (el.innerText || '').trim())
                        .filter(Boolean)
                        .slice(0, 20);
                    return { countFromHeader, sampleNames: names };
                }"""
            )
            total = data.get("countFromHeader")
            if total is None:
                return {"ok": False, "reason": "contacts_header_not_found_in_dom"}

            return {
                "ok": True,
                "source": "zalo_web_cdp_headless",
                "total_friends": int(total),
                "sample_friends": data.get("sampleNames") or [],
                "message": f"[Zalo Web CDP chay an] Tong so ban be Zalo: {total}.",
            }

        try:
            return get_cdp_pool().run(cdp_url, _op)
        except Exception as exc:
            return {"ok": False, "reason": f"cdp_error: {type(exc).__name__}: {exc}"}

    def _try_zalo_desktop_app(self) -> Dict[str, Any]:
        """Read friend count directly from Windows Zalo Desktop app (click Contacts tab -> capture for Vision -> restore window)."""
        if not self._check_zalo_process():
            return {"ok": False, "error": "Ung dung Zalo Desktop hien khong chay."}

        try:
            import pygetwindow as gw
            import pyautogui
            import mss
            from PIL import Image
        except ImportError as exc:
            return {"ok": False, "error": f"Thieu thu vien Desktop automation: {exc}"}

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
                "error": (
                    "Zalo Desktop dang an duoi khay he thong (System Tray) nen khong co cua so. "
                    "Hay mo cua so Zalo Desktop (hoac dang nhap chat.zalo.me 1 lan tren Chrome Agent 9222)."
                ),
            }

        prev_active = None
        try:
            prev_active = gw.getActiveWindow()
        except Exception:
            prev_active = None

        was_minimized = bool(getattr(zalo_win, "isMinimized", False))
        screenshot_path = os.path.join(self.output_dir, "zalo_desktop_friends.png")

        try:
            if was_minimized:
                zalo_win.restore()
                time.sleep(0.45)
            zalo_win.activate()
            time.sleep(0.35)

            left = max(0, int(zalo_win.left))
            top = max(0, int(zalo_win.top))
            width = max(400, int(zalo_win.width))
            height = max(400, int(zalo_win.height))

            # Click the Contacts (Danh ba) icon on Zalo Desktop's left blue nav rail (2nd icon below avatar)
            contact_x = left + 32
            contact_y = top + 165
            pyautogui.click(contact_x, contact_y)
            time.sleep(0.75)

            with mss.mss() as sct:
                raw = sct.grab({"left": left, "top": top, "width": width, "height": height})
                img = Image.frombytes("RGB", raw.size, raw.bgra, "raw", "BGRX")
                if img.width > 1400:
                    ratio = 1400 / float(img.width)
                    img = img.resize((1400, int(img.height * ratio)))
                img.save(screenshot_path, format="PNG")
        except Exception as exc:
            return {"ok": False, "error": f"Khong thao tac duoc cua so Zalo Desktop: {exc}"}
        finally:
            # Return back to Chat tab (1st icon) or restore window state immediately
            try:
                if was_minimized:
                    zalo_win.minimize()
                if prev_active is not None and prev_active != zalo_win:
                    prev_active.activate()
            except Exception:
                pass

        return {
            "ok": True,
            "source": "zalo_desktop_app_vision",
            "restored_previous_state": True,
            "screenshot_path": screenshot_path,
            "message": (
                "Da mo tab Danh ba tren ung dung Zalo Desktop, chup anh va tu dong tra cua so ve trang thai ban dau. "
                "HAY NHIN TRUC TIEP ANH DINH KEM de doc con so 'Ban be (N)' (hoac 'Danh sach ban be') chinh xac!"
            ),
        }

    def count_and_get_friends(self) -> Dict[str, Any]:
        """Thong ke so luong ban be Zalo: uu tien Zalo Web chay an (Chrome CDP) -> fallback sang app Zalo Desktop (Vision)."""
        c1 = self._try_zalo_web_cdp()
        if c1.get("ok"):
            return c1
        c2 = self._try_zalo_desktop_app()
        c2["web_cdp_note"] = c1.get("reason", "not_logged_in")
        return c2
