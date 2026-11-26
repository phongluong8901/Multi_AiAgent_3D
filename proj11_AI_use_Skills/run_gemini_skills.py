"""Local test harness for running AutoEvolve_AI skills with Gemini 3.5 Flash function calling.

Usage:
    python run_gemini_skills.py --list-tools
    python run_gemini_skills.py --prompt "Gia BTC hien tai va ty gia USD sang VND?"
    python run_gemini_skills.py --benchmark
    python run_gemini_skills.py --chat
"""
from __future__ import annotations

import argparse
import inspect
import json
import os
import sys
import threading
import time
import types as pytypes
from pathlib import Path
from typing import Any, Callable, Union, get_args, get_origin

from dotenv import load_dotenv
from google import genai
from google.genai import types

BASE_DIR = Path(__file__).resolve().parent
SKILLS_ROOT = BASE_DIR / "skills"
SKILLS_DIR = SKILLS_ROOT / "search_skills"
OUTPUTS_DIR = BASE_DIR / "outputs"

DEFAULT_MODEL = "gemini-3.5-flash-lite"
FALLBACK_MODELS = [
    "gemini-3.5-flash-lite",
    "gemini-3.1-flash-lite",
    "gemini-2.5-flash",
    "gemini-3.8-flash",
]

SKIP_MODULES = {
    "skill_circular_buffer",
    "skill_event_processor",
    "skill_event_queue",
    "skill_thread_pool",
    "skill_url_deduplicator_processor",
    "skill_url_filter",
    "skill_url_normalizer",
    "skill_url_normalizer_filter_pipeline",
    "skill_url_processor_pipeline",
    "skill_html_content_extractor",
    "skill_html_noise_filter",
    "skill_json_schema_validator",
}

SYSTEM_INSTRUCTION = (
    "Ban la tro ly AI thuc chien co kha nang goi tool. "
    "Khi can du lieu thuc te (tin tuc, web, API, gia crypto, ty gia, thoi tiet, dia ly, "
    "tai lieu PDF/CSV/Excel, package PyPI, repo GitHub, bai bao arXiv, xuat bao cao), "
    "hay uu tien goi tool phu hop thay vi doan. "
    "Chi dua tren du lieu tra ve tu tool, khong tu bia link URL hay con so."
)

BENCHMARK_PROMPTS = [
    (
        "Crypto & Forex",
        "Lay gia BTCUSDT hien tai tren Binance va ty gia 1 USD sang EUR moi nhat.",
    ),
    (
        "Weather & Coordinates",
        "Tim toa do thanh pho Da Nang va lay thong tin thoi tiet hien tai o do.",
    ),
    (
        "Dev & Research APIs",
        "Tra cuu thong tin package httpx tren PyPI va tim 2 bai bao moi tren arXiv ve 'self-evolving agents'.",
    ),
    (
        "PDF Document Analyzer",
        "Doc 2 trang dau cua bai bao https://arxiv.org/pdf/2508.07407.pdf va tom tat muc tieu chinh trong 3 gach dau dong.",
    ),
    (
        "Web Search",
        "Tim thong tin moi nhat ve Python 3.14 tren web kem link nguon.",
    ),
]


def _safe_serialize(obj: Any, max_chars: int = 8000) -> str:
    try:
        raw = json.dumps(obj, ensure_ascii=False, default=str)
    except Exception:
        raw = str(obj)
    if len(raw) > max_chars:
        return raw[:max_chars] + f"... [truncated, total {len(raw)} chars]"
    return raw


