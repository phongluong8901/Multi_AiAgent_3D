"""9Router-style Multi-Provider Free API Router (Gemini + Groq + Cloudflare Workers AI).

Features:
- Unified OpenAI-compatible + Gemini native Function Calling interface
- Automatic key rotation & provider fallback on 429 / 503 / 5xx / 401 / Timeout
- Per-endpoint cooldown tracking (RPM cooldown, daily quota cooldown, auth disable)
- Two routing strategies: `priority` (ordered fallback) and `round_robin` (load-spread)
- Automatic Cloudflare Account ID discovery via `/client/v4/accounts` if omitted
"""
from __future__ import annotations

import json
import os
import threading
import time
import uuid
from dataclasses import dataclass, field
from typing import Any, Literal

import httpx
from dotenv import load_dotenv
from google import genai
from google.genai import types

from agent_runtime.config import DEFAULT_API_TIMEOUT_SEC, ENV_FILE
from agent_runtime.executor import extract_function_calls, extract_text, run_interruptible
from agent_runtime.telemetry import TokenUsage, extract_usage

ProviderName = Literal["gemini", "groq", "cloudflare"]


@dataclass
class UnifiedToolCall:
    id: str
    name: str
    args: dict[str, Any]
    raw_part: Any = None


@dataclass
class UnifiedLLMResponse:
    provider: ProviderName
    model: str
    text: str
    tool_calls: list[UnifiedToolCall]
    usage: TokenUsage
    endpoint_id: str


@dataclass
class ProviderEndpoint:
    endpoint_id: str
    provider: ProviderName
    model: str
    api_key: str
    account_id: str = ""
    priority: int = 100
    status: str = "healthy"  # healthy | cooldown | disabled
    cooldown_until: float = 0.0
    requests: int = 0
    successes: int = 0
    errors: int = 0
    last_error: str = ""
    last_latency_ms: int = 0

    def is_available(self, now: float | None = None) -> bool:
        t = now if now is not None else time.time()
        if self.status == "disabled":
            return False
        if self.status == "cooldown" and t < self.cooldown_until:
            return False
        if self.status == "cooldown" and t >= self.cooldown_until:
            self.status = "healthy"
            self.cooldown_until = 0.0
        return True

    def to_public_dict(self) -> dict[str, Any]:
        now = time.time()
        self.is_available(now)
        remaining = max(0, int(self.cooldown_until - now)) if self.status == "cooldown" else 0
        return {
            "endpoint_id": self.endpoint_id,
            "provider": self.provider,
            "model": self.model,
            "priority": self.priority,
            "status": self.status,
            "cooldown_remaining_sec": remaining,
            "requests": self.requests,
            "successes": self.successes,
            "errors": self.errors,
            "last_latency_ms": self.last_latency_ms,
            "last_error": self.last_error[:140],
        }


def _genai_schema_to_json_schema(schema: types.Schema | None) -> dict[str, Any]:
    """Convert google.genai.types.Schema into standard OpenAI JSON Schema dict."""
    if schema is None:
        return {"type": "object", "properties": {}}

    type_map = {
        types.Type.STRING: "string",
        types.Type.INTEGER: "integer",
        types.Type.NUMBER: "number",
        types.Type.BOOLEAN: "boolean",
        types.Type.ARRAY: "array",
        types.Type.OBJECT: "object",
    }
    jtype = type_map.get(schema.type, "string")
    out: dict[str, Any] = {"type": jtype}
    if schema.description:
        out["description"] = schema.description
    if jtype == "array":
        out["items"] = _genai_schema_to_json_schema(schema.items) if schema.items else {"type": "string"}
    elif jtype == "object":
        props = {}
        for k, v in (schema.properties or {}).items():
            props[k] = _genai_schema_to_json_schema(v)
        out["properties"] = props
        req = list(schema.required or [])
        if req:
            out["required"] = req
    return out


def declarations_to_openai_tools(
    declarations: list[types.FunctionDeclaration],
) -> list[dict[str, Any]]:
    """Convert Gemini FunctionDeclarations to OpenAI-compatible `tools` payloads (Groq / Cloudflare)."""
    tools: list[dict[str, Any]] = []
    for d in declarations:
        tools.append(
            {
                "type": "function",
                "function": {
                    "name": d.name,
                    "description": d.description or "",
                    "parameters": _genai_schema_to_json_schema(d.parameters),
                },
            }
        )
    return tools


