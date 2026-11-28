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


def _query_aware_trim(text: str, query: str, max_len: int = 2200) -> str:
    """Keep intro + highest query-relevant chunks instead of blind head truncation."""
    if len(text) <= max_len:
        return text
    q_tokens = {
        tok for tok in "".join(ch if ch.isalnum() else " " for ch in (query or "").lower()).split()
        if len(tok) >= 3
    }
    if not q_tokens:
        return text[:max_len] + "...[trimmed]"

    head = text[:450]
    blocks = [b.strip() for b in text[450:].splitlines() if b.strip()]
    if len(blocks) <= 1:
        return text[:max_len] + "...[trimmed]"

    scored: list[tuple[int, int, str]] = []
    for idx, blk in enumerate(blocks):
        low = blk.lower()
        hits = sum(1 for tok in q_tokens if tok in low)
        if hits > 0:
            scored.append((hits, idx, blk))
    if not scored:
        return text[:max_len] + "...[trimmed]"

    scored.sort(key=lambda x: (-x[0], x[1]))
    chosen: list[tuple[int, str]] = []
    budget = max_len - len(head) - 60
    used = 0
    for _, idx, blk in scored:
        piece = blk[:420]
        if used + len(piece) + 1 > budget:
            continue
        chosen.append((idx, piece))
        used += len(piece) + 1
    chosen.sort(key=lambda x: x[0])
    body = "\n".join(p for _, p in chosen)
    return f"{head}\n...[query-focused excerpts]...\n{body}"


def slim_tool_payload(
    tool_name: str,
    payload: dict[str, Any],
    max_chars: int = 2800,
    query: str = "",
) -> str:
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
        for text_key in ("text", "content", "summary", "data"):
            if isinstance(slim_dict.get(text_key), str) and len(slim_dict[text_key]) > 2200:
                slim_dict[text_key] = _query_aware_trim(slim_dict[text_key], query=query, max_len=2200)
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


def _shorthand_to_prop_schema(val: Any) -> dict[str, Any]:
    """Convert shorthand PGU type strings (e.g. 'str', 'int=25', 'bool=True') into JSON Schema dicts."""
    if isinstance(val, dict):
        if "type" in val:
            return val
        return {"type": "object", "properties": {k: _shorthand_to_prop_schema(v) for k, v in val.items()}}
    s = str(val or "string").strip().lower()
    base = s.split("=", 1)[0].strip()
    if base in ("int", "integer"):
        return {"type": "integer"}
    if base in ("float", "number"):
        return {"type": "number"}
    if base in ("bool", "boolean"):
        return {"type": "boolean"}
    if base.startswith(("list", "array")):
        return {"type": "array", "items": {"type": "string"}}
    if base.startswith(("dict", "object")):
        return {"type": "object"}
    return {"type": "string"}


def normalize_tool_parameters(raw: dict[str, Any]) -> dict[str, Any]:
    """Normalize non-standard PGU TOOL_SCHEMA['parameters'] formats into standard JSON Schema."""
    if not isinstance(raw, dict):
        return {"type": "object", "properties": {}}
    if "properties" in raw:
        out = dict(raw)
        out.setdefault("type", "object")
        return out

    # Pattern 3: {"actions": [{"name": "act1", "parameters": {...}}, ...]}
    if isinstance(raw.get("actions"), list):
        action_names: list[str] = []
        merged_props: dict[str, Any] = {}
        for act in raw["actions"]:
            if not isinstance(act, dict):
                continue
            name = str(act.get("name") or "").strip()
            if name:
                action_names.append(name)
            sub_params = act.get("parameters")
            if isinstance(sub_params, dict):
                sub_props = sub_params.get("properties") if "properties" in sub_params else sub_params
                if isinstance(sub_props, dict):
                    for pk, pv in sub_props.items():
                        merged_props.setdefault(str(pk), _shorthand_to_prop_schema(pv))
        props: dict[str, Any] = {}
        if action_names:
            props["action"] = {"type": "string", "enum": action_names, "description": "Action to execute"}
        props.update(merged_props)
        return {"type": "object", "properties": props, "required": ["action"] if action_names else []}

    # Pattern 1: Flat property dict where values are JSON schema dicts with 'type' (not action wrappers with 'parameters')
    if raw and all(
        isinstance(v, dict) and ("type" in v or "enum" in v) and "parameters" not in v
        for v in raw.values()
    ):
        props_p1 = {str(k): v for k, v in raw.items()}
        if "action" not in props_p1:
            props_p1["action"] = {"type": "string", "description": "Action to execute"}
        return {"type": "object", "properties": props_p1, "required": ["action"]}

    # Pattern 2: Action-keyed dict (e.g. {"navigate": {"url": "str"}, "deduplicate_tabs": {"description": "...", "parameters": {...}}})
    if raw and all(isinstance(v, dict) for v in raw.values()):
        action_names = [str(k) for k in raw.keys()]
        merged_props = {}
        for sub in raw.values():
            sub_params = sub.get("parameters") if isinstance(sub.get("parameters"), dict) else sub
            if isinstance(sub_params, dict) and "properties" in sub_params and isinstance(sub_params["properties"], dict):
                sub_params = sub_params["properties"]
            for pk, pv in sub_params.items():
                if pk in ("description", "required"):
                    continue
                merged_props.setdefault(str(pk), _shorthand_to_prop_schema(pv))
        props = {"action": {"type": "string", "enum": action_names, "description": "Action to execute"}}
        props.update(merged_props)
        return {"type": "object", "properties": props, "required": ["action"]}

    props_flat = {str(k): _shorthand_to_prop_schema(v) for k, v in raw.items()}
    if "action" not in props_flat:
        props_flat["action"] = {"type": "string", "description": "Action to execute"}
    return {"type": "object", "properties": props_flat, "required": ["action"]}


def build_schema_from_json_dict(raw: dict[str, Any], _is_root: bool = True) -> types.Schema:
    """Convert a JSON Schema dict (including PGU TOOL_SCHEMA variants) into google.genai.types.Schema."""
    if not isinstance(raw, dict):
        return types.Schema(type=types.Type.STRING)
    if _is_root and "type" not in raw:
        raw = normalize_tool_parameters(raw)

    jtype = str(raw.get("type", "string")).lower()
    gtype = _JSON_TYPE_MAP.get(jtype, types.Type.STRING)

    kwargs: dict[str, Any] = {"type": gtype}
    desc = str(raw.get("description") or "").strip()
    if desc and not _is_root:
        kwargs["description"] = desc[:55]
    elif desc:
        kwargs["description"] = desc[:85]
    if gtype == types.Type.STRING and isinstance(raw.get("enum"), list) and raw["enum"]:
        kwargs["enum"] = [str(x) for x in raw["enum"]]
    if gtype == types.Type.ARRAY:
        items_raw = raw.get("items")
        kwargs["items"] = (
            build_schema_from_json_dict(items_raw, _is_root=False)
            if isinstance(items_raw, dict)
            else types.Schema(type=types.Type.STRING)
        )
    elif gtype == types.Type.OBJECT:
        props_raw = raw.get("properties") or {}
        if isinstance(props_raw, dict) and props_raw:
            kwargs["properties"] = {
                str(k): build_schema_from_json_dict(v, _is_root=False) for k, v in props_raw.items()
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