def _build_schema_for_annotation(ann: Any, description: str = "") -> types.Schema:
    """Convert a Python type annotation into a valid google.genai.types.Schema."""
    if ann is inspect._empty or ann is None or ann is Any:
        return types.Schema(type=types.Type.STRING, description=description)

    origin = get_origin(ann)
    args = get_args(ann)

    # Handle Optional[T] and Union[T1, T2] / T1 | T2
    if origin in (Union, pytypes.UnionType):
        non_none = [a for a in args if a is not type(None)]
        if non_none:
            return _build_schema_for_annotation(non_none[0], description=description)
        return types.Schema(type=types.Type.STRING, description=description)

    if origin in (list, tuple, set):
        item_schema = (
            _build_schema_for_annotation(args[0])
            if args
            else types.Schema(type=types.Type.STRING)
        )
        return types.Schema(
            type=types.Type.ARRAY,
            items=item_schema,
            description=description,
        )

    if origin is dict or ann is dict:
        return types.Schema(type=types.Type.OBJECT, description=description)

    if ann is int:
        return types.Schema(type=types.Type.INTEGER, description=description)
    if ann is float:
        return types.Schema(type=types.Type.NUMBER, description=description)
    if ann is bool:
        return types.Schema(type=types.Type.BOOLEAN, description=description)
    if ann in (list, tuple, set):
        return types.Schema(
            type=types.Type.ARRAY,
            items=types.Schema(type=types.Type.STRING),
            description=description,
        )

    return types.Schema(type=types.Type.STRING, description=description)


def _coerce_arg(value: Any, schema: types.Schema) -> Any:
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


def build_gemini_tools(
    skills_dir: Path = SKILLS_DIR,
) -> tuple[list[types.FunctionDeclaration], dict[str, Callable[..., dict[str, Any]]], list[str]]:
    """Discover skill classes/methods and build Gemini FunctionDeclarations + handlers."""
    for p in (str(SKILLS_ROOT), str(skills_dir)):
        if p not in sys.path:
            sys.path.insert(0, p)

    declarations: list[types.FunctionDeclaration] = []
    handlers: dict[str, Callable[..., dict[str, Any]]] = {}
    loaded_names: list[str] = []

    for fname in sorted(os.listdir(skills_dir)):
        if not fname.startswith("skill_") or not fname.endswith(".py") or fname.startswith("test_"):
            continue
        mod_name = fname[:-3]
        if mod_name in SKIP_MODULES:
            continue

        try:
            mod = __import__(mod_name)
        except Exception as exc:
            print(f"[WARN] Skipped {mod_name} due to import error: {type(exc).__name__}: {exc}")
            continue

        for cls_name, cls_obj in inspect.getmembers(mod, inspect.isclass):
            # Ignore imported classes and private helper classes (e.g., _CleanTextExtractor)
            if cls_obj.__module__ != mod_name or cls_name.startswith("_"):
                continue

            for m_name, method in inspect.getmembers(cls_obj, predicate=inspect.isfunction):
                # Only expose public methods explicitly defined on the skill class itself
                if m_name.startswith("_") or m_name not in cls_obj.__dict__:
                    continue

                sig = inspect.signature(method)
                tool_fn_name = f"{mod_name.replace('skill_', '')}__{m_name}"

                properties: dict[str, types.Schema] = {}
                required: list[str] = []
                param_meta: list[tuple[str, types.Schema, inspect.Parameter]] = []

                for p_name, param in sig.parameters.items():
                    if p_name == "self" or param.kind in (
                        inspect.Parameter.VAR_POSITIONAL,
                        inspect.Parameter.VAR_KEYWORD,
                    ):
                        continue
                    has_default = param.default is not inspect._empty
                    desc_p = (
                        f"Tham so `{p_name}` (mac dinh: {param.default})"
                        if has_default
                        else f"Tham so `{p_name}`"
                    )
                    schema = _build_schema_for_annotation(param.annotation, description=desc_p)
                    properties[p_name] = schema
                    if not has_default:
                        required.append(p_name)
                    param_meta.append((p_name, schema, param))

                raw_doc = inspect.getdoc(method) or inspect.getdoc(cls_obj) or f"Call {cls_name}.{m_name}"
                doc_first = raw_doc.splitlines()[0]

                decl = types.FunctionDeclaration(
                    name=tool_fn_name,
                    description=f"[{mod_name}] {doc_first}",
                    parameters=types.Schema(
                        type=types.Type.OBJECT,
                        properties=properties,
                        required=required,
                    ),
                )

                def _make_handler(
                    cls_ref: type,
                    fn_name: str,
                    p_list: list[tuple[str, types.Schema, inspect.Parameter]],
                ) -> Callable[..., dict[str, Any]]:
                    def _run(**kwargs: Any) -> dict[str, Any]:
                        clean_kwargs: dict[str, Any] = {}
                        for name, schema, param in p_list:
                            if name in kwargs and kwargs[name] is not None:
                                clean_kwargs[name] = _coerce_arg(kwargs[name], schema)
                            elif param.default is not inspect._empty:
                                clean_kwargs[name] = param.default

                        try:
                            init_sig = inspect.signature(cls_ref.__init__)
                            if "output_dir" in init_sig.parameters:
                                OUTPUTS_DIR.mkdir(parents=True, exist_ok=True)
                                instance = cls_ref(output_dir=str(OUTPUTS_DIR))
                            else:
                                instance = cls_ref()
                            result = getattr(instance, fn_name)(**clean_kwargs)
                            serialized = _safe_serialize(result)
                            try:
                                data_obj = json.loads(serialized)
                            except json.JSONDecodeError:
                                data_obj = serialized
                            return {"ok": True, "data": data_obj}
                        except Exception as exc:
                            return {"ok": False, "error": f"{type(exc).__name__}: {exc}"}

                    return _run

                declarations.append(decl)
                handlers[tool_fn_name] = _make_handler(cls_obj, m_name, param_meta)
                loaded_names.append(tool_fn_name)

    return declarations, handlers, loaded_names