def _discover_cloudflare_account_id(api_token: str, timeout: float = 10.0) -> str:
    """Attempt to auto-discover Cloudflare Account ID using the provided API token."""
    try:
        r = httpx.get(
            "https://api.cloudflare.com/client/v4/accounts",
            headers={"Authorization": f"Bearer {api_token}"},
            timeout=timeout,
        )
        if r.status_code == 200:
            data = r.json()
            results = data.get("result") or []
            if results and isinstance(results, list) and results[0].get("id"):
                return str(results[0]["id"])
    except Exception:
        pass
    return ""


class MultiProviderRouter:
    """9Router-style pool rotating across Gemini, Groq, and Cloudflare Workers AI free tiers."""

    def __init__(
        self,
        strategy: str | None = None,
        timeout_sec: int = DEFAULT_API_TIMEOUT_SEC,
    ):
        load_dotenv(ENV_FILE)
        self.strategy = (strategy or os.environ.get("LLM_ROUTER_STRATEGY", "priority")).strip().lower()
        self.timeout_sec = timeout_sec
        self._lock = threading.Lock()
        self._rr_index = 0
        self._gemini_clients: dict[str, genai.Client] = {}
        self.endpoints: list[ProviderEndpoint] = []
        self._build_endpoints()

    def _get_gemini_client(self, api_key: str) -> genai.Client:
        if api_key not in self._gemini_clients:
            self._gemini_clients[api_key] = genai.Client(
                api_key=api_key,
                http_options=types.HttpOptions(
                    api_version="v1beta",
                    timeout=self.timeout_sec * 1000,
                    retry_options=types.HttpRetryOptions(attempts=1),
                ),
            )
        return self._gemini_clients[api_key]

    def _build_endpoints(self) -> None:
        # 1. Collect all Gemini keys (GEMINI_API_KEY + comma-separated GEMINI_API_KEYS)
        gemini_keys: list[str] = []
        primary_g = os.environ.get("GEMINI_API_KEY", "").strip()
        if primary_g:
            gemini_keys.append(primary_g)
        extra_g = os.environ.get("GEMINI_API_KEYS", "").strip()
        for k in [x.strip() for x in extra_g.split(",") if x.strip()]:
            if k not in gemini_keys:
                gemini_keys.append(k)

        gemini_models = [
            ("gemini-3.5-flash-lite", 10),
            ("gemini-3.1-flash-lite", 30),
            ("gemini-2.5-flash", 50),
        ]
        for k_idx, gkey in enumerate(gemini_keys, start=1):
            for model, base_prio in gemini_models:
                self.endpoints.append(
                    ProviderEndpoint(
                        endpoint_id=f"gemini#{k_idx}:{model}",
                        provider="gemini",
                        model=model,
                        api_key=gkey,
                        priority=base_prio + (k_idx - 1) * 2,
                    )
                )

        # 2. Groq Free Tier (OpenAI-compatible, fast Llama 3.3 70B & Llama 3.1 8B)
        groq_keys = [
            k.strip()
            for k in (
                os.environ.get("GROQ_API_KEY", "") + "," + os.environ.get("GROQ_API_KEYS", "")
            ).split(",")
            if k.strip()
        ]
        groq_keys = list(dict.fromkeys(groq_keys))
        groq_models = [
            ("openai/gpt-oss-120b", 20),
            ("qwen/qwen3.8-27b", 32),
            ("openai/gpt-oss-20b", 40),
        ]
        for k_idx, grkey in enumerate(groq_keys, start=1):
            for model, base_prio in groq_models:
                self.endpoints.append(
                    ProviderEndpoint(
                        endpoint_id=f"groq#{k_idx}:{model}",
                        provider="groq",
                        model=model,
                        api_key=grkey,
                        priority=base_prio + (k_idx - 1) * 2,
                    )
                )

        # 3. Cloudflare Workers AI Free Tier (OpenAI-compatible)
        cf_token = os.environ.get("CLOUDFLARE_API_TOKEN", "").strip()
        cf_account = os.environ.get("CLOUDFLARE_ACCOUNT_ID", "").strip()
        if cf_token:
            if not cf_account:
                cf_account = _discover_cloudflare_account_id(cf_token)
            cf_models = [
                ("@cf/meta/llama-3.3-70b-instruct-fp8-fast", 35),
                ("@cf/google/gemma-4-26b-a4b-it", 55),
            ]
            for model, prio in cf_models:
                ep = ProviderEndpoint(
                    endpoint_id=f"cloudflare:{model.split('/')[-1]}",
                    provider="cloudflare",
                    model=model,
                    api_key=cf_token,
                    account_id=cf_account,
                    priority=prio,
                )
                if not cf_account:
                    ep.status = "disabled"
                    ep.last_error = "Missing CLOUDFLARE_ACCOUNT_ID in .env (auto-discovery requires Account:Read permission)"
                self.endpoints.append(ep)

        self.endpoints.sort(key=lambda e: e.priority)

    def get_status(self) -> list[dict[str, Any]]:
        with self._lock:
            return [ep.to_public_dict() for ep in self.endpoints]

    def _select_candidates(self, preferred_target: str | None = None) -> list[ProviderEndpoint]:
        with self._lock:
            now = time.time()
            avail = [ep for ep in self.endpoints if ep.is_available(now)]
            if not avail:
                # If everything is in cooldown, pick the one whose cooldown expires soonest (excluding disabled)
                non_disabled = [ep for ep in self.endpoints if ep.status != "disabled"]
                non_disabled.sort(key=lambda e: e.cooldown_until)
                return non_disabled

            if preferred_target and preferred_target not in ("auto", "9router"):
                exact = [
                    ep
                    for ep in avail
                    if ep.endpoint_id == preferred_target
                    or ep.model == preferred_target
                    or ep.provider == preferred_target
                ]
                rest = [ep for ep in avail if ep not in exact]
                return exact + rest

            if self.strategy == "round_robin" and len(avail) > 1:
                idx = self._rr_index % len(avail)
                self._rr_index += 1
                return avail[idx:] + avail[:idx]

            return sorted(avail, key=lambda e: e.priority)

    def _record_failure(self, ep: ProviderEndpoint, exc: Exception) -> None:
        msg = str(exc)
        low = msg.lower()
        with self._lock:
            ep.errors += 1
            ep.last_error = f"{type(exc).__name__}: {msg}"[:200]
            if "401" in msg or "402" in msg or "403" in msg or "api_key_invalid" in low or "invalid api key" in low or "subscription" in low:
                ep.status = "disabled"
            elif "429" in msg or "resource_exhausted" in low or "rate_limit" in low:
                # Daily quota gets longer cooldown; RPM gets 60s
                cd = 600 if ("per day" in low or "daily" in low) else 60
                ep.status = "cooldown"
                ep.cooldown_until = time.time() + cd
            elif "404" in msg or "not found" in low:
                ep.status = "cooldown"
                ep.cooldown_until = time.time() + 300
            else:
                ep.status = "cooldown"
                ep.cooldown_until = time.time() + 30

    def _call_gemini(
        self,
        ep: ProviderEndpoint,
        system_instruction: str,
        messages: list[dict[str, Any]],
        declarations: list[types.FunctionDeclaration],
        temperature: float,
    ) -> UnifiedLLMResponse:
        client = self._get_gemini_client(ep.api_key)
        contents: list[types.Content] = []
        synthetic_tool_ids: set[str] = set()
        for m in messages:
            role = m["role"]
            if role == "user":
                contents.append(types.Content(role="user", parts=[types.Part.from_text(text=m["content"])]))
            elif role == "assistant":
                parts: list[types.Part] = []
                if m.get("content"):
                    parts.append(types.Part.from_text(text=m["content"]))
                for tc in m.get("tool_calls") or []:
                    raw_p = tc.get("raw_part")
                    if isinstance(raw_p, types.Part):
                        parts.append(raw_p)
                    else:
                        # Cross-provider tool call (e.g. from Groq): pass as text so Gemini 3.x never fails thought_signature
                        synthetic_tool_ids.add(tc.get("id", ""))
                        parts.append(
                            types.Part.from_text(
                                text=f"[Tool call from previous provider: {tc['name']}({json.dumps(tc.get('args') or {}, ensure_ascii=False)})]"
                            )
                        )
                if parts:
                    contents.append(types.Content(role="model", parts=parts))
            elif role == "tool":
                if m.get("tool_call_id", "") in synthetic_tool_ids:
                    contents.append(
                        types.Content(
                            role="user",
                            parts=[types.Part.from_text(text=f"[Tool result for {m['name']}]: {m['content']}")],
                        )
                    )
                    continue
                fr_part = types.Part.from_function_response(
                    name=m["name"],
                    response={"result": m["content"]},
                )
                if contents and contents[-1].role == "user" and any(
                    getattr(p, "function_response", None) for p in contents[-1].parts
                ):
                    contents[-1].parts.append(fr_part)
                else:
                    contents.append(types.Content(role="user", parts=[fr_part]))

        cfg = types.GenerateContentConfig(
            system_instruction=system_instruction,
            tools=[types.Tool(function_declarations=declarations)] if declarations else None,
            temperature=temperature,
        )
        resp = run_interruptible(
            lambda: client.models.generate_content(model=ep.model, contents=contents, config=cfg),
            timeout_sec=float(self.timeout_sec),
        )
        text = extract_text(resp, strip=True)
        tool_calls: list[UnifiedToolCall] = []
        for cand in getattr(resp, "candidates", []) or []:
            content = getattr(cand, "content", None)
            for part in getattr(content, "parts", []) or []:
                fc = getattr(part, "function_call", None)
                if fc and getattr(fc, "name", None):
                    tool_calls.append(
                        UnifiedToolCall(
                            id=f"call_{uuid.uuid4().hex[:8]}",
                            name=fc.name,
                            args=dict(fc.args or {}),
                            raw_part=part,
                        )
                    )
        return UnifiedLLMResponse(
            provider="gemini",
            model=ep.model,
            text=text,
            tool_calls=tool_calls,
            usage=extract_usage(resp),
            endpoint_id=ep.endpoint_id,
        )

    def _call_openai_compat(
        self,
        ep: ProviderEndpoint,
        base_url: str,
        system_instruction: str,
        messages: list[dict[str, Any]],
        declarations: list[types.FunctionDeclaration],
        temperature: float,
    ) -> UnifiedLLMResponse:
        oai_messages: list[dict[str, Any]] = [{"role": "system", "content": system_instruction}]
        for m in messages:
            role = m["role"]
            if role == "user":
                oai_messages.append({"role": "user", "content": m["content"]})
            elif role == "assistant":
                msg_obj: dict[str, Any] = {"role": "assistant", "content": m.get("content") or None}
                if m.get("tool_calls"):
                    msg_obj["tool_calls"] = [
                        {
                            "id": tc["id"],
                            "type": "function",
                            "function": {
                                "name": tc["name"],
                                "arguments": json.dumps(tc.get("args") or {}, ensure_ascii=False),
                            },
                        }
                        for tc in m["tool_calls"]
                    ]
                oai_messages.append(msg_obj)
            elif role == "tool":
                tool_content = str(m["content"])
                # Respect Groq Free Tier TPM limits (6K-12K TPM) by capping verbose tool outputs
                if ep.provider == "groq" and len(tool_content) > 3000:
                    tool_content = tool_content[:3000] + "... [truncated for Groq TPM limit]"
                oai_messages.append(
                    {
                        "role": "tool",
                        "tool_call_id": m.get("tool_call_id", "call_0"),
                        "name": m["name"],
                        "content": tool_content,
                    }
                )

        body: dict[str, Any] = {
            "model": ep.model,
            "messages": oai_messages,
            "temperature": temperature,
        }
        if declarations:
            # Keep Groq tool payload compact to avoid 413/429 TPM and Llama tool_use_failed
            active_decls = declarations[:5] if ep.provider == "groq" else declarations
            body["tools"] = declarations_to_openai_tools(active_decls)
            body["tool_choice"] = "auto"
            if ep.provider == "groq":
                body["parallel_tool_calls"] = False

        def _do_post() -> httpx.Response:
            return httpx.post(
                base_url,
                headers={
                    "Authorization": f"Bearer {ep.api_key}",
                    "Content-Type": "application/json",
                },
                json=body,
                timeout=float(self.timeout_sec),
            )

        resp = run_interruptible(_do_post, timeout_sec=float(self.timeout_sec + 5))
        if resp.status_code != 200:
            err_detail = resp.text[:220]
            try:
                j = resp.json()
                if isinstance(j, dict):
                    msg = j.get("message") or (j.get("error") or {}).get("message")
                    if msg:
                        err_detail = str(msg)
            except Exception:
                pass
            raise RuntimeError(f"HTTP {resp.status_code}: {err_detail}")

        data = resp.json()
        choice = (data.get("choices") or [{}])[0]
        msg_data = choice.get("message") or {}
        text = (msg_data.get("content") or "").strip()

        tool_calls: list[UnifiedToolCall] = []
        for tc in msg_data.get("tool_calls") or []:
            fn = tc.get("function") or {}
            raw_args = fn.get("arguments") or "{}"
            try:
                parsed_args = json.loads(raw_args) if isinstance(raw_args, str) else dict(raw_args)
            except json.JSONDecodeError:
                parsed_args = {}
            if fn.get("name"):
                tool_calls.append(
                    UnifiedToolCall(
                        id=str(tc.get("id") or f"call_{uuid.uuid4().hex[:8]}"),
                        name=str(fn["name"]),
                        args=parsed_args if isinstance(parsed_args, dict) else {},
                    )
                )

        u = data.get("usage") or {}
        in_tok = int(u.get("prompt_tokens") or 0)
        out_tok = int(u.get("completion_tokens") or 0)
        tot_tok = int(u.get("total_tokens") or (in_tok + out_tok))
        usage = TokenUsage(
            input_tokens=in_tok,
            output_tokens=out_tok,
            total_tokens=tot_tok,
            peak_input_tokens=in_tok,
            api_calls=1,
        )
        return UnifiedLLMResponse(
            provider=ep.provider,
            model=ep.model,
            text=text,
            tool_calls=tool_calls,
            usage=usage,
            endpoint_id=ep.endpoint_id,
        )

    def generate(
        self,
        *,
        system_instruction: str,
        messages: list[dict[str, Any]],
        declarations: list[types.FunctionDeclaration],
        preferred: str | None = None,
        temperature: float = 0.2,
        verbose: bool = True,
    ) -> UnifiedLLMResponse:
        """Route a chat/tool generation call across healthy providers with automatic failover."""
        candidates = self._select_candidates(preferred_target=preferred)
        if not candidates:
            raise RuntimeError("Khong co provider API nao kha dung (hay kiem tra key trong .env).")

        last_exc: Exception | None = None
        for idx, ep in enumerate(candidates):
            t0 = time.perf_counter()
            ep.requests += 1
            try:
                if ep.provider == "gemini":
                    res = self._call_gemini(ep, system_instruction, messages, declarations, temperature)
                elif ep.provider == "groq":
                    res = self._call_openai_compat(
                        ep,
                        "https://api.groq.com/openai/v1/chat/completions",
                        system_instruction,
                        messages,
                        declarations,
                        temperature,
                    )
                elif ep.provider == "cloudflare":
                    if not ep.account_id:
                        raise RuntimeError("Missing CLOUDFLARE_ACCOUNT_ID")
                    cf_url = f"https://api.cloudflare.com/client/v4/accounts/{ep.account_id}/ai/v1/chat/completions"
                    res = self._call_openai_compat(
                        ep, cf_url, system_instruction, messages, declarations, temperature
                    )
                else:
                    raise ValueError(f"Unsupported provider: {ep.provider}")

                ep.successes += 1
                ep.last_latency_ms = int((time.perf_counter() - t0) * 1000)
                ep.last_error = ""
                return res
            except KeyboardInterrupt:
                raise
            except Exception as exc:
                last_exc = exc
                self._record_failure(ep, exc)
                if verbose and idx + 1 < len(candidates):
                    print(
                        f"[9ROUTER] {ep.endpoint_id} failed ({type(exc).__name__}: {str(exc)[:90]}) "
                        f"-> rotating to {candidates[idx + 1].endpoint_id}",
                        flush=True,
                    )
                continue

        assert last_exc is not None
        raise last_exc
