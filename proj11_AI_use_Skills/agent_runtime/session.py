"""Persistent multi-turn Gemini chat session with streaming, SQLite memory, TTL cache, and MLflow."""
from __future__ import annotations

import json
import time
from concurrent.futures import ThreadPoolExecutor
from typing import Any, Callable

from google import genai
from google.genai import types

from agent_runtime.compactor import CompactionStats, ContextCompactor
from agent_runtime.config import (
    DEFAULT_API_TIMEOUT_SEC,
    DEFAULT_COMPACT_TOKEN_THRESHOLD,
    DEFAULT_MAX_STEPS,
    DEFAULT_MODEL,
    DEFAULT_TOOL_TIMEOUT_SEC,
    DEFAULT_TOP_K,
    FALLBACK_MODELS,
    build_system_instruction,
)
from agent_runtime.executor import (
    extract_function_calls,
    extract_text,
    is_retryable_model_error,
    run_interruptible,
)
from agent_runtime.llm_router import MultiProviderRouter, UnifiedToolCall
from agent_runtime.memory_store import SQLiteMemoryStore
from agent_runtime.mlflow_tracker import MLflowTracker
from agent_runtime.schema_builder import safe_serialize, slim_tool_payload
from agent_runtime.skill_router import SkillRouter
from agent_runtime.telemetry import TokenUsage, extract_usage
from agent_runtime.tool_cache import ToolTTLCache