def _extract_text(response: Any) -> str:
    texts: list[str] = []
    for cand in getattr(response, "candidates", []) or []:
        content = getattr(cand, "content", None)
        for part in getattr(content, "parts", []) or []:
            text = getattr(part, "text", None)
            if text:
                texts.append(text)
    return "\n".join(texts).strip()


def _extract_function_calls(response: Any) -> list[Any]:
    calls: list[Any] = []
    for cand in getattr(response, "candidates", []) or []:
        content = getattr(cand, "content", None)
        for part in getattr(content, "parts", []) or []:
            fc = getattr(part, "function_call", None)
            if fc and getattr(fc, "name", None):
                calls.append(fc)
    return calls


def _run_interruptible(fn: Callable[[], Any], timeout_sec: float) -> Any:
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

    t = threading.Thread(target=_worker, daemon=True)
    t.start()

    deadline = time.monotonic() + timeout_sec
    while not done.is_set():
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            raise TimeoutError(f"Operation timed out after {timeout_sec:.0f}s")
        done.wait(timeout=min(0.2, remaining))

    if "error" in box:
        raise box["error"]
    return box.get("result")


def create_client(timeout_sec: int = 45) -> genai.Client:
    load_dotenv(BASE_DIR / ".env")
    api_key = os.environ.get("GEMINI_API_KEY", "").strip()
    if not api_key:
        raise RuntimeError(
            "Thieu GEMINI_API_KEY. Hay dat bien moi truong GEMINI_API_KEY hoac tao file .env "
            f"tai {BASE_DIR / '.env'}"
        )
    return genai.Client(
        api_key=api_key,
        http_options=types.HttpOptions(
            api_version="v1beta",
            timeout=timeout_sec * 1000,
            retry_options=types.HttpRetryOptions(attempts=2),
        ),
    )


