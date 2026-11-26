"""Conversion helpers between Python/JSON schemas and Gemini schemas + Tool Result Slimmer."""
from __future__ import annotations

import inspect
import json
import types as pytypes
from typing import Any, Union, get_args, get_origin

from google.genai import types

_SECRET_KEY_MARKERS = ("API_KEY", "TOKEN", "SECRET", "PASSWORD", "PASSWD", "CREDENTIAL")

_JSON_TYPE_MAP: dict[str, types.Type] = {
    "string": types.Type.STRING,
    "integer": types.Type.INTEGER,
    "number": types.Type.NUMBER,
    "boolean": types.Type.BOOLEAN,
    "array": types.Type.ARRAY,
    "object": types.Type.OBJECT,
}


def safe_serialize(obj: Any, max_chars: int = 2800) -> str:
    """Serialize any tool return value to compact JSON with length cap."""
    try:
        raw = json.dumps(obj, ensure_ascii=False, separators=(",", ":"), default=str)
    except Exception:
        raw = str(obj)
    if len(raw) > max_chars:
        return raw[:max_chars] + f"...[+{len(raw) - max_chars} chars]"
    return raw


def _redact_secrets_in_dict(d: dict[str, Any]) -> dict[str, Any]:
    out: dict[str, Any] = {}
    for k, v in d.items():
        if any(marker in str(k).upper() for marker in _SECRET_KEY_MARKERS):
            out[k] = "***REDACTED***"
        else:
            out[k] = v
    return out


def slim_tool_payload(tool_name: str, payload: dict[str, Any], max_chars: int = 2800) -> str:
    """Structurally slim tool output before sending to Step 2 LLM to cut input tokens by 50-75%."""
    if not isinstance(payload, dict) or not payload.get("ok"):
        return safe_serialize(payload, max_chars=800)

    data = payload.get("data")
    name_low = (tool_name or "").lower()

    # 1. Web search: keep top 4 results with compact title, url, snippet[:180]
    if "web_search" in name_low and isinstance(data, list):
        slim_list = []
        for item in data[:4]:
            if isinstance(item, dict):
                slim_list.append(
                    {
                        "title": str(item.get("title", ""))[:120],
                        "url": str(item.get("url", "")),
                        "snippet": str(item.get("snippet", ""))[:180],
                    }
                )
        return safe_serialize({"ok": True, "data": slim_list}, max_chars=max_chars)

    # 2. Long text readers (web_reader, browser_reader, document_analyzer, local_workspace)
    if isinstance(data, dict):
        slim_dict = dict(data)
        for text_key in ("text", "content", "summary"):
            if isinstance(slim_dict.get(text_key), str) and len(slim_dict[text_key]) > 2200:
                slim_dict[text_key] = slim_dict[text_key][:2200] + "...[trimmed]"
        # Redact secret env vars if returned by win_registry_startup
        if "env_vars" in slim_dict and isinstance(slim_dict["env_vars"], dict):
            slim_dict["env_vars"] = _redact_secrets_in_dict(slim_dict["env_vars"])
        # Cap large lists inside dicts (e.g. results, tabs, startup_apps, entries)
        for list_key in ("results", "tabs", "startup_apps", "entries", "sample", "facts"):
            if isinstance(slim_dict.get(list_key), list) and len(slim_dict[list_key]) > 12:
                total = len(slim_dict[list_key])
                slim_dict[list_key] = slim_dict[list_key][:12]
                slim_dict[f"{list_key}_truncated_from"] = total
        return safe_serialize({"ok": True, "data": slim_dict}, max_chars=max_chars)

    # 3. Generic list output (e.g. arxiv, github, hacker_news, rss)
    if isinstance(data, list) and len(data) > 8:
        return safe_serialize(
            {"ok": True, "data": data[:8], "total_items": len(data)},
            max_chars=max_chars,
        )

    return safe_serialize(payload, max_chars=max_chars)


def build_schema_for_annotation(ann: Any, description: str = "") -> types.Schema:
    """Convert a Python type annotation into a compact google.genai.types.Schema."""
    kw: dict[str, Any] = {"description": description} if description else {}
    if ann is inspect._empty or ann is None or ann is Any:
        return types.Schema(type=types.Type.STRING, **kw)

    origin = get_origin(ann)
    args = get_args(ann)

    if origin in (Union, pytypes.UnionType):
        non_none = [a for a in args if a is not type(None)]
        if non_none:
            return build_schema_for_annotation(non_none[0], description=description)
        return types.Schema(type=types.Type.STRING, **kw)

    if origin in (list, tuple, set):
        item_schema = (
            build_schema_for_annotation(args[0])
            if args
            else types.Schema(type=types.Type.STRING)
        )
        return types.Schema(type=types.Type.ARRAY, items=item_schema, **kw)

    if origin is dict or ann is dict:
        return types.Schema(type=types.Type.OBJECT, **kw)

    if ann is int:
        return types.Schema(type=types.Type.INTEGER, **kw)
    if ann is float:
        return types.Schema(type=types.Type.NUMBER, **kw)
    if ann is bool:
        return types.Schema(type=types.Type.BOOLEAN, **kw)
    if ann in (list, tuple, set):
        return types.Schema(
            type=types.Type.ARRAY,
            items=types.Schema(type=types.Type.STRING),
            **kw,
        )

    return types.Schema(type=types.Type.STRING, **kw)


def build_schema_from_json_dict(raw: dict[str, Any]) -> types.Schema:
    """Convert a standard JSON Schema dict (used by TOOL_SCHEMA skills) into google.genai.types.Schema."""
    if not isinstance(raw, dict):
        return types.Schema(type=types.Type.STRING)

    jtype = str(raw.get("type", "string")).lower()
    gtype = _JSON_TYPE_MAP.get(jtype, types.Type.STRING)

    kwargs: dict[str, Any] = {"type": gtype}
    desc = str(raw.get("description") or "").strip()
    if desc:
        kwargs["description"] = desc[:90]
    if gtype == types.Type.STRING and isinstance(raw.get("enum"), list) and raw["enum"]:
        kwargs["enum"] = [str(x) for x in raw["enum"]]
    if gtype == types.Type.ARRAY:
        items_raw = raw.get("items")
        kwargs["items"] = (
            build_schema_from_json_dict(items_raw)
            if isinstance(items_raw, dict)
            else types.Schema(type=types.Type.STRING)
        )
    elif gtype == types.Type.OBJECT:
        props_raw = raw.get("properties") or {}
        if isinstance(props_raw, dict) and props_raw:
            kwargs["properties"] = {
                str(k): build_schema_from_json_dict(v) for k, v in props_raw.items()
            }
        req = raw.get("required")
        if isinstance(req, list) and req:
            kwargs["required"] = [str(x) for x in req]

    return types.Schema(**kwargs)


def coerce_arg(value: Any, schema: types.Schema) -> Any:
    """Best-effort coerce LLM-provided arguments to match expected Python types."""
    if value is None:
        return None
    try:
        if schema.type == types.Type.INTEGER:
            return int(value)
        if schema.type == types.Type.NUMBER:
            return float(value)
        if schema.type == types.Type.BOOLEAN and isinstance(value, str):
            return value.strip().lower() in ("true", "1", "yes")
    except Exception:
        pass
    return value
