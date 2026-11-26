"""CLI interface for tools, healthcheck, SkillRouter, SQLite memory, MLflow, and streaming chat."""
from __future__ import annotations

import argparse
from collections import defaultdict

from agent_runtime.compactor import ContextCompactor
from agent_runtime.config import (
    BENCHMARK_PROMPTS,
    DEFAULT_COMPACT_TOKEN_THRESHOLD,
    DEFAULT_MAX_STEPS,
    DEFAULT_MODEL,
    DEFAULT_TOP_K,
)
from agent_runtime.executor import create_client
from agent_runtime.healthcheck import print_healthcheck_report, run_healthcheck
from agent_runtime.llm_router import MultiProviderRouter
from agent_runtime.memory_store import SQLiteMemoryStore
from agent_runtime.mlflow_tracker import MLflowTracker
from agent_runtime.session import GeminiSkillSession
from agent_runtime.skill_registry import SkillRegistry
from agent_runtime.skill_router import SkillRouter
from agent_runtime.tool_cache import ToolTTLCache


def _print_tools(registry: SkillRegistry) -> None:
    grouped = defaultdict(list)
    for entry in registry.entries:
        grouped[entry.pack].append(entry)

    for pack, items in grouped.items():
        print(f"\n[{pack}] ({len(items)} tools)")
        for entry in items:
            decl = entry.declaration
            params = list((decl.parameters.properties or {}).keys()) if decl.parameters else []
            req = list(decl.parameters.required or []) if decl.parameters else []
            print(f"  - {entry.name}({', '.join(params)}) | required={req}")


def _print_sessions(store: SQLiteMemoryStore) -> None:
    sessions = store.list_sessions(limit=20)
    if not sessions:
        print("[INFO] No saved sessions in SQLite yet.")
        return
    print(f"{'SESSION_ID':<12} | {'MSGS':>4} | {'MODEL':<22} | {'UPDATED_AT':<20} | TITLE")
    print("-" * 88)
    for s in sessions:
        print(
            f"{s['session_id']:<12} | {s['message_count']:>4} | {s['model']:<22} | "
            f"{s['updated_at'][:19]:<20} | {s['title']}"
        )


def _print_router_status(llm_router: MultiProviderRouter) -> None:
    print(f"[9ROUTER] strategy={llm_router.strategy}")
    print(f"{'ENDPOINT':<36} | {'STATUS':<8} | {'REQ':>3} | {'OK':>3} | {'ERR':>3} | {'MS':>5} | DETAIL")
    print("-" * 100)
    for ep in llm_router.get_status():
        detail = f"cooldown {ep['cooldown_remaining_sec']}s" if ep["status"] == "cooldown" else ep["last_error"]
        print(
            f"{ep['endpoint_id']:<36} | {ep['status'].upper():<8} | {ep['requests']:>3} | "
            f"{ep['successes']:>3} | {ep['errors']:>3} | {ep['last_latency_ms']:>5} | {detail[:40]}"
        )


def _print_tool_stats(store: SQLiteMemoryStore) -> None:
    metrics = store.get_tool_metrics_map()
    if not metrics:
        print("[INFO] No tool execution telemetry recorded in SQLite yet.")
        return
    print(f"{'TOOL':<42} | {'CALLS':>5} | {'OK%':>6} | {'AVG_MS':>7} | {'CONSEC_FAIL':>11}")
    print("-" * 84)
    for name, m in metrics.items():
        calls = max(1, int(m["calls"]))
        ok_pct = (int(m["successes"]) / calls) * 100.0
        print(
            f"{name:<42} | {m['calls']:>5} | {ok_pct:>5.1f}% | {m['avg_ms']:>6.0f}ms | {m['consecutive_failures']:>11}"
        )


def _print_playbooks(store: SQLiteMemoryStore) -> None:
    playbooks = store.list_playbooks()
    if not playbooks:
        print("[INFO] No playbooks stored in SQLite.")
        return
    for pb in playbooks:
        print(f"  - [{pb['playbook_id']}] (used={pb['success_count']}) tools=[{pb['tools_csv']}]")
        print(f"    triggers: {pb['trigger_keywords']}")
        print(f"    hint    : {pb['strategy_hint']}")