def ask_gemini_with_tools(
    client: genai.Client,
    prompt: str,
    declarations: list[types.FunctionDeclaration],
    handlers: dict[str, Callable[..., dict[str, Any]]],
    model: str = DEFAULT_MODEL,
    temperature: float = 0.2,
    max_steps: int = 8,
    call_timeout_sec: float = 45.0,
    verbose: bool = True,
) -> dict[str, Any]:
    """Run a multi-turn function calling loop and return answer + tool call trace."""
    t0 = time.perf_counter()
    config = types.GenerateContentConfig(
        system_instruction=SYSTEM_INSTRUCTION,
        tools=[types.Tool(function_declarations=declarations)],
        temperature=temperature,
    )
    chat = client.chats.create(model=model, config=config)
    message_input: Any = prompt
    trace: list[dict[str, Any]] = []
    response: Any = None

    for step in range(1, max_steps + 1):
        if verbose:
            print(f"[STEP {step}] [API] Calling {model}...", flush=True)
        response = _run_interruptible(
            lambda msg=message_input: chat.send_message(msg),
            timeout_sec=call_timeout_sec,
        )
        func_calls = _extract_function_calls(response)

        if not func_calls:
            elapsed = round(time.perf_counter() - t0, 2)
            return {
                "answer": _extract_text(response),
                "trace": trace,
                "elapsed_sec": elapsed,
                "hit_max_steps": False,
            }

        response_parts: list[types.Part] = []
        for fc in func_calls:
            fname = fc.name
            fargs = dict(fc.args or {})
            if verbose:
                print(
                    f"[STEP {step}] [TOOL CALL] {fname}({json.dumps(fargs, ensure_ascii=False)})",
                    flush=True,
                )

            handler = handlers.get(fname)
            if handler is None:
                payload: dict[str, Any] = {"ok": False, "error": f"Handler not found: {fname}"}
            else:
                try:
                    payload = _run_interruptible(
                        lambda h=handler, kw=fargs: h(**kw),
                        timeout_sec=30.0,
                    )
                except TimeoutError as exc:
                    payload = {"ok": False, "error": str(exc)}

            ok = bool(payload.get("ok"))
            trace.append({"step": step, "tool": fname, "args": fargs, "ok": ok})
            if verbose:
                status = "OK" if ok else f"ERR: {payload.get('error')}"
                print(f"[STEP {step}] [TOOL RESULT] {fname} -> {status}", flush=True)

            response_parts.append(
                types.Part.from_function_response(
                    name=fname,
                    response={"result": _safe_serialize(payload)},
                )
            )

        message_input = response_parts

    # Final synthesis turn if max_steps was reached while still calling tools
    if verbose:
        print("[FINAL] [API] Synthesizing final answer...", flush=True)
    final_response = _run_interruptible(
        lambda: chat.send_message(
            "Da dat gioi han so luot goi tool. Hay tong hop cau tra loi ngan gon tu cac ket qua tool da co."
        ),
        timeout_sec=call_timeout_sec,
    )
    elapsed = round(time.perf_counter() - t0, 2)
    return {
        "answer": _extract_text(final_response),
        "trace": trace,
        "elapsed_sec": elapsed,
        "hit_max_steps": True,
    }


