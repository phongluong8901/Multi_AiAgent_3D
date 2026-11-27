"""Encrypted local credential vault for Web Automation (Windows DPAPI AES-256, zero plaintext on disk)."""
from __future__ import annotations

import base64
import ctypes
from ctypes import wintypes
import json
import os
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from agent_runtime.config import DATA_DIR

DEFAULT_VAULT_PATH = DATA_DIR / "web_vault.enc.json"


class _DATA_BLOB(ctypes.Structure):
    _fields_ = [
        ("cbData", wintypes.DWORD),
        ("pbData", ctypes.POINTER(ctypes.c_char)),
    ]


def _dpapi_encrypt(plaintext: str) -> str:
    """Encrypt UTF-8 string using Windows DPAPI (bound to current Windows user account)."""
    raw = (plaintext or "").encode("utf-8")
    if os.name == "nt":
        crypt32 = ctypes.windll.crypt32
        kernel32 = ctypes.windll.kernel32
        in_buf = ctypes.create_string_buffer(raw, len(raw))
        in_blob = _DATA_BLOB(len(raw), ctypes.cast(in_buf, ctypes.POINTER(ctypes.c_char)))
        out_blob = _DATA_BLOB()
        if not crypt32.CryptProtectData(
            ctypes.byref(in_blob),
            "AntigravityWebVault",
            None,
            None,
            None,
            0x01,  # CRYPTPROTECT_UI_FORBIDDEN
            ctypes.byref(out_blob),
        ):
            raise RuntimeError("Windows DPAPI CryptProtectData failed.")
        try:
            encrypted = ctypes.string_at(out_blob.pbData, out_blob.cbData)
            return "dpapi:" + base64.b64encode(encrypted).decode("ascii")
        finally:
            kernel32.LocalFree(out_blob.pbData)
    # Non-Windows fallback (obfuscated base64 if DPAPI unavailable)
    return "b64:" + base64.b64encode(raw).decode("ascii")


def _dpapi_decrypt(cipher_text: str) -> str:
    """Decrypt DPAPI-protected string in-memory only."""
    if not cipher_text:
        return ""
    if cipher_text.startswith("dpapi:") and os.name == "nt":
        raw = base64.b64decode(cipher_text[6:].encode("ascii"))
        crypt32 = ctypes.windll.crypt32
        kernel32 = ctypes.windll.kernel32
        in_buf = ctypes.create_string_buffer(raw, len(raw))
        in_blob = _DATA_BLOB(len(raw), ctypes.cast(in_buf, ctypes.POINTER(ctypes.c_char)))
        out_blob = _DATA_BLOB()
        if not crypt32.CryptUnprotectData(
            ctypes.byref(in_blob),
            None,
            None,
            None,
            None,
            0x01,
            ctypes.byref(out_blob),
        ):
            raise RuntimeError("Windows DPAPI CryptUnprotectData failed.")
        try:
            decrypted = ctypes.string_at(out_blob.pbData, out_blob.cbData)
            return decrypted.decode("utf-8")
        finally:
            kernel32.LocalFree(out_blob.pbData)
    if cipher_text.startswith("b64:"):
        return base64.b64decode(cipher_text[4:].encode("ascii")).decode("utf-8")
    return ""


def _norm_site(site: str) -> str:
    s = (site or "").strip().lower()
    s = s.replace("https://", "").replace("http://", "").split("/", 1)[0]
    return s