def _print_facts(store: SQLiteMemoryStore) -> None:
    facts = store.get_facts()
    if not facts:
        print("[INFO] No long-term user facts stored yet.")
        return
    for f in facts:
        print(f"  - {f['key']} ({f['category']}): {f['value']}  [updated: {f['updated_at']}]")


def _run_chat_loop(session: GeminiSkillSession, registry: SkillRegistry) -> int:
    print(
        f"[INFO] Persistent chat started | session_id={session.session_id} | "
        f"stream={session.stream} | cache={session.tool_cache.enabled} | compact={session.compactor.enabled}",
        flush=True,
    )
    print(
        "[INFO] Commands: /sessions, /load <id>, /new [title], /compact, /facts, /remember k=v, /forget k, "
        "/cache-clear, /history, /reset, /model <id>, /topk <n>, /tools, exit",
        flush=True,
    )
    while True:
        try:
            user_msg = input("\nYou> ").strip()
        except (EOFError, KeyboardInterrupt):
            break
        if not user_msg or user_msg.lower() in ("exit", "quit"):
            break

        if user_msg.startswith("/"):
            parts = user_msg.split(maxsplit=1)
            cmd = parts[0].lower()
            arg = parts[1].strip() if len(parts) > 1 else ""
            if cmd in ("/reset", "/new"):
                session.reset(new_title=arg)
                print(f"[INFO] Started new session: {session.session_id}", flush=True)
            elif cmd == "/sessions":
                _print_sessions(session.memory_store)
            elif cmd == "/load":
                if not arg:
                    print("[WARN] Usage: /load <session_id>", flush=True)
                else:
                    cnt = session.load_session(arg)
                    print(f"[INFO] Loaded session '{session.session_id}' ({cnt} messages restored).", flush=True)
            elif cmd == "/facts":
                _print_facts(session.memory_store)
            elif cmd == "/remember":
                if "=" not in arg:
                    print("[WARN] Usage: /remember key=value", flush=True)
                else:
                    k, v = arg.split("=", 1)
                    saved = session.memory_store.set_fact(k.strip(), v.strip())
                    print(f"[INFO] Saved fact: {saved['key']} = {saved['value']}", flush=True)
            elif cmd == "/forget":
                if not arg:
                    print("[WARN] Usage: /forget <key>", flush=True)
                else:
                    ok = session.memory_store.delete_fact(arg)
                    print(f"[INFO] Forget '{arg}': {'deleted' if ok else 'not found'}", flush=True)
            elif cmd == "/cache-clear":
                removed = session.tool_cache.clear()
                print(f"[INFO] Cleared {removed} cached tool entries.", flush=True)
            elif cmd == "/compact":
                session.compact_now(verbose=True)
            elif cmd == "/router":
                _print_router_status(session.llm_router)
            elif cmd == "/stats":
                _print_tool_stats(session.memory_store)
            elif cmd == "/playbooks":
                _print_playbooks(session.memory_store)
            elif cmd == "/history":
                saved_tok = int(session.compactor.total_saved_chars / 3.8)
                print(
                    f"[INFO] session={session.session_id} | turns={session.turn_count} | model={session.model} | "
                    f"top_k={session.top_k} | cache_hits={session.tool_cache.hits} | "
                    f"compacted_saved=~{saved_tok:,}tok | pinned={session.pinned_tools}",
                    flush=True,
                )
                print(
                    f"[TELEMETRY TOTAL] {session.session_usage.format_summary(session.model)}",
                    flush=True,
                )
            elif cmd == "/model":
                if not arg:
                    print(f"[INFO] Current model: {session.model}", flush=True)
                else:
                    session.switch_model(arg, preserve_history=True)
                    print(f"[INFO] Switched model to: {session.model} (history preserved)", flush=True)
            elif cmd == "/topk":
                try:
                    session.top_k = max(0, int(arg))
                    print(f"[INFO] Updated router top_k={session.top_k}", flush=True)
                except ValueError:
                    print("[WARN] Usage: /topk <integer> (0 = all tools)", flush=True)
            elif cmd == "/tools":
                _print_tools(registry)
            else:
                print(
                    "[WARN] Unknown command. Available: /sessions, /load, /new, /facts, /remember, "
                    "/forget, /cache-clear, /history, /reset, /model, /topk, /tools",
                    flush=True,
                )
            continue

        try:
            res = session.send(user_msg, verbose=True)
            if not res.get("streamed"):
                print(f"\nGemini [{res['model']}] ({res['elapsed_sec']}s)>\n{res['answer']}\n", flush=True)
        except KeyboardInterrupt:
            print("\n[INFO] Cancelled current request (conversation history kept).", flush=True)
        except Exception as exc:
            print(f"\n[ERROR] {type(exc).__name__}: {exc}\n", flush=True)
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Run skills with Gemini function calling, SkillRouter, SQLite memory, TTL cache, streaming, and MLflow."
    )
    parser.add_argument("--model", default=DEFAULT_MODEL, help=f"Gemini model ID (default: {DEFAULT_MODEL})")
    parser.add_argument(
        "--pack",
        action="append",
        help="Optional skill pack subfolder under skills/ (can be repeated)",
    )
    parser.add_argument(
        "--top-k",
        type=int,
        default=DEFAULT_TOP_K,
        help=f"Tools selected per turn by SkillRouter (default: {DEFAULT_TOP_K}, 0 = all tools)",
    )
    parser.add_argument("--session", type=str, help="SQLite session ID to resume or create in --chat / --prompt")
    parser.add_argument("--sessions", action="store_true", help="List saved SQLite chat sessions and exit")
    parser.add_argument("--facts", action="store_true", help="List saved SQLite long-term user facts and exit")
    parser.add_argument("--tool-stats", action="store_true", help="Show adaptive SQLite tool execution telemetry and exit")
    parser.add_argument("--playbooks", action="store_true", help="List learned & seeded tool cooperation playbooks and exit")
    parser.add_argument("--router-status", action="store_true", help="Show 9Router multi-provider pool status and exit")
    parser.add_argument(
        "--check-providers",
        action="store_true",
        help="Fetch live model lists and ping-check configured Gemini, Groq, and Cloudflare endpoints",
    )
    parser.add_argument(
        "--sync-deps",
        action="store_true",
        help="Scan all skills/*/skill_*.py for missing allowlisted libraries and auto-install into .venv",
    )
    parser.add_argument("--no-stream", action="store_true", help="Disable streaming text output")
    parser.add_argument("--no-cache", action="store_true", help="Disable SQLite TTL tool cache")
    parser.add_argument("--no-compact", action="store_true", help="Disable automatic context window compaction")
    parser.add_argument(
        "--compact-threshold",
        type=int,
        default=DEFAULT_COMPACT_TOKEN_THRESHOLD,
        help=f"Input token threshold for Tier-2 rolling summary (default: {DEFAULT_COMPACT_TOKEN_THRESHOLD})",
    )
    parser.add_argument("--mlflow", action="store_true", help="Enable MLflow Tracing & Run logging (SQLite backend)")
    parser.add_argument("--mlflow-uri", type=str, default=None, help="Custom MLflow tracking URI (default: sqlite:///data/mlflow.db)")
    parser.add_argument("--list-tools", action="store_true", help="List all discovered tools grouped by pack")
    parser.add_argument("--healthcheck", action="store_true", help="Run concurrent smoke healthcheck across all tools")
    parser.add_argument("--healthcheck-offline", action="store_true", help="Run healthcheck for offline/local tools only")
    parser.add_argument("--include-browser", action="store_true", help="Include Playwright browser_reader tools in --healthcheck")
    parser.add_argument("--route-test", type=str, help="Test SkillRouter tool selection without calling Gemini API")
    parser.add_argument("--prompt", type=str, help="Run a single prompt against Gemini with tools")
    parser.add_argument("--benchmark", action="store_true", help="Run built-in multi-tool benchmark suite")
    parser.add_argument("--chat", action="store_true", help="Start an interactive multi-turn CLI chat session")
    parser.add_argument("--web", action="store_true", help="Launch the 2-Tab Web UI (Chat + Skill Studio)")
    parser.add_argument("--port", type=int, default=8000, help="Port for --web server (default: 8000)")
    parser.add_argument("--max-steps", type=int, default=DEFAULT_MAX_STEPS, help="Max tool-calling turns per prompt")
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)

    if args.web:
        import socket
        import uvicorn
        from agent_runtime.web_app import create_web_app

        def _pick_free_port(preferred: int) -> int:
            candidates = [preferred, 8888, 9000, 9090, 9876, 3000, 3030, 5050, 0]
            for p in candidates:
                with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                    try:
                        s.bind(("127.0.0.1", p))
                        return s.getsockname()[1]
                    except OSError:
                        continue
            return preferred

        chosen_port = _pick_free_port(args.port)
        if chosen_port != args.port:
            print(
                f"[WARN] Port {args.port} unavailable/reserved on Windows; switched to port {chosen_port}.",
                flush=True,
            )
        app = create_web_app(enable_mlflow=args.mlflow)
        print(f"[INFO] Starting 2-Tab Web UI at http://127.0.0.1:{chosen_port}", flush=True)
        uvicorn.run(app, host="127.0.0.1", port=chosen_port, log_level="info")
        return 0

    memory_store = SQLiteMemoryStore()
    if args.sessions:
        _print_sessions(memory_store)
        return 0
    if args.facts:
        _print_facts(memory_store)
        return 0
    if args.tool_stats:
        _print_tool_stats(memory_store)
        return 0
    if args.playbooks:
        _print_playbooks(memory_store)
        return 0
    if args.router_status:
        _print_router_status(MultiProviderRouter())
        return 0
    if args.sync_deps:
        from agent_runtime.config import SKILLS_ROOT
        from agent_runtime.skill_evolver import ensure_skill_dependencies

        all_logs: list[str] = []
        scanned = 0
        for p in sorted(SKILLS_ROOT.glob("*/skill_*.py")):
            scanned += 1
            code = p.read_text(encoding="utf-8", errors="replace")
            dep_logs = ensure_skill_dependencies(code, auto_install=True)
            for line in dep_logs:
                print(f"[{p.parent.name}/{p.name}] {line}", flush=True)
                all_logs.append(line)
        if not all_logs:
            print(f"[DEPS OK] Scanned {scanned} skill files — all allowlisted dependencies are already installed.")
        return 0
    if args.check_providers:
        import sys
        from agent_runtime.config import SKILLS_ROOT

        sys.path.insert(0, str(SKILLS_ROOT / "new_skills"))
        from skill_provider_model_checker import ProviderModelCheckerClient

        checker = ProviderModelCheckerClient()
        print("=== 1. LIVE AVAILABLE MODELS (Gemini / Groq / Cloudflare) ===")
        listed = checker.list_models("all")
        for prov, info in listed.items():
            if info.get("ok"):
                sample = ", ".join(info["models"][:12])
                extra = f" ... (+{info['count'] - 12} more)" if info["count"] > 12 else ""
                print(f"[{prov.upper()}] OK ({info['count']} models): {sample}{extra}")
            else:
                print(f"[{prov.upper()}] ERR: {info.get('error')}")

        print("\n=== 2. PING-CHECK CONFIGURED 9ROUTER ENDPOINTS ===")
        llm_r = MultiProviderRouter()
        seen_pairs: set[tuple[str, str]] = set()
        for ep in llm_r.endpoints:
            pair = (ep.provider, ep.model)
            if pair in seen_pairs:
                continue
            seen_pairs.add(pair)
            res = checker.check_model(ep.provider, ep.model)
            status = "PASS" if res.get("ok") else res.get("status", "FAIL")
            detail = f"{res.get('latency_ms', 0)}ms" if res.get("ok") else str(res.get("error", ""))[:90]
            print(f"  - {ep.provider:<10} | {ep.model:<42} | {status:<10} | {detail}")
        return 0

    registry = SkillRegistry(packs=args.pack)
    router = SkillRouter(registry.declarations)
    packs_summary = ", ".join(registry.loaded_packs) or "none"
    print(f"[INFO] Loaded {len(registry.entries)} tools across packs: [{packs_summary}]", flush=True)

    if args.list_tools:
        _print_tools(registry)
        return 0

    if args.healthcheck or args.healthcheck_offline:
        results = run_healthcheck(
            registry=registry,
            offline_only=args.healthcheck_offline,
            include_browser=args.include_browser,
        )
        return print_healthcheck_report(results)

    if args.route_test:
        routed = router.route(args.route_test, top_k=args.top_k)
        print(f"[ROUTER] Query: {args.route_test}")
        print(f"[ROUTER] Selected {len(routed)}/{router.total_tools} tools:")
        for decl in routed:
            print(f"  - {decl.name}")
        return 0

    try:
        client = create_client()
    except RuntimeError as exc:
        print(f"[ERROR] {exc}")
        return 1

    tool_cache = ToolTTLCache(memory_store, enabled=not args.no_cache)
    mlflow_tracker = MLflowTracker(enabled=args.mlflow, tracking_uri=args.mlflow_uri)
    compactor = ContextCompactor(
        enabled=not args.no_compact,
        token_threshold=args.compact_threshold,
    )

    print(
        f"[INFO] Initialized Gemini client | model={args.model} | router_top_k={args.top_k} | "
        f"stream={not args.no_stream} | cache={not args.no_cache} | "
        f"compact={compactor.enabled} | mlflow={mlflow_tracker.enabled}",
        flush=True,
    )

    if args.benchmark:
        print("=" * 72, flush=True)
        for label, prompt in BENCHMARK_PROMPTS:
            print(f"\n[TEST] {label}", flush=True)
            print(f"[PROMPT] {prompt}", flush=True)
            session = GeminiSkillSession(
                client=client,
                router=router,
                handlers=registry.handlers,
                model=args.model,
                top_k=args.top_k,
                max_steps=args.max_steps,
                stream=not args.no_stream,
                memory_store=memory_store,
                tool_cache=tool_cache,
                mlflow_tracker=mlflow_tracker,
                compactor=compactor,
                persist_messages=False,
            )
            try:
                res = session.send(prompt, verbose=True, run_name=f"bench_{label}")
                tools_used = (
                    ", ".join(f"{t['tool']}({'OK' if t['ok'] else 'ERR'})" for t in res["trace"]) or "NONE"
                )
                print(
                    f"[SUMMARY] model={res['model']} | elapsed={res['elapsed_sec']}s | tools=[{tools_used}]",
                    flush=True,
                )
                if not res.get("streamed"):
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
        session = GeminiSkillSession(
            client=client,
            router=router,
            handlers=registry.handlers,
            model=args.model,
            top_k=args.top_k,
            max_steps=args.max_steps,
            stream=not args.no_stream,
            memory_store=memory_store,
            tool_cache=tool_cache,
            mlflow_tracker=mlflow_tracker,
            compactor=compactor,
            session_id=args.session,
            persist_messages=bool(args.session),
        )
        try:
            res = session.send(args.prompt, verbose=True)
            if not res.get("streamed"):
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
        session = GeminiSkillSession(
            client=client,
            router=router,
            handlers=registry.handlers,
            model=args.model,
            top_k=args.top_k,
            max_steps=args.max_steps,
            stream=not args.no_stream,
            memory_store=memory_store,
            tool_cache=tool_cache,
            mlflow_tracker=mlflow_tracker,
            compactor=compactor,
            session_id=args.session,
            persist_messages=True,
        )
        return _run_chat_loop(session, registry)

    parser.print_help()
    return 0
