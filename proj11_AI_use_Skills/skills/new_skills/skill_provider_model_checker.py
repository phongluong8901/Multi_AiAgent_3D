"""Live model discovery and health-check tool for Gemini, Groq, and Cloudflare Workers AI."""
from __future__ import annotations

import os
import time
from pathlib import Path
from typing import Any

import httpx
from dotenv import load_dotenv

_ENV_PATH = Path(__file__).resolve().parents[2] / ".env"


def _load_env() -> None:
    load_dotenv(_ENV_PATH)


def _get_cf_account_id(token: str) -> str:
    acc = os.environ.get("CLOUDFLARE_ACCOUNT_ID", "").strip()
    if acc:
        return acc
    try:
        r = httpx.get(
            "https://api.cloudflare.com/client/v4/accounts",
            headers={"Authorization": f"Bearer {token}"},
            timeout=10.0,
        )
        if r.status_code == 200:
            res = r.json().get("result") or []
            if res and isinstance(res, list) and res[0].get("id"):
                return str(res[0]["id"])
    except Exception:
        pass
    return ""


class ProviderModelCheckerClient:
    """List live available models and ping-check specific model IDs on Gemini, Groq, and Cloudflare."""

    def list_models(self, provider: str = "all", filter_text: str = "") -> dict[str, Any]:
        """Fetch live model IDs from provider APIs ('gemini', 'groq', 'cloudflare', or 'all')."""
        _load_env()
        target = (provider or "all").strip().lower()
        flt = (filter_text or "").strip().lower()
        targets = ["gemini", "groq", "cloudflare"] if target == "all" else [target]

        out: dict[str, Any] = {}
        for p in targets:
            if p == "gemini":
                out["gemini"] = self._list_gemini(flt)
            elif p == "groq":
                out["groq"] = self._list_groq(flt)
            elif p == "cloudflare":
                out["cloudflare"] = self._list_cloudflare(flt)
            else:
                out[p] = {"ok": False, "error": f"Unsupported provider: {p}"}
        return out

    def check_model(self, provider: str, model_id: str) -> dict[str, Any]:
        """Send a minimal live ping to verify whether a specific model_id works on Gemini, Groq, or Cloudflare."""
        _load_env()
        p = (provider or "").strip().lower()
        mid = (model_id or "").strip()
        if not mid:
            raise ValueError("model_id khong duoc rong")

        t0 = time.perf_counter()
        try:
            if p == "gemini":
                key = os.environ.get("GEMINI_API_KEY", "").strip()
                if not key:
                    return {"ok": False, "provider": p, "model_id": mid, "error": "Missing GEMINI_API_KEY"}
                url = f"https://generativelanguage.googleapis.com/v1beta/models/{mid}:generateContent?key={key}"
                r = httpx.post(
                    url,
                    json={"contents": [{"parts": [{"text": "Reply OK"}]}]},
                    timeout=20.0,
                )
            elif p == "groq":
                key = os.environ.get("GROQ_API_KEY", "").strip()
                if not key:
                    return {"ok": False, "provider": p, "model_id": mid, "error": "Missing GROQ_API_KEY"}
                r = httpx.post(
                    "https://api.groq.com/openai/v1/chat/completions",
                    headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
                    json={"model": mid, "messages": [{"role": "user", "content": "Reply OK"}], "max_tokens": 8},
                    timeout=20.0,
                )
            elif p == "cloudflare":
                token = os.environ.get("CLOUDFLARE_API_TOKEN", "").strip()
                acc = _get_cf_account_id(token) if token else ""
                if not token or not acc:
                    return {
                        "ok": False,
                        "provider": p,
                        "model_id": mid,
                        "error": "Missing CLOUDFLARE_API_TOKEN or CLOUDFLARE_ACCOUNT_ID",
                    }
                url = f"https://api.cloudflare.com/client/v4/accounts/{acc}/ai/v1/chat/completions"
                r = httpx.post(
                    url,
                    headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
                    json={"model": mid, "messages": [{"role": "user", "content": "Reply OK"}], "max_tokens": 8},
                    timeout=25.0,
                )
            else:
                return {"ok": False, "provider": p, "model_id": mid, "error": f"Unsupported provider: {p}"}

            ms = int((time.perf_counter() - t0) * 1000)
            if r.status_code == 200:
                return {"ok": True, "provider": p, "model_id": mid, "status": "AVAILABLE", "latency_ms": ms}
            return {
                "ok": False,
                "provider": p,
                "model_id": mid,
                "status": f"HTTP_{r.status_code}",
                "latency_ms": ms,
                "error": r.text[:220],
            }
        except Exception as exc:
            ms = int((time.perf_counter() - t0) * 1000)
            return {
                "ok": False,
                "provider": p,
                "model_id": mid,
                "status": "ERROR",
                "latency_ms": ms,
                "error": f"{type(exc).__name__}: {exc}",
            }

    def _list_gemini(self, flt: str) -> dict[str, Any]:
        key = os.environ.get("GEMINI_API_KEY", "").strip()
        if not key:
            return {"ok": False, "error": "Missing GEMINI_API_KEY"}
        r = httpx.get(
            f"https://generativelanguage.googleapis.com/v1beta/models?key={key}&pageSize=200",
            timeout=15.0,
        )
        if r.status_code != 200:
            return {"ok": False, "error": f"HTTP {r.status_code}: {r.text[:200]}"}
        models = []
        for m in r.json().get("models", []):
            methods = m.get("supportedGenerationMethods") or []
            if "generateContent" not in methods:
                continue
            mid = str(m.get("name", "")).replace("models/", "")
            if not flt or flt in mid.lower():
                models.append(mid)
        models.sort()
        return {"ok": True, "count": len(models), "models": models}

    def _list_groq(self, flt: str) -> dict[str, Any]:
        key = os.environ.get("GROQ_API_KEY", "").strip()
        if not key:
            return {"ok": False, "error": "Missing GROQ_API_KEY"}
        r = httpx.get(
            "https://api.groq.com/openai/v1/models",
            headers={"Authorization": f"Bearer {key}"},
            timeout=15.0,
        )
        if r.status_code != 200:
            return {"ok": False, "error": f"HTTP {r.status_code}: {r.text[:200]}"}
        models = [
            str(m["id"])
            for m in r.json().get("data", [])
            if m.get("id") and (not flt or flt in str(m["id"]).lower())
        ]
        models.sort()
        return {"ok": True, "count": len(models), "models": models}

    def _list_cloudflare(self, flt: str) -> dict[str, Any]:
        token = os.environ.get("CLOUDFLARE_API_TOKEN", "").strip()
        if not token:
            return {"ok": False, "error": "Missing CLOUDFLARE_API_TOKEN"}
        acc = _get_cf_account_id(token)
        if not acc:
            return {"ok": False, "error": "Missing CLOUDFLARE_ACCOUNT_ID"}
        r = httpx.get(
            f"https://api.cloudflare.com/client/v4/accounts/{acc}/ai/models/search",
            params={"task": "Text Generation", "per_page": 100},
            headers={"Authorization": f"Bearer {token}"},
            timeout=15.0,
        )
        if r.status_code != 200:
            return {"ok": False, "error": f"HTTP {r.status_code}: {r.text[:200]}"}
        models = [
            str(m["name"])
            for m in r.json().get("result", [])
            if m.get("name") and (not flt or flt in str(m["name"]).lower())
        ]
        models.sort()
        return {"ok": True, "count": len(models), "models": models}