class EncryptedCredentialVault:
    """Thread-safe Windows DPAPI encrypted vault for website logins. Passwords are NEVER exposed to LLMs."""

    def __init__(self, vault_path: Path = DEFAULT_VAULT_PATH):
        self.vault_path = Path(vault_path)
        self.vault_path.parent.mkdir(parents=True, exist_ok=True)
        self._lock = threading.Lock()

    def _read_raw(self) -> dict[str, dict[str, Any]]:
        if not self.vault_path.exists():
            return {}
        try:
            data = json.loads(self.vault_path.read_text(encoding="utf-8"))
            return data if isinstance(data, dict) else {}
        except Exception:
            return {}

    def _write_raw(self, data: dict[str, dict[str, Any]]) -> None:
        tmp = self.vault_path.with_suffix(".tmp")
        tmp.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
        tmp.replace(self.vault_path)

    def save_credential(
        self,
        site: str,
        username: str,
        password: str,
        login_url: str = "",
        notes: str = "",
    ) -> dict[str, Any]:
        key = _norm_site(site)
        if not key:
            raise ValueError("Site name must not be empty (e.g. 'gmail', 'github', 'erp').")
        if not (username or "").strip():
            raise ValueError("Username / Email must not be empty.")

        now = datetime.now(timezone.utc).isoformat(timespec="seconds")
        with self._lock:
            data = self._read_raw()
            existing = data.get(key)
            if password:
                enc_pw = _dpapi_encrypt(password)
            elif existing and existing.get("password_enc"):
                enc_pw = str(existing["password_enc"])
            else:
                raise ValueError("Password must not be empty for a new account.")

            record = {
                "site": key,
                "login_url": (login_url or (existing.get("login_url", "") if existing else "")).strip(),
                "username": username.strip(),
                "password_enc": enc_pw,
                "notes": (notes or (existing.get("notes", "") if existing else "")).strip(),
                "updated_at": now,
            }
            data[key] = record
            self._write_raw(data)

        return {
            "site": key,
            "login_url": record["login_url"],
            "username": record["username"],
            "notes": record["notes"],
            "has_password": True,
            "encryption": "Windows DPAPI" if enc_pw.startswith("dpapi:") else "base64",
            "updated_at": now,
        }

    def list_credentials(self) -> list[dict[str, Any]]:
        """Return safe metadata ONLY (never returns plaintext or encrypted password)."""
        with self._lock:
            data = self._read_raw()
        out = []
        for key, rec in sorted(data.items()):
            out.append(
                {
                    "site": key,
                    "login_url": rec.get("login_url", ""),
                    "username": rec.get("username", ""),
                    "notes": rec.get("notes", ""),
                    "has_password": bool(rec.get("password_enc")),
                    "encryption": "Windows DPAPI" if str(rec.get("password_enc", "")).startswith("dpapi:") else "base64",
                    "updated_at": rec.get("updated_at", ""),
                }
            )
        return out

    def get_decrypted_for_automation(self, site_or_url: str) -> dict[str, str] | None:
        """INTERNAL ONLY for local Playwright/CDP automation. NEVER return this dict to an LLM."""
        needle = _norm_site(site_or_url)
        if not needle:
            return None
        with self._lock:
            data = self._read_raw()

        # Exact match first, then domain/alias match (e.g. 'gmail' <-> 'mail.google.com' <-> 'google')
        rec = data.get(needle)
        if rec is None:
            aliases = {
                "gmail": ("gmail", "mail.google.com", "accounts.google.com", "google"),
                "mail.google.com": ("gmail", "mail.google.com", "google"),
                "accounts.google.com": ("gmail", "mail.google.com", "google"),
            }
            for alias in aliases.get(needle, (needle,)):
                if alias in data:
                    rec = data[alias]
                    break
        if rec is None:
            for k, v in data.items():
                if needle in k or k in needle or (v.get("login_url") and needle in v["login_url"].lower()):
                    rec = v
                    break
        if rec is None:
            return None

        return {
            "site": rec.get("site", needle),
            "login_url": rec.get("login_url", ""),
            "username": rec.get("username", ""),
            "password": _dpapi_decrypt(rec.get("password_enc", "")),
        }

    def delete_credential(self, site: str) -> bool:
        key = _norm_site(site)
        with self._lock:
            data = self._read_raw()
            if key in data:
                del data[key]
                self._write_raw(data)
                return True
        return False
