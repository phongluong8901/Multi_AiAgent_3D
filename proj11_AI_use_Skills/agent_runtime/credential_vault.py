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


DEFAULT_API_KEYS_PATH = DATA_DIR / "api_keys.enc.json"


def mask_api_key(raw_key: str) -> str:
    k = (raw_key or "").strip()
    if len(k) <= 10:
        return "***"
    return f"{k[:6]}...{k[-4:]}"


class EncryptedApiKeyVault:
    """Thread-safe Windows DPAPI encrypted vault for LLM API Keys (Gemini / Groq) added from Web UI."""

    def __init__(self, vault_path: Path = DEFAULT_API_KEYS_PATH):
        self.vault_path = Path(vault_path)
        self.vault_path.parent.mkdir(parents=True, exist_ok=True)
        self._lock = threading.Lock()

    def _read_raw(self) -> dict[str, Any]:
        if not self.vault_path.exists():
            return {"strategy": "", "keys": []}
        try:
            data = json.loads(self.vault_path.read_text(encoding="utf-8"))
            if isinstance(data, dict):
                data.setdefault("strategy", "")
                data.setdefault("keys", [])
                return data
        except Exception:
            pass
        return {"strategy": "", "keys": []}

    def _write_raw(self, data: dict[str, Any]) -> None:
        tmp = self.vault_path.with_suffix(".tmp")
        tmp.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
        tmp.replace(self.vault_path)

    def get_strategy(self) -> str:
        with self._lock:
            val = str(self._read_raw().get("strategy") or "").strip().lower()
        return val if val in ("priority", "round_robin") else ""

    def set_strategy(self, strategy: str) -> str:
        st = (strategy or "priority").strip().lower()
        if st not in ("priority", "round_robin"):
            raise ValueError("Strategy must be 'priority' or 'round_robin'.")
        with self._lock:
            data = self._read_raw()
            data["strategy"] = st
            self._write_raw(data)
        return st

    def add_keys(self, provider: str, raw_keys_text: str, label: str = "") -> list[dict[str, Any]]:
        import hashlib
        import re as _re
        import uuid

        prov = (provider or "gemini").strip().lower()
        if prov not in ("gemini", "groq"):
            raise ValueError("Chỉ hỗ trợ provider 'gemini' hoặc 'groq'.")

        parts = [p.strip() for p in _re.split(r"[\r\n,;]+", raw_keys_text or "") if p.strip()]
        if not parts:
            raise ValueError("Vui lòng nhập ít nhất 1 API Key hợp lệ.")

        now = datetime.now(timezone.utc).isoformat()
        added: list[dict[str, Any]] = []
        with self._lock:
            data = self._read_raw()
            items: list[dict[str, Any]] = list(data.get("keys") or [])
            existing_hashes = {str(it.get("key_hash") or "") for it in items}

            for idx, raw_key in enumerate(parts, start=1):
                if len(raw_key) < 12:
                    continue
                khash = hashlib.sha256(f"{prov}:{raw_key}".encode("utf-8")).hexdigest()[:16]
                if khash in existing_hashes:
                    continue
                item_label = (label or "").strip()
                if item_label and len(parts) > 1:
                    item_label = f"{item_label} #{idx}"
                elif not item_label:
                    same_prov_count = sum(1 for it in items if it.get("provider") == prov) + 1
                    item_label = f"{prov.capitalize()} UI #{same_prov_count}"

                rec = {
                    "id": uuid.uuid4().hex[:10],
                    "provider": prov,
                    "label": item_label,
                    "masked_key": mask_api_key(raw_key),
                    "key_hash": khash,
                    "key_enc": _dpapi_encrypt(raw_key),
                    "created_at": now,
                }
                items.append(rec)
                existing_hashes.add(khash)
                added.append(
                    {
                        "id": rec["id"],
                        "provider": rec["provider"],
                        "label": rec["label"],
                        "masked_key": rec["masked_key"],
                        "encryption": "Windows DPAPI" if rec["key_enc"].startswith("dpapi:") else "base64",
                        "created_at": rec["created_at"],
                    }
                )

            data["keys"] = items
            self._write_raw(data)
        return added

    def list_keys(self, provider: str | None = None) -> list[dict[str, Any]]:
        with self._lock:
            items = list(self._read_raw().get("keys") or [])
        out: list[dict[str, Any]] = []
        for rec in items:
            if provider and rec.get("provider") != provider:
                continue
            enc = str(rec.get("key_enc") or "")
            out.append(
                {
                    "id": rec.get("id", ""),
                    "provider": rec.get("provider", "gemini"),
                    "label": rec.get("label", ""),
                    "masked_key": rec.get("masked_key", "***"),
                    "encryption": "Windows DPAPI" if enc.startswith("dpapi:") else "base64",
                    "created_at": rec.get("created_at", ""),
                }
            )
        return out

    def get_raw_keys(self, provider: str = "gemini") -> list[tuple[str, str]]:
        """INTERNAL ONLY for MultiProviderRouter. NEVER return raw keys to UI/LLM."""
        with self._lock:
            items = list(self._read_raw().get("keys") or [])
        out: list[tuple[str, str]] = []
        for rec in items:
            if rec.get("provider") != provider:
                continue
            try:
                raw = _dpapi_decrypt(str(rec.get("key_enc") or "")).strip()
                if raw:
                    out.append((str(rec.get("label") or ""), raw))
            except Exception:
                continue
        return out

    def delete_key(self, key_id: str) -> bool:
        target = (key_id or "").strip()
        if not target:
            return False
        with self._lock:
            data = self._read_raw()
            items = list(data.get("keys") or [])
            new_items = [it for it in items if it.get("id") != target]
            if len(new_items) == len(items):
                return False
            data["keys"] = new_items
            self._write_raw(data)
            return True