class GeminiSkillSession:
    """Manages multi-turn SQLite-persisted conversation, streaming, TTL cache, parallel tools, and MLflow."""

    def __init__(
        self,
        client: genai.Client,
        router: SkillRouter,
        handlers: dict[str, Callable[..., dict[str, Any]]],
        model: str = DEFAULT_MODEL,
        temperature: float = 0.2,
        top_k: int = DEFAULT_TOP_K,
        max_steps: int = DEFAULT_MAX_STEPS,
        call_timeout_sec: float = float(DEFAULT_API_TIMEOUT_SEC),
        tool_timeout_sec: float = float(DEFAULT_TOOL_TIMEOUT_SEC),
        max_parallel_tools: int = 6,
        stream: bool = True,
        memory_store: SQLiteMemoryStore | None = None,
        tool_cache: ToolTTLCache | None = None,
        mlflow_tracker: MLflowTracker | None = None,
        compactor: ContextCompactor | None = None,
        llm_router: MultiProviderRouter | None = None,
        session_id: str | None = None,
        persist_messages: bool = True,
    ):
        self.client = client
        self.router = router
        self.handlers = handlers
        self.model = model
        self.temperature = temperature
        self.top_k = top_k
        self.max_steps = max_steps
        self.call_timeout_sec = call_timeout_sec
        self.tool_timeout_sec = tool_timeout_sec
        self.max_parallel_tools = max_parallel_tools
        self.stream = stream
        self.persist_messages = persist_messages

        self.memory_store = memory_store or SQLiteMemoryStore()
        self.tool_cache = tool_cache or ToolTTLCache(self.memory_store, enabled=True)
        self.mlflow_tracker = mlflow_tracker or MLflowTracker(enabled=False)
        self.compactor = compactor or ContextCompactor(
            enabled=True,
            token_threshold=DEFAULT_COMPACT_TOKEN_THRESHOLD,
        )
        self.llm_router = llm_router or MultiProviderRouter(timeout_sec=int(call_timeout_sec))

        self.turn_count = 0
        self.pinned_tools: list[str] = []
        self.all_traces: list[dict[str, Any]] = []
        self.session_usage = TokenUsage()
        self._clean_history: list[types.Content] = []

        if persist_messages:
            if session_id:
                self.session_id = self.memory_store.ensure_session(session_id=session_id, model=self.model)
                rebuilt = self._rebuild_history_from_db(self.session_id)
                self._clean_history = list(rebuilt)
                self.turn_count = sum(1 for m in rebuilt if getattr(m, "role", "") == "user")
                self._chat = self._create_chat(model=self.model, history=rebuilt or None)
            else:
                self.session_id = self.memory_store.create_session(model=self.model)
                self._chat = self._create_chat(model=self.model, history=None)
        else:
            self.session_id = session_id or "ephemeral"
            self._chat = self._create_chat(model=self.model, history=None)

    def _rebuild_history_from_db(self, session_id: str) -> list[types.Content]:
        rows = self.memory_store.get_messages(session_id)
        history: list[types.Content] = []
        for row in rows:
            role = "user" if row["role"] == "user" else "model"
            text = (row["content"] or "").strip()
            if text:
                history.append(types.Content(role=role, parts=[types.Part.from_text(text=text)]))
        return history

    def _create_chat(self, model: str, history: list[Any] | None = None) -> Any:
        # Use a valid Gemini model ID for the native chat object when 9Router mode is selected
        gemini_model = model if model.startswith("gemini-") else DEFAULT_MODEL
        return self.client.chats.create(model=gemini_model, history=history)

    def _should_use_multi_router(self) -> bool:
        m = (self.model or "").lower()
        return m in ("auto", "9router", "groq", "cloudflare", "mistral") or m.startswith(
            ("llama", "@cf/", "groq", "cloudflare", "mistral", "open-mistral", "qwen", "openai/")
        )

    def _execute_turn_via_multi_router(
        self,
        prompt: str,
        active_decls: list[types.FunctionDeclaration],
        verbose: bool,
    ) -> dict[str, Any]:
        """Run a full multi-step tool loop via MultiProviderRouter (Gemini + Groq + Cloudflare)."""
        t0 = time.perf_counter()
        facts_text = self.memory_store.format_facts_for_prompt()
        sys_inst = build_system_instruction(user_facts_text=facts_text)

        messages: list[dict[str, Any]] = []
        for c in self._clean_history:
            txt = extract_text(type("R", (), {"candidates": [type("C", (), {"content": c})()]})(), strip=True)
            if txt:
                messages.append({"role": "user" if c.role == "user" else "assistant", "content": txt})
        messages.append({"role": "user", "content": prompt})

        trace: list[dict[str, Any]] = []
        turn_usage = TokenUsage()
        total_cache_hits = 0
        used_endpoint = self.model

        for step in range(1, self.max_steps + 1):
            if verbose:
                print(f"[STEP {step}] [9ROUTER] Routing ({self.model})...", flush=True)
            llm_res = self.llm_router.generate(
                system_instruction=sys_inst,
                messages=messages,
                declarations=active_decls,
                preferred=self.model,
                temperature=self.temperature,
                verbose=verbose,
            )
            used_endpoint = llm_res.endpoint_id
            turn_usage.add(llm_res.usage)

            if not llm_res.tool_calls:
                elapsed = round(time.perf_counter() - t0, 2)
                return {
                    "answer": llm_res.text,
                    "trace": trace,
                    "elapsed_sec": elapsed,
                    "model": used_endpoint,
                    "routed_tools": [d.name for d in active_decls],
                    "usage": turn_usage,
                    "cache_hits": total_cache_hits,
                    "streamed": False,
                    "hit_max_steps": False,
                }

            messages.append(
                {
                    "role": "assistant",
                    "content": llm_res.text or "",
                    "tool_calls": [
                        {"id": tc.id, "name": tc.name, "args": tc.args, "raw_part": tc.raw_part}
                        for tc in llm_res.tool_calls
                    ],
                }
            )
            response_parts, step_traces, step_hits = self._execute_tool_batch(step, llm_res.tool_calls, verbose=verbose)
            trace.extend(step_traces)
            total_cache_hits += step_hits

            for tc, part in zip(llm_res.tool_calls, response_parts):
                fr = getattr(part, "function_response", None)
                result_str = (getattr(fr, "response", None) or {}).get("result", "{}") if fr else "{}"
                messages.append(
                    {
                        "role": "tool",
                        "tool_call_id": tc.id,
                        "name": tc.name,
                        "content": str(result_str),
                    }
                )

        elapsed = round(time.perf_counter() - t0, 2)
        return {
            "answer": llm_res.text or "(max steps reached)",
            "trace": trace,
            "elapsed_sec": elapsed,
            "model": used_endpoint,
            "routed_tools": [d.name for d in active_decls],
            "usage": turn_usage,
            "cache_hits": total_cache_hits,
            "streamed": False,
            "hit_max_steps": True,
        }

    def _make_turn_config(
        self, active_decls: list[types.FunctionDeclaration]
    ) -> types.GenerateContentConfig:
        facts_text = self.memory_store.format_facts_for_prompt()
        return types.GenerateContentConfig(
            system_instruction=build_system_instruction(user_facts_text=facts_text),
            tools=[types.Tool(function_declarations=active_decls)] if active_decls else None,
            temperature=self.temperature,
        )

    def reset(self, new_title: str = "") -> None:
        self.turn_count = 0
        self.pinned_tools.clear()
        self.all_traces.clear()
        self._clean_history.clear()
        self.session_usage = TokenUsage()
        if self.persist_messages:
            self.session_id = self.memory_store.create_session(model=self.model, title=new_title)
        self._chat = self._create_chat(model=self.model, history=None)

    def load_session(self, session_id: str) -> int:
        """Load an existing SQLite session into active chat memory. Returns number of messages loaded."""
        rows = self.memory_store.get_messages(session_id)
        rebuilt = self._rebuild_history_from_db(session_id)
        self.session_id = self.memory_store.ensure_session(session_id=session_id, model=self.model)
        self.pinned_tools.clear()
        self.all_traces.clear()
        self._clean_history = list(rebuilt)
        self.session_usage = TokenUsage()
        self.turn_count = sum(1 for r in rows if r["role"] == "user")
        self._chat = self._create_chat(model=self.model, history=rebuilt or None)
        return len(rows)

    def compact_now(self, verbose: bool = True) -> CompactionStats:
        """Manually trigger Tier 2 rolling summarization on active chat history."""
        compacted, stats = self.compactor.summarize_old_turns(
            client=self.client,
            model=self.model,
            clean_history=self._clean_history,
            timeout_sec=self.call_timeout_sec,
        )
        self._clean_history = compacted
        self._chat = self._create_chat(model=self.model, history=self._clean_history or None)
        if verbose:
            if stats.summarized_turns > 0:
                print(
                    f"[COMPACT] Summarized {stats.summarized_turns} older turns: "
                    f"{stats.before_chars:,} -> {stats.after_chars:,} chars "
                    f"(~{stats.est_saved_tokens:,} tokens saved)",
                    flush=True,
                )
            else:
                print(
                    f"[COMPACT] Nothing to summarize yet (turns <= keep_recent_turns={self.compactor.keep_recent_turns}).",
                    flush=True,
                )
        return stats

    def switch_model(self, new_model: str, preserve_history: bool = True) -> None:
        history = None
        if preserve_history and self._chat is not None:
            try:
                history = list(self._chat.get_history())
            except Exception:
                history = None
        self.model = new_model
        self._chat = self._create_chat(model=self.model, history=history)

    def refresh_skills(
        self,
        router: SkillRouter,
        handlers: dict[str, Callable[..., dict[str, Any]]],
    ) -> None:
        """Hot-swap router and tool handlers in-place without losing conversation memory."""
        self.router = router
        self.handlers = handlers
        self.pinned_tools = [t for t in self.pinned_tools if t in handlers]
        self.tool_cache.clear()

    def _run_single_tool(self, fname: str, fargs: dict[str, Any]) -> tuple[dict[str, Any], int, bool]:
        t0 = time.perf_counter()
        cached = self.tool_cache.get(fname, fargs)
        if cached is not None:
            elapsed_ms = int((time.perf_counter() - t0) * 1000)
            return cached, elapsed_ms, True

        handler = self.handlers.get(fname)
        if handler is None:
            payload: dict[str, Any] = {"ok": False, "error": f"Handler not found: {fname}"}
        else:
            try:
                payload = run_interruptible(
                    lambda h=handler, kw=fargs: h(**kw),
                    timeout_sec=self.tool_timeout_sec,
                )
            except TimeoutError as exc:
                payload = {"ok": False, "error": str(exc)}

        if payload.get("ok"):
            self.tool_cache.set(fname, fargs, payload)

        elapsed_ms = int((time.perf_counter() - t0) * 1000)
        return payload, elapsed_ms, False

    def _execute_tool_batch(
        self,
        step: int,
        func_calls: list[Any],
        verbose: bool,
    ) -> tuple[list[types.Part], list[dict[str, Any]], int]:
        """Execute 1 or more function calls (concurrently when len > 1), preserving order."""
        call_specs: list[tuple[str, dict[str, Any]]] = []
        for fc in func_calls:
            fname = fc.name
            fargs = dict(fc.args or {})
            if fname not in self.pinned_tools:
                self.pinned_tools.append(fname)
            call_specs.append((fname, fargs))
            if verbose:
                print(
                    f"[STEP {step}] [TOOL CALL] {fname}({json.dumps(fargs, ensure_ascii=False)})",
                    flush=True,
                )

        if len(call_specs) == 1:
            fname, fargs = call_specs[0]
            results_list = [self._run_single_tool(fname, fargs)]
        else:
            if verbose:
                print(
                    f"[STEP {step}] [PARALLEL] Executing {len(call_specs)} tools concurrently...",
                    flush=True,
                )

            def _run_pool() -> list[tuple[dict[str, Any], int, bool]]:
                workers = min(len(call_specs), self.max_parallel_tools)
                with ThreadPoolExecutor(max_workers=workers) as pool:
                    futures = [pool.submit(self._run_single_tool, fn, fa) for fn, fa in call_specs]
                    return [fut.result() for fut in futures]

            results_list = run_interruptible(
                _run_pool,
                timeout_sec=self.tool_timeout_sec + 5.0,
            )

        response_parts: list[types.Part] = []
        step_traces: list[dict[str, Any]] = []
        cache_hits = 0

        for (fname, fargs), (payload, elapsed_ms, from_cache) in zip(call_specs, results_list):
            if from_cache:
                cache_hits += 1
            ok = bool(payload.get("ok"))
            step_traces.append(
                {
                    "step": step,
                    "tool": fname,
                    "args": fargs,
                    "ok": ok,
                    "elapsed_ms": elapsed_ms,
                    "cached": from_cache,
                }
            )
            if verbose:
                cache_tag = " [CACHE HIT]" if from_cache else ""
                status = (
                    f"OK ({elapsed_ms}ms){cache_tag}"
                    if ok
                    else f"ERR ({elapsed_ms}ms): {payload.get('error')}"
                )
                print(f"[STEP {step}] [TOOL RESULT] {fname} -> {status}", flush=True)

            response_parts.append(
                types.Part.from_function_response(
                    name=fname,
                    response={"result": slim_tool_payload(fname, payload)},
                )
            )

        return response_parts, step_traces, cache_hits

    def _call_model_step(
        self,
        message_input: Any,
        turn_config: types.GenerateContentConfig,
        stream_to_stdout: bool,
    ) -> tuple[str, list[Any], TokenUsage, bool]:
        """Call Gemini API (streaming or non-streaming) and return (text, func_calls, usage, printed)."""
        if not stream_to_stdout:
            response = run_interruptible(
                lambda msg=message_input, cfg=turn_config: self._chat.send_message(msg, config=cfg),
                timeout_sec=self.call_timeout_sec,
            )
            return (
                extract_text(response),
                extract_function_calls(response),
                extract_usage(response),
                False,
            )

        def _consume_stream() -> tuple[str, list[Any], TokenUsage, bool]:
            chunks_text: list[str] = []
            func_calls: list[Any] = []
            last_usage = TokenUsage(api_calls=1)
            header_printed = False

            for chunk in self._chat.send_message_stream(message_input, config=turn_config):
                fcs = extract_function_calls(chunk)
                if fcs:
                    func_calls.extend(fcs)
                txt = extract_text(chunk, strip=False)
                if txt:
                    if not header_printed:
                        print(f"\nGemini [{self.model}]>\n", end="", flush=True)
                        header_printed = True
                    print(txt, end="", flush=True)
                    chunks_text.append(txt)
                if getattr(chunk, "usage_metadata", None) is not None:
                    last_usage = extract_usage(chunk)

            if header_printed:
                print("\n", flush=True)
            return "".join(chunks_text).strip(), func_calls, last_usage, header_printed

        return run_interruptible(_consume_stream, timeout_sec=self.call_timeout_sec)

    def _execute_turn(
        self,
        prompt: str,
        active_decls: list[types.FunctionDeclaration],
        verbose: bool,
    ) -> dict[str, Any]:
        t0 = time.perf_counter()
        turn_config = self._make_turn_config(active_decls)
        message_input: Any = prompt
        trace: list[dict[str, Any]] = []
        turn_usage = TokenUsage()
        total_cache_hits = 0

        with self.mlflow_tracker.trace_span(
            name="agent_turn",
            span_type="AGENT",
            inputs={"prompt": prompt, "model": self.model, "session_id": self.session_id},
        ) as root_span:
            for step in range(1, self.max_steps + 1):
                if verbose:
                    print(f"[STEP {step}] [API] Calling {self.model}...", flush=True)

                with self.mlflow_tracker.trace_span(
                    name=f"llm_step_{step}",
                    span_type="LLM",
                    inputs={"step": step, "model": self.model},
                ):
                    text, func_calls, step_usage, streamed = self._call_model_step(
                        message_input=message_input,
                        turn_config=turn_config,
                        stream_to_stdout=(self.stream and verbose),
                    )
                turn_usage.add(step_usage)

                if not func_calls:
                    elapsed = round(time.perf_counter() - t0, 2)
                    if root_span is not None:
                        try:
                            root_span.set_outputs({"answer": text[:500], "elapsed_sec": elapsed})
                        except Exception:
                            pass
                    return {
                        "answer": text,
                        "trace": trace,
                        "elapsed_sec": elapsed,
                        "model": self.model,
                        "routed_tools": [d.name for d in active_decls],
                        "usage": turn_usage,
                        "cache_hits": total_cache_hits,
                        "streamed": streamed,
                        "hit_max_steps": False,
                    }

                with self.mlflow_tracker.trace_span(
                    name=f"tool_batch_step_{step}",
                    span_type="TOOL",
                    inputs={"tools": [fc.name for fc in func_calls]},
                ):
                    response_parts, step_traces, step_hits = self._execute_tool_batch(
                        step, func_calls, verbose=verbose
                    )
                trace.extend(step_traces)
                total_cache_hits += step_hits
                message_input = response_parts

            if verbose:
                print("[FINAL] [API] Synthesizing final answer...", flush=True)
            final_text, _, final_usage, streamed = self._call_model_step(
                message_input="Da dat gioi han so luot goi tool. Hay tong hop cau tra loi ngan gon tu cac ket qua tool da co.",
                turn_config=turn_config,
                stream_to_stdout=(self.stream and verbose),
            )
            turn_usage.add(final_usage)
            elapsed = round(time.perf_counter() - t0, 2)
            return {
                "answer": final_text,
                "trace": trace,
                "elapsed_sec": elapsed,
                "model": self.model,
                "routed_tools": [d.name for d in active_decls],
                "usage": turn_usage,
                "cache_hits": total_cache_hits,
                "streamed": streamed,
                "hit_max_steps": True,
            }

    def send(self, prompt: str, verbose: bool = True, run_name: str | None = None) -> dict[str, Any]:
        """Send a user message with routing, streaming, SQLite persistence, cache, and MLflow logging."""
        active_decls = self.router.route(
            prompt,
            top_k=self.top_k,
            pinned_names=self.pinned_tools,
        )
        if verbose and self.top_k > 0 and self.top_k < self.router.total_tools:
            if not active_decls:
                print(
                    f"[ROUTER] No-Tool Fast Path -> 0/{self.router.total_tools} tools (pure chat, ~90% tokens saved)",
                    flush=True,
                )
            else:
                routed_names = ", ".join(d.name or "" for d in active_decls)
                print(
                    f"[ROUTER] Selected {len(active_decls)}/{self.router.total_tools} tools: [{routed_names}]",
                    flush=True,
                )

        if self._should_use_multi_router():
            res = self._execute_turn_via_multi_router(prompt, active_decls, verbose=verbose)
            self.turn_count += 1
            self.all_traces.extend(res["trace"])
            self.session_usage.add(res["usage"])
            if self.compactor.enabled:
                self._clean_history, _ = self.compactor.prune_completed_turn(
                    raw_curated_history=self._clean_history,
                    prior_clean_history=self._clean_history,
                    user_prompt=prompt,
                    model_answer=res["answer"],
                    trace=res["trace"],
                )
            if self.persist_messages:
                self.memory_store.append_message(
                    session_id=self.session_id, role="user", content=prompt, model=res["model"]
                )
                self.memory_store.append_message(
                    session_id=self.session_id,
                    role="model",
                    content=res["answer"],
                    model=res["model"],
                    elapsed_sec=res["elapsed_sec"],
                    input_tokens=res["usage"].input_tokens,
                    output_tokens=res["usage"].output_tokens,
                )
            self.mlflow_tracker.log_turn(
                session_id=self.session_id,
                prompt=prompt,
                answer=res["answer"],
                model=res["model"],
                top_k=self.top_k,
                routed_tools=res["routed_tools"],
                trace=res["trace"],
                elapsed_sec=res["elapsed_sec"],
                input_tokens=res["usage"].input_tokens,
                output_tokens=res["usage"].output_tokens,
                thoughts_tokens=res["usage"].thoughts_tokens,
                total_tokens=res["usage"].total_tokens,
                est_cost_usd=res["usage"].estimate_cost_usd(res["model"]),
                cache_hits=res["cache_hits"],
                run_name=run_name,
            )
            if verbose:
                cache_note = f" | cache_hits={res['cache_hits']}" if res["cache_hits"] else ""
                print(
                    f"[TELEMETRY] model={res['model']} | elapsed={res['elapsed_sec']}s | "
                    f"{res['usage'].format_summary(res['model'])}{cache_note}",
                    flush=True,
                )
            return res

        try:
            history_snapshot = list(self._chat.get_history())
        except Exception:
            history_snapshot = None

        candidates = [self.model] + [m for m in FALLBACK_MODELS if m != self.model]
        last_exc: Exception | None = None

        for idx, candidate in enumerate(candidates):
            if candidate != self.model:
                self.model = candidate
                self._chat = self._create_chat(model=candidate, history=history_snapshot)
            try:
                res = self._execute_turn(prompt, active_decls, verbose=verbose)
                self.turn_count += 1
                self.all_traces.extend(res["trace"])
                self.session_usage.add(res["usage"])

                # Context Window Compaction (Tier 1: prune tool JSON bloat; Tier 2: rolling summary)
                if self.compactor.enabled:
                    try:
                        raw_curated = list(self._chat.get_history(curated=True))
                    except Exception:
                        raw_curated = []
                    self._clean_history, prune_stats = self.compactor.prune_completed_turn(
                        raw_curated_history=raw_curated,
                        prior_clean_history=self._clean_history,
                        user_prompt=prompt,
                        model_answer=res["answer"],
                        trace=res["trace"],
                    )
                    if verbose and prune_stats.est_saved_tokens >= 40:
                        print(
                            f"[COMPACT] Pruned raw tool JSON: {prune_stats.before_chars:,} -> "
                            f"{prune_stats.after_chars:,} chars (~{prune_stats.est_saved_tokens:,} tokens saved)",
                            flush=True,
                        )

                    if self.compactor.should_summarize(
                        last_input_tokens=res["usage"].peak_input_tokens,
                        clean_history=self._clean_history,
                    ):
                        self._clean_history, sum_stats = self.compactor.summarize_old_turns(
                            client=self.client,
                            model=self.model,
                            clean_history=self._clean_history,
                            timeout_sec=self.call_timeout_sec,
                        )
                        if verbose and sum_stats.summarized_turns > 0:
                            print(
                                f"[COMPACT] Auto-summarized {sum_stats.summarized_turns} older turns: "
                                f"{sum_stats.before_chars:,} -> {sum_stats.after_chars:,} chars "
                                f"(~{sum_stats.est_saved_tokens:,} tokens saved)",
                                flush=True,
                            )

                    self._chat = self._create_chat(model=self.model, history=self._clean_history or None)

                # Persist user & assistant messages to SQLite
                if self.persist_messages:
                    self.memory_store.append_message(
                        session_id=self.session_id,
                        role="user",
                        content=prompt,
                        model=res["model"],
                    )
                    self.memory_store.append_message(
                        session_id=self.session_id,
                        role="model",
                        content=res["answer"],
                        model=res["model"],
                        elapsed_sec=res["elapsed_sec"],
                        input_tokens=res["usage"].input_tokens,
                        output_tokens=res["usage"].output_tokens,
                    )

                # Log metrics/tags to MLflow if enabled
                self.mlflow_tracker.log_turn(
                    session_id=self.session_id,
                    prompt=prompt,
                    answer=res["answer"],
                    model=res["model"],
                    top_k=self.top_k,
                    routed_tools=res["routed_tools"],
                    trace=res["trace"],
                    elapsed_sec=res["elapsed_sec"],
                    input_tokens=res["usage"].input_tokens,
                    output_tokens=res["usage"].output_tokens,
                    thoughts_tokens=res["usage"].thoughts_tokens,
                    total_tokens=res["usage"].total_tokens,
                    est_cost_usd=res["usage"].estimate_cost_usd(res["model"]),
                    cache_hits=res["cache_hits"],
                    run_name=run_name,
                )

                if verbose:
                    cache_note = f" | cache_hits={res['cache_hits']}" if res["cache_hits"] else ""
                    print(
                        f"[TELEMETRY] elapsed={res['elapsed_sec']}s | "
                        f"{res['usage'].format_summary(res['model'])}{cache_note}",
                        flush=True,
                    )
                return res
            except KeyboardInterrupt:
                self._chat = self._create_chat(model=self.model, history=history_snapshot)
                raise
            except Exception as exc:
                last_exc = exc
                self._chat = self._create_chat(model=self.model, history=history_snapshot)
                if is_retryable_model_error(exc) and idx + 1 < len(candidates):
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