def ask_gemini_with_fallback(
    client: genai.Client,
    prompt: str,
    declarations: list[types.FunctionDeclaration],
    handlers: dict[str, Callable[..., dict[str, Any]]],
    model: str = DEFAULT_MODEL,
    max_steps: int = 8,
    verbose: bool = True,
) -> dict[str, Any]:
    """Run ask_gemini_with_tools and fall back to backup models on 503/429/404/Timeout."""
    candidates = [model] + [m for m in FALLBACK_MODELS if m != model]
    last_exc: Exception | None = None
    for idx, candidate in enumerate(candidates):
        try:
            res = ask_gemini_with_tools(
                client,
                prompt,
                declarations,
                handlers,
                model=candidate,
                max_steps=max_steps,
                verbose=verbose,
            )
            res["model"] = candidate
            return res
        except KeyboardInterrupt:
            raise
        except Exception as exc:
            last_exc = exc
            msg = str(exc)
            retryable = (
                isinstance(exc, TimeoutError)
                or "503" in msg
                or "429" in msg
                or "404" in msg
                or "UNAVAILABLE" in msg
                or "RESOURCE_EXHAUSTED" in msg
            )
            if retryable and idx + 1 < len(candidates):
                next_model = candidates[idx + 1]
                if verbose:
                    print(
                        f"[WARN] Model '{candidate}' failed ({type(exc).__name__}). "
                        f"Falling back to '{next_model}'...",
                        flush=True,
                    )
                continue
            raise
    assert last_exc is not None
    raise last_exc


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Test AutoEvolve_AI search_skills with Gemini 3.5 Flash function calling."
    )
    parser.add_argument("--model", default=DEFAULT_MODEL, help=f"Gemini model ID (default: {DEFAULT_MODEL})")
    parser.add_argument("--list-tools", action="store_true", help="List all discovered tools and exit")
    parser.add_argument("--prompt", type=str, help="Run a single prompt against Gemini with tools")
    parser.add_argument("--benchmark", action="store_true", help="Run built-in multi-tool benchmark suite")
    parser.add_argument("--chat", action="store_true", help="Start an interactive CLI chat loop")
    parser.add_argument("--max-steps", type=int, default=8, help="Max tool-calling turns per prompt")
    args = parser.parse_args()

    declarations, handlers, loaded_names = build_gemini_tools()
    print(f"[INFO] Loaded {len(declarations)} tools from {SKILLS_DIR}")

    if args.list_tools:
        for decl in declarations:
            params = list((decl.parameters.properties or {}).keys()) if decl.parameters else []
            req = list(decl.parameters.required or []) if decl.parameters else []
            print(f"  - {decl.name}({', '.join(params)}) | required={req}")
        return 0

    try:
        client = create_client()
    except RuntimeError as exc:
        print(f"[ERROR] {exc}")
        return 1

    print(f"[INFO] Initialized Gemini client with model: {args.model}")

    if args.benchmark:
        print("=" * 72, flush=True)
        for label, prompt in BENCHMARK_PROMPTS:
            print(f"\n[TEST] {label}", flush=True)
            print(f"[PROMPT] {prompt}", flush=True)
            try:
                res = ask_gemini_with_fallback(
                    client,
                    prompt,
                    declarations,
                    handlers,
                    model=args.model,
                    max_steps=args.max_steps,
                )
                tools_used = (
                    ", ".join(f"{t['tool']}({'OK' if t['ok'] else 'ERR'})" for t in res["trace"]) or "NONE"
                )
                print(
                    f"[SUMMARY] model={res['model']} | elapsed={res['elapsed_sec']}s | tools=[{tools_used}]",
                    flush=True,
                )
                print("[ANSWER]", flush=True)
                print(res["answer"] or "(empty)", flush=True)
            except KeyboardInterrupt:
                print("\n[INFO] Interrupted by user.", flush=True)
                return 130
            except Exception as exc:
                print(f"[ERROR] Test '{label}' failed: {type(exc).__name__}: {exc}", flush=True)
            print("-" * 72, flush=True)
        return 0

    if args.prompt:
        try:
            res = ask_gemini_with_fallback(
                client,
                args.prompt,
                declarations,
                handlers,
                model=args.model,
                max_steps=args.max_steps,
            )
            print(f"\n[ANSWER ({res['model']}, {res['elapsed_sec']}s)]", flush=True)
            print(res["answer"] or "(empty)", flush=True)
            return 0
        except KeyboardInterrupt:
            print("\n[INFO] Interrupted by user.", flush=True)
            return 130
        except Exception as exc:
            print(f"[ERROR] {type(exc).__name__}: {exc}", flush=True)
            return 1

    if args.chat:
        print("[INFO] Interactive mode started. Type 'exit' or 'quit' to stop.", flush=True)
        while True:
            try:
                user_msg = input("\nYou> ").strip()
            except (EOFError, KeyboardInterrupt):
                break
            if not user_msg or user_msg.lower() in ("exit", "quit"):
                break
            try:
                res = ask_gemini_with_fallback(
                    client,
                    user_msg,
                    declarations,
                    handlers,
                    model=args.model,
                    max_steps=args.max_steps,
                )
                print(f"\nGemini [{res['model']}] ({res['elapsed_sec']}s)>\n{res['answer']}\n", flush=True)
            except KeyboardInterrupt:
                print("\n[INFO] Cancelled current request.", flush=True)
            except Exception as exc:
                print(f"\n[ERROR] {type(exc).__name__}: {exc}\n", flush=True)
        return 0

    parser.print_help()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
