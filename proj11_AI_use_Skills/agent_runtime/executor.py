"""Gemini client factory, interruptible execution wrapper, and response parsers."""
from __future__ import annotations

import os
import threading
import time
from typing import Any, Callable

from dotenv import load_dotenv
from google import genai
from google.genai import types

from agent_runtime.config import DEFAULT_API_TIMEOUT_SEC, ENV_FILE


def create_client(timeout_sec: int = DEFAULT_API_TIMEOUT_SEC) -> genai.Client:
    """Load GEMINI_API_KEY from .env/environment and initialize a Gemini API client."""
    load_dotenv(ENV_FILE)
    api_key = os.environ.get("GEMINI_API_KEY", "").strip()
    if not api_key:
        raise RuntimeError(
            "Thieu GEMINI_API_KEY. Hay dat bien moi truong GEMINI_API_KEY hoac tao file .env "
            f"tai {ENV_FILE}"
        )
    return genai.Client(
        api_key=api_key,
        http_options=types.HttpOptions(
            api_version="v1beta",
            timeout=timeout_sec * 1000,
            retry_options=types.HttpRetryOptions(attempts=2),
        ),
    )


def run_interruptible(fn: Callable[[], Any], timeout_sec: float) -> Any:
    """Run blocking I/O in a daemon thread so Ctrl+C works immediately on Windows."""
    done = threading.Event()
    box: dict[str, Any] = {}

    def _worker() -> None:
        try:
            box["result"] = fn()
        except BaseException as exc:
            box["error"] = exc
        finally:
            done.set()

    thread = threading.Thread(target=_worker, daemon=True)
    thread.start()

    deadline = time.monotonic() + timeout_sec
    while not done.is_set():
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            raise TimeoutError(f"Operation timed out after {timeout_sec:.0f}s")
        done.wait(timeout=min(0.2, remaining))

    if "error" in box:
        raise box["error"]
    return box.get("result")


def is_retryable_model_error(exc: Exception) -> bool:
    """Return True if an API error warrants falling back to a backup model."""
    msg = str(exc)
    return (
        isinstance(exc, TimeoutError)
        or "503" in msg
        or "429" in msg
        or "404" in msg
        or "UNAVAILABLE" in msg
        or "RESOURCE_EXHAUSTED" in msg
    )


def extract_text(response: Any, strip: bool = True) -> str:
    texts: list[str] = []
    for cand in getattr(response, "candidates", []) or []:
        content = getattr(cand, "content", None)
        for part in getattr(content, "parts", []) or []:
            text = getattr(part, "text", None)
            if text:
                texts.append(text)
    joined = "".join(texts) if not strip else "\n".join(texts).strip()
    return joined


def extract_function_calls(response: Any) -> list[Any]:
    calls: list[Any] = []
    for cand in getattr(response, "candidates", []) or []:
        content = getattr(cand, "content", None)
        for part in getattr(content, "parts", []) or []:
            fc = getattr(part, "function_call", None)
            if fc and getattr(fc, "name", None):
                calls.append(fc)
    return calls
