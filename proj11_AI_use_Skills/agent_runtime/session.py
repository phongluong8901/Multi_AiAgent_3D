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
    ESCALATION_TARGET_MODEL,
    FALLBACK_MODELS,
    MODEL_STRENGTH_RANK,
    build_system_instruction,
)
from agent_runtime.executor import (
    extract_function_calls,
    extract_text,
    is_retryable_model_error,
    run_interruptible,
)
from agent_runtime.llm_router import MultiProviderRouter, UnifiedToolCall
from agent_runtime.distillation_store import DistillationStore
from agent_runtime.memory_consolidator import MemoryConsolidator
from agent_runtime.memory_store import SQLiteMemoryStore
from agent_runtime.mlflow_tracker import MLflowTracker
from agent_runtime.profile_learner import detect_implicit_correction, extract_profile_candidates
from agent_runtime.schema_builder import safe_serialize, slim_tool_payload
from agent_runtime.skill_router import (
    DISCOVER_TOOLS_NAME,
    RUN_PIPELINE_DECLARATION,
    RUN_PIPELINE_NAME,
    SkillRouter,
    normalize_text,
)
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
        tool_risk_levels: dict[str, str] | None = None,
    ):
        self.client = client
        self.router = router
        self.handlers = handlers
        self.tool_risk_levels: dict[str, str] = dict(tool_risk_levels or {})
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
        self.distill_store = DistillationStore()
        self.tool_cache = tool_cache or ToolTTLCache(self.memory_store, enabled=True)
        self.mlflow_tracker = mlflow_tracker or MLflowTracker(enabled=False)
        self.compactor = compactor or ContextCompactor(
            enabled=True,
            token_threshold=DEFAULT_COMPACT_TOKEN_THRESHOLD,
        )
        self.llm_router = llm_router or MultiProviderRouter(timeout_sec=int(call_timeout_sec))

        self.turn_count = 0
        self.pinned_tools: list[str] = []
        self._recently_updated_tools: list[str] = []
        self.all_traces: list[dict[str, Any]] = []
        self.session_usage = TokenUsage()
        self._clean_history: list[types.Content] = []
        self._active_on_event: Callable[[dict[str, Any]], None] | None = None
        self._active_confirm_cb: Callable[[str, dict[str, Any], str], bool] | None = None
        self._approved_tools_in_turn: set[str] = set()
        self._working_memory: dict[str, Any] = {}
        self._wm_seq: int = 0
        self._last_user_prompt: str = ""
        self._last_model_answer: str = ""

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
        return m in ("auto", "9router", "groq", "cloudflare", "ollama", "local") or m.startswith(
            ("llama", "@cf/", "groq", "cloudflare", "qwen", "openai/", "ollama:")
        )

    def _execute_turn_via_multi_router(
        self,
        prompt: str,
        active_decls: list[types.FunctionDeclaration],
        verbose: bool,
        playbook_hint: str = "",
    ) -> dict[str, Any]:
        """Run a full multi-step tool loop via MultiProviderRouter (Gemini + Groq + Mistral + Cloudflare)."""
        t0 = time.perf_counter()
        facts_text = self.memory_store.format_facts_for_prompt(query=prompt)
        rules_text = self.memory_store.format_rules_for_prompt(query=prompt)
        persona_prompt = self.memory_store.get_persona_config()["effective_persona_prompt"]
        routed_names = [d.name for d in active_decls if d.name]
        antipatterns_text = self.memory_store.format_antipatterns_for_prompt(routed_names)
        prospective_text = self.memory_store.format_prospective_for_prompt(
            prompt=prompt,
            is_session_start=(self.turn_count == 0),
        )
        updated_tools_text = ", ".join(self._recently_updated_tools)
        sys_inst = build_system_instruction(
            user_facts_text=facts_text,
            playbook_hint=playbook_hint,
            user_rules_text=rules_text,
            persona_prompt=persona_prompt,
            antipatterns_text=antipatterns_text,
            prospective_text=prospective_text,
            updated_tools_text=updated_tools_text,
        )

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
        verified_once = False

        for step in range(1, self.max_steps + 1):
            if verbose:
                print(f"[STEP {step}] [9ROUTER] Routing ({self.model})...", flush=True)
            self._emit_event({"type": "status", "text": f"Bước {step}: Đang gọi model qua 9Router ({self.model})..."})
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
                if not verified_once and step < self.max_steps:
                    gap_msg = self._check_execution_gap(prompt, trace, llm_res.text)
                    if gap_msg:
                        verified_once = True
                        self._emit_event({"type": "status", "text": "Đang tự kiểm chứng kết quả thực thi..."})
                        messages.append({"role": "assistant", "content": llm_res.text or ""})
                        messages.append({"role": "user", "content": gap_msg})
                        continue
                if llm_res.text:
                    self._emit_event({"type": "token", "text": llm_res.text})
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
            response_parts, step_traces, step_hits = self._execute_tool_batch(
                step, llm_res.tool_calls, verbose=verbose, active_decls=active_decls, prompt=prompt
            )
            trace.extend(step_traces)
            total_cache_hits += step_hits
            self._escalate_backups_if_failed(step, step_traces, active_decls, response_parts, verbose=verbose)

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
        self,
        active_decls: list[types.FunctionDeclaration],
        playbook_hint: str = "",
        prompt: str = "",
    ) -> types.GenerateContentConfig:
        facts_text = self.memory_store.format_facts_for_prompt(query=prompt)
        rules_text = self.memory_store.format_rules_for_prompt(query=prompt)
        persona_prompt = self.memory_store.get_persona_config()["effective_persona_prompt"]
        routed_names = [d.name for d in active_decls if d.name]
        antipatterns_text = self.memory_store.format_antipatterns_for_prompt(routed_names)
        prospective_text = self.memory_store.format_prospective_for_prompt(
            prompt=prompt,
            is_session_start=(self.turn_count == 0),
        )
        updated_tools_text = ", ".join(self._recently_updated_tools)
        entities_text = self.memory_store.format_entities_for_prompt(query=prompt)
        cross_session_text = self.memory_store.format_cross_session_faint_memory(
            current_session_id=self.session_id,
            query=prompt,
            max_sessions=5,
        )
        cfg_kwargs: dict[str, Any] = {
            "system_instruction": build_system_instruction(
                user_facts_text=facts_text,
                playbook_hint=playbook_hint,
                user_rules_text=rules_text,
                persona_prompt=persona_prompt,
                antipatterns_text=antipatterns_text,
                prospective_text=prospective_text,
                updated_tools_text=updated_tools_text,
                entities_text=entities_text,
                cross_session_text=cross_session_text,
            ),
            "tools": [types.Tool(function_declarations=active_decls)] if active_decls else None,
            "temperature": self.temperature,
        }
        # Cap thinking budget on gemini-2.5-flash so multi-step tool loops don't burn 10s+ & thousands of thought tokens
        if "2.5-flash" in (self.model or ""):
            try:
                cfg_kwargs["thinking_config"] = types.ThinkingConfig(thinking_budget=256)
            except Exception:
                pass
        return types.GenerateContentConfig(**cfg_kwargs)

    def reset(self, new_title: str = "") -> None:
        # Auto-consolidate Episodic logs in background when closing an active multi-turn session
        if self.persist_messages and self.turn_count >= 2:
            try:
                MemoryConsolidator(self.memory_store, self.llm_router).consolidate_async(use_llm=True)
            except Exception:
                pass
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
        updated_tools: list[str] | None = None,
        tool_risk_levels: dict[str, str] | None = None,
    ) -> None:
        """Hot-swap router and tool handlers in-place without losing conversation memory."""
        self.router = router
        self.handlers = handlers
        if tool_risk_levels is not None:
            self.tool_risk_levels = dict(tool_risk_levels)
        self.pinned_tools = [t for t in self.pinned_tools if t in handlers]
        self.tool_cache.clear()
        if updated_tools:
            try:
                self.memory_store.reset_tool_health(updated_tools)
            except Exception:
                pass
            for t in updated_tools:
                if t not in self._recently_updated_tools:
                    self._recently_updated_tools.append(t)

    def _emit_event(self, payload: dict[str, Any]) -> None:
        cb = self._active_on_event
        if cb is not None:
            try:
                cb(payload)
            except Exception:
                pass

    def _needs_confirmation(self, fname: str, fargs: dict[str, Any]) -> tuple[bool, str]:
        """Only prompt Safety Gate for file/folder deletion, formatting, uninstall, or OS shutdown/restart (once per turn)."""
        if fname in self._approved_tools_in_turn:
            return False, ""
        action_val = str((fargs or {}).get("action") or "").strip().lower()
        method_part = fname.split("__", 1)[1].lower() if "__" in fname else fname.lower()
        dry_run = (fargs or {}).get("dry_run")
        if dry_run is True:
            return False, ""

        # Closing/killing apps (kill_process, terminate, stop) runs directly without nagging
        destructive_keywords = (
            "delete", "remove", "rm_", "wipe", "purge", "clean", "clear_",
            "format", "uninstall", "shutdown", "restart", "reboot",
        )
        if any(k in method_part for k in destructive_keywords):
            return True, f"Thao tác xóa/hủy dữ liệu ({method_part})"

        if action_val and any(k in action_val for k in destructive_keywords):
            return True, f"Thao tác xóa/nguy hiểm (action={action_val})"

        cmd_str = str((fargs or {}).get("command") or (fargs or {}).get("script") or "").lower()
        if cmd_str and any(tok in cmd_str for tok in ("remove-item", "del ", "rmdir", "rd ", "format ", "stop-computer", "restart-computer", "reg delete")):
            return True, "Lệnh hệ thống có thao tác xóa/tắt máy"

        return False, ""

    @staticmethod
    def _assess_prompt_complexity(prompt: str) -> tuple[bool, str]:
        """0ms heuristic detecting multi-step chaining or deep analytical tasks for upward-only model escalation."""
        norm = normalize_text(prompt)
        if not norm:
            return False, ""
        chain_signals = (" sau do ", " roi ", " dong thoi ", " ket hop ", " xong ", " va ve ", " va gui ", " va luu ", " va xuat ")
        deep_signals = ("phan tich sau", "so sanh chi tiet", "kien truc", "toi uu", "debug", "viet code", "viet script", "giai thich ban chat")
        if any(s in f" {norm} " for s in chain_signals):
            return True, "multi-step chaining"
        if any(s in norm for s in deep_signals):
            return True, "deep analysis/coding"
        if len(norm) >= 180 and (norm.count(",") >= 2 or norm.count(" va ") >= 2):
            return True, "multi-clause complex prompt"
        return False, ""

    @staticmethod
    def _check_execution_gap(prompt: str, trace: list[dict[str, Any]], answer: str) -> str | None:
        """Goal-vs-Trace Verifier: catch hallucinated completion or skipped action tools before final reply."""
        norm = normalize_text(prompt)
        if not norm:
            return None
        ok_traces = [t for t in trace if t.get("ok")]
        ans_norm = normalize_text(answer or "")

        # 1. Catch explicit fake tool-trace spoofing or hallucinated execution with ZERO real tool calls
        fake_trace_pattern = "[tool trace:" in (answer or "").lower()
        claimed_action_done = any(
            phrase in ans_norm
            for phrase in (
                "da thuc hien", "da ve hinh", "da di chuyen", "da sao chep", "da copy",
                "da xoa ", "da gui tin nhan", "da dong app", "da tat ", "thanh cong.",
            )
        )
        if fake_trace_pattern or (claimed_action_done and not ok_traces):
            return (
                "[SELF-VERIFY] CANH BAO AO GIAC: Cau tra loi truoc co chua chuoi gia '[Tool trace: ...]' "
                "hoac khang dinh 'Da thuc hien thanh cong' NHUNG thuc te trong luot nay KHONG CO bat ky tool call nao "
                "duoc chay that (0 tool calls)! TUYET DOI KHONG tu viet '[Tool trace: ...]'. "
                "Hay goi function call THAT ngay bay gio de thuc thi yeu cau cua nguoi dung."
            )

        ok_blob = " ".join(
            f"{t.get('tool', '')} {json.dumps(t.get('args') or {}, ensure_ascii=False)}"
            for t in ok_traces
        ).lower()

        intent_checks = [
            (("di chuyen", "chuyen file", "cho file", "move file"), ("move_file", "move_to", "draw_circle", "draw_zigzag", "gui_input_controller"), "di chuyển / thao tác"),
            (("chuot", "mouse", "hinh tron"), ("mouse_controller", "draw_circle", "move_to", "click_at", "gui_input_controller"), "điều khiển chuột"),
            (("nhan ban", "copy file", "sao chep file"), ("copy_file",), "sao chép tệp (copy_file)"),
            (("ve bieu do", "ve do thi", "ve chart"), ("render_chart", "get_disk_usage_chart"), "vẽ biểu đồ (chart_visualizer)"),
            (("stop cac container", "dung container", "tat container", "stop container"), ("stop_all_running", "control_container"), "dừng container Docker"),
        ]
        for triggers, required_tokens, label in intent_checks:
            if any(tr in norm for tr in triggers):
                if not any(rt in ok_blob for rt in required_tokens):
                    return (
                        f"[SELF-VERIFY] Yêu cầu của người dùng là '{label}', nhưng trong trace hiện tại CHƯA có tool call "
                        "nào thực thi thành công hành động này. Hãy gọi `discover_tools` để mở khóa tool phù hợp hoặc gọi "
                        "đúng action ngay bây giờ; nếu thực sự không thể thực hiện, hãy báo trung thực và tuyệt đối không nói 'Đã thực hiện'."
                    )
        return None

    def _store_working_memory(self, payload: dict[str, Any]) -> str | None:
        """Store structured list/table tool outputs in RAM as $mem_N for zero-token cross-tool passing."""
        if not isinstance(payload, dict) or not payload.get("ok"):
            return None
        data = payload.get("data") if isinstance(payload.get("data"), dict) else payload
        for key in ("emails", "rows", "items", "containers", "files", "results", "records", "table"):
            val = data.get(key) if isinstance(data, dict) else None
            if isinstance(val, list) and len(val) >= 1:
                self._wm_seq += 1
                ref = f"$mem_{self._wm_seq}"
                self._working_memory[ref] = val
                # Keep RAM bounded to last 20 working memory refs
                if len(self._working_memory) > 20:
                    oldest = next(iter(self._working_memory))
                    self._working_memory.pop(oldest, None)
                return ref
        return None

    def _resolve_working_memory_refs(self, args: dict[str, Any]) -> dict[str, Any]:
        """Resolve '$mem_N' references in tool arguments (auto-converts list[dict] -> 2D rows matrix for 'rows')."""
        if not isinstance(args, dict) or not self._working_memory:
            return dict(args or {})
        out: dict[str, Any] = {}
        for k, v in args.items():
            if isinstance(v, str) and v.strip() in self._working_memory:
                raw_val = self._working_memory[v.strip()]
                if k == "rows" and isinstance(raw_val, list) and raw_val and isinstance(raw_val[0], dict):
                    headers = list(raw_val[0].keys())
                    matrix = [headers] + [[str(row.get(h, "")) for h in headers] for row in raw_val]
                    out[k] = matrix
                else:
                    out[k] = raw_val
            elif isinstance(v, dict):
                out[k] = self._resolve_working_memory_refs(v)
            else:
                out[k] = v
        return out

    def _repair_tool_args(self, fname: str, fargs: dict[str, Any]) -> dict[str, Any]:
        """0ms Fuzzy Parameter Repair: remap common LLM synonym keys against the tool's real schema."""
        if not isinstance(fargs, dict):
            return {}
        decl = self.router._by_name.get(fname)
        params = getattr(decl, "parameters", None) if decl else None
        props = getattr(params, "properties", None) if params else None
        if not isinstance(props, dict) or not props:
            return dict(fargs)

        aliases: dict[str, tuple[str, ...]] = {
            "title": ("sheet_name", "doc_name", "file_name", "filename", "name"),
            "filename": ("file_name", "name", "output_file"),
            "path": ("file_path", "filepath", "target_path", "dir_path", "folder"),
            "directory": ("folder", "dir", "dir_path", "path"),
            "message": ("msg", "text", "content", "body"),
            "content": ("text", "body", "message"),
            "query": ("q", "search", "keyword", "term"),
            "url": ("link", "href", "uri"),
            "limit": ("max_results", "count", "top_k", "n"),
        }
        repaired = dict(fargs)
        for target_key, syn_list in aliases.items():
            if target_key in props and target_key not in repaired:
                for syn in syn_list:
                    if syn in repaired and syn not in props:
                        repaired[target_key] = repaired.pop(syn)
                        break
        return repaired

    def _record_entities_from_payload(self, fname: str, fargs: dict[str, Any], payload: dict[str, Any]) -> None:
        """Auto-populate Structured Entity Memory (Sheets, Docs, Files, Charts) from successful tool calls."""
        if not isinstance(payload, dict) or not payload.get("ok"):
            return
        data = payload.get("data") if isinstance(payload.get("data"), dict) else payload
        if not isinstance(data, dict):
            return
        try:
            url = str(data.get("url") or "")
            title = str(data.get("title") or fargs.get("title") or "")
            if "docs.google.com/spreadsheets" in url:
                self.memory_store.record_entity("google_sheet", title or "Google Sheet", url, {"file_id": data.get("file_id", "")})
            elif "docs.google.com/document" in url:
                self.memory_store.record_entity("google_doc", title or "Google Doc", url, {"file_id": data.get("file_id", "")})
            for pkey in ("output_path", "saved_path", "chart_path", "file_path", "path"):
                pval = str(data.get(pkey) or "")
                if pval and ("." in pval) and len(pval) < 260:
                    from pathlib import Path as _P

                    self.memory_store.record_entity("file", _P(pval).name, pval, {"tool": fname})
                    break
        except Exception:
            pass

    @staticmethod
    def _extract_vision_part(fname: str, payload: dict[str, Any]) -> types.Part | None:
        """Multimodal Vision Execution: attach PNG/JPG bytes whenever a tool returns screenshot_path/image_path."""
        if not isinstance(payload, dict) or not payload.get("ok"):
            return None
        data = payload.get("data") if isinstance(payload.get("data"), dict) else payload
        if not isinstance(data, dict):
            return None
        # Always attach explicit screenshot_path / image_path; also attach saved_path/output_path for visual tools
        explicit_keys = ("screenshot_path", "image_path")
        visual_tool = any(k in fname.lower() for k in ("screen_capture", "screenshot", "pdf_capture", "chart_visualizer", "zalo"))
        keys = explicit_keys + (("saved_path", "output_path", "path") if visual_tool else ())
        for pkey in keys:
            pval = str(data.get(pkey) or "").strip()
            if pval and pval.lower().endswith((".png", ".jpg", ".jpeg")):
                try:
                    from pathlib import Path as _P

                    fp = _P(pval)
                    if fp.is_file() and 0 < fp.stat().st_size <= 2_000_000:
                        mime = "image/png" if pval.lower().endswith(".png") else "image/jpeg"
                        return types.Part.from_bytes(data=fp.read_bytes(), mime_type=mime)
                except Exception:
                    return None
        return None

    def _run_single_tool(
        self,
        fname: str,
        fargs: dict[str, Any],
        active_decls: list[types.FunctionDeclaration] | None = None,
    ) -> tuple[dict[str, Any], int, bool]:
        t0 = time.perf_counter()
        if fname == RUN_PIPELINE_NAME:
            raw_steps = fargs.get("steps") or []
            if not isinstance(raw_steps, list) or not raw_steps:
                return {"ok": False, "error": "run_tool_pipeline requires non-empty 'steps' list."}, 0, False
            step_results = []
            for idx, st in enumerate(raw_steps[:5], start=1):
                if not isinstance(st, dict) or not st.get("tool"):
                    continue
                sub_tool = str(st["tool"]).strip()
                raw_aj = st.get("args_json") or "{}"
                try:
                    sub_args = json.loads(raw_aj) if isinstance(raw_aj, str) else dict(raw_aj)
                except Exception:
                    sub_args = {}
                sub_payload, sub_ms, _ = self._run_single_tool(sub_tool, sub_args, active_decls=active_decls)
                save_as = str(st.get("save_as") or "").strip()
                if save_as and sub_payload.get("ok"):
                    key_ref = save_as if save_as.startswith("$") else f"${save_as}"
                    self._working_memory[key_ref] = sub_payload.get("data", sub_payload)
                step_results.append(
                    {
                        "step": idx,
                        "tool": sub_tool,
                        "ok": bool(sub_payload.get("ok")),
                        "elapsed_ms": sub_ms,
                        "preview": slim_tool_payload(sub_tool, sub_payload)[:600],
                    }
                )
                if not sub_payload.get("ok"):
                    break
            elapsed_ms = int((time.perf_counter() - t0) * 1000)
            all_ok = bool(step_results) and all(r["ok"] for r in step_results)
            return {"ok": all_ok, "data": {"pipeline_steps": step_results}}, elapsed_ms, False
        if fname == DISCOVER_TOOLS_NAME:
            query = str(fargs.get("query") or "").strip()
            top_k = min(int(fargs.get("top_k") or 2), 3)
            exclude = [d.name for d in (active_decls or []) if d.name]
            metrics_map = self.memory_store.get_tool_metrics_map()
            unlocked = self.router.discover(query=query, exclude_names=exclude, limit=top_k, metrics_map=metrics_map)
            if active_decls is not None:
                for decl in unlocked:
                    active_decls.append(decl)
            unlocked_names = [d.name for d in unlocked if d.name]
            elapsed_ms = int((time.perf_counter() - t0) * 1000)
            self._emit_event(
                {
                    "type": "tool_end",
                    "tool": fname,
                    "ok": True,
                    "elapsed_ms": elapsed_ms,
                    "cached": False,
                    "error": "",
                }
            )
            return (
                {
                    "ok": True,
                    "data": {
                        "query": query,
                        "unlocked_tools": unlocked_names,
                        "note": (
                            f"Đã mở khóa {len(unlocked_names)} tool mới: {', '.join(unlocked_names)}. Hãy gọi trực tiếp ở bước kế tiếp!"
                            if unlocked_names
                            else "Không tìm thấy tool mới nào khác trong kho 160+ tools cho truy vấn này."
                        ),
                    },
                    "_discovered_new": bool(unlocked_names),
                },
                elapsed_ms,
                False,
            )
        handler = self.handlers.get(fname)
        if handler is None and "__" not in fname:
            # Auto-resolve when LLM omits method suffix (e.g. 'web_search' -> 'web_search__search')
            prefix_matches = [k for k in self.handlers if k.startswith(f"{fname}__")]
            if len(prefix_matches) == 1:
                fname = prefix_matches[0]
                handler = self.handlers[fname]

        # Resolve Working Memory ($mem_N) references & apply 0ms Fuzzy Parameter Repair
        fargs = self._resolve_working_memory_refs(fargs)
        fargs = self._repair_tool_args(fname, fargs)

        # Human-in-the-Loop Safety Gate for high-risk / mutating PC Automation tools
        needs_confirm, risk_reason = self._needs_confirmation(fname, fargs)
        if needs_confirm and self._active_confirm_cb is not None:
            self._emit_event({"type": "status", "text": f"Đang chờ xác nhận an toàn cho {fname}..."})
            approved = False
            try:
                approved = bool(self._active_confirm_cb(fname, fargs, risk_reason))
            except Exception:
                approved = False
            if approved:
                self._approved_tools_in_turn.add(fname)
            else:
                elapsed_ms = int((time.perf_counter() - t0) * 1000)
                payload = {
                    "ok": False,
                    "error": f"Người dùng đã từ chối thao tác '{fname}' qua Cổng xác nhận an toàn (Safety Gate).",
                    "rejected_by_user": True,
                }
                self._emit_event(
                    {
                        "type": "tool_end",
                        "tool": fname,
                        "ok": False,
                        "elapsed_ms": elapsed_ms,
                        "cached": False,
                        "error": payload["error"],
                    }
                )
                return payload, elapsed_ms, False

        self._emit_event({"type": "tool_start", "tool": fname, "args": fargs})

        cached = self.tool_cache.get(fname, fargs)
        if cached is not None:
            elapsed_ms = int((time.perf_counter() - t0) * 1000)
            self._emit_event(
                {"type": "tool_end", "tool": fname, "ok": True, "elapsed_ms": elapsed_ms, "cached": True, "error": ""}
            )
            return cached, elapsed_ms, True

        if handler is None:
            payload = {"ok": False, "error": f"Handler not found: {fname}"}
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
            wm_ref = self._store_working_memory(payload)
            if wm_ref:
                payload = dict(payload)
                payload["_working_memory_ref"] = wm_ref
            self._record_entities_from_payload(fname, fargs, payload)

        elapsed_ms = int((time.perf_counter() - t0) * 1000)
        ok_flag = bool(payload.get("ok"))
        err_str = str(payload.get("error") or "")
        self._emit_event(
            {
                "type": "tool_end",
                "tool": fname,
                "ok": ok_flag,
                "elapsed_ms": elapsed_ms,
                "cached": False,
                "error": err_str,
            }
        )
        try:
            self.memory_store.record_tool_execution(
                tool_name=fname,
                ok=ok_flag,
                elapsed_ms=elapsed_ms,
                error=err_str,
            )
            self.memory_store.record_episodic_tool_log(
                session_id=self.session_id,
                tool_name=fname,
                args_dict=fargs,
                ok=ok_flag,
                elapsed_ms=elapsed_ms,
                error_text=err_str,
                output_snippet="" if not ok_flag else safe_serialize(payload.get("data"))[:260],
            )
            if not ok_flag and err_str and not payload.get("rejected_by_user"):
                self.memory_store.record_tool_antipattern(
                    tool_name=fname,
                    error_text=err_str,
                    args_dict=fargs,
                )
        except Exception:
            pass
        return payload, elapsed_ms, False

    def _escalate_backups_if_failed(
        self,
        step: int,
        step_traces: list[dict[str, Any]],
        active_decls: list[types.FunctionDeclaration],
        response_parts: list[types.Part],
        verbose: bool,
    ) -> bool:
        """Unlock lower-rated backup tools dynamically when a higher-rated primary tool fails."""
        failed_names = [str(t["tool"]) for t in step_traces if not t.get("ok")]
        if not failed_names:
            return False

        backups = self.router.get_backup_declarations(failed_names, active_decls)
        if not backups:
            return False

        backup_names = [b.name or "" for b in backups]
        active_decls.extend(backups)
        if verbose:
            print(
                f"[STEP {step}] [FALLBACK] Primary tool {failed_names} failed -> "
                f"unlocked backup tool(s): {backup_names}",
                flush=True,
            )

        # Annotate failed function_response so the LLM immediately tries the unlocked backup tool
        hint = f" [BACKUP UNLOCKED: Hay thu goi tool du phong {', '.join(backup_names)}]"
        for idx, tr in enumerate(step_traces):
            if not tr.get("ok") and idx < len(response_parts):
                fr = getattr(response_parts[idx], "function_response", None)
                if fr and isinstance(getattr(fr, "response", None), dict):
                    fr.response["result"] = str(fr.response.get("result", "")) + hint
        return True

    @staticmethod
    def _redact_sensitive_args(args: dict[str, Any] | None) -> dict[str, Any]:
        """Mask passwords/secrets before logging traces to UI, terminal, or SQLite."""
        if not isinstance(args, dict):
            return {}
        out: dict[str, Any] = {}
        for k, v in args.items():
            kl = str(k).lower()
            if any(s in kl for s in ("pass", "secret", "token", "api_key", "credential")):
                out[k] = "***[ENCRYPTED_IN_VAULT]***" if v else ""
            elif isinstance(v, dict):
                out[k] = GeminiSkillSession._redact_sensitive_args(v)
            else:
                out[k] = v
        return out

    def _execute_tool_batch(
        self,
        step: int,
        func_calls: list[Any],
        verbose: bool,
        active_decls: list[types.FunctionDeclaration] | None = None,
        prompt: str = "",
    ) -> tuple[list[types.Part], list[dict[str, Any]], int]:
        """Execute 1 or more function calls (concurrently when len > 1), preserving order."""
        call_specs: list[tuple[str, dict[str, Any]]] = []
        for fc in func_calls:
            fname = fc.name
            fargs = dict(fc.args or {})
            if fname != DISCOVER_TOOLS_NAME and fname not in self.pinned_tools:
                self.pinned_tools.append(fname)
            call_specs.append((fname, fargs))
            if verbose:
                safe_args = self._redact_sensitive_args(fargs)
                print(
                    f"[STEP {step}] [TOOL CALL] {fname}({json.dumps(safe_args, ensure_ascii=False)})",
                    flush=True,
                )

        if len(call_specs) == 1:
            fname, fargs = call_specs[0]
            results_list = [self._run_single_tool(fname, fargs, active_decls=active_decls)]
        else:
            if verbose:
                print(
                    f"[STEP {step}] [PARALLEL] Executing {len(call_specs)} tools concurrently...",
                    flush=True,
                )

            def _run_pool() -> list[tuple[dict[str, Any], int, bool]]:
                workers = min(len(call_specs), self.max_parallel_tools)
                with ThreadPoolExecutor(max_workers=workers) as pool:
                    futures = [pool.submit(self._run_single_tool, fn, fa, active_decls) for fn, fa in call_specs]
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
            err_msg = "" if ok else str(payload.get("error") or "")
            tb_msg = "" if ok else str(payload.get("traceback") or "")
            step_traces.append(
                {
                    "step": step,
                    "tool": fname,
                    "args": self._redact_sensitive_args(fargs),
                    "ok": ok,
                    "elapsed_ms": elapsed_ms,
                    "cached": from_cache,
                    "error": err_msg,
                    "traceback": tb_msg,
                    "output_preview": safe_serialize(payload.get("data"))[:400] if ok else "",
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
                    response={"result": slim_tool_payload(fname, payload, query=prompt)},
                )
            )
            vision_part = self._extract_vision_part(fname, payload)
            if vision_part is not None:
                response_parts.append(vision_part)

        return response_parts, step_traces, cache_hits

    def _call_model_step(
        self,
        message_input: Any,
        turn_config: types.GenerateContentConfig,
        stream_to_stdout: bool,
    ) -> tuple[str, list[Any], TokenUsage, bool]:
        """Call Gemini API (streaming or non-streaming) and return (text, func_calls, usage, printed)."""
        should_stream = stream_to_stdout or (self._active_on_event is not None)
        if not should_stream:
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
                    if stream_to_stdout:
                        if not header_printed:
                            print(f"\nGemini [{self.model}]>\n", end="", flush=True)
                            header_printed = True
                        print(txt, end="", flush=True)
                    self._emit_event({"type": "token", "text": txt})
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
        playbook_hint: str = "",
    ) -> dict[str, Any]:
        t0 = time.perf_counter()
        turn_config = self._make_turn_config(active_decls, playbook_hint=playbook_hint, prompt=prompt)
        message_input: Any = prompt
        trace: list[dict[str, Any]] = []
        turn_usage = TokenUsage()
        total_cache_hits = 0
        verified_once = False
        consecutive_tool_failures = 0

        # Speculative Step-0 Execution: pre-run deterministic read-only tool in 0ms before LLM Step 1
        spec_plan = self.router.plan_speculative_call(prompt)
        if spec_plan is not None:
            spec_tool, spec_args = spec_plan
            if spec_tool in self.handlers:
                self._emit_event({"type": "status", "text": f"Chạy trước tức thì {spec_tool} (Speculative Step 0)..."})
                sp_payload, sp_ms, sp_cached = self._run_single_tool(spec_tool, spec_args, active_decls=active_decls)
                if sp_cached:
                    total_cache_hits += 1
                sp_ok = bool(sp_payload.get("ok"))
                trace.append(
                    {
                        "step": 0,
                        "tool": spec_tool,
                        "args": self._redact_sensitive_args(spec_args),
                        "ok": sp_ok,
                        "elapsed_ms": sp_ms,
                        "cached": sp_cached,
                        "error": "" if sp_ok else str(sp_payload.get("error") or ""),
                        "traceback": "",
                        "output_preview": safe_serialize(sp_payload.get("data"))[:400] if sp_ok else "",
                    }
                )
                if sp_ok:
                    slim_sp = slim_tool_payload(spec_tool, sp_payload, query=prompt)
                    message_input = (
                        f"{prompt}\n\n[DU LIEU THUC TE DA LAY SAN TU TOOL `{spec_tool}` (ok=True, {sp_ms}ms)]:\n"
                        f"{slim_sp}\n(Hay tong hop truc tiep cau tra loi tu du lieu thuc te tren, khong can goi lai tool nay.)"
                    )

        with self.mlflow_tracker.trace_span(
            name="agent_turn",
            span_type="AGENT",
            inputs={"prompt": prompt, "model": self.model, "session_id": self.session_id},
        ) as root_span:
            for step in range(1, self.max_steps + 1):
                if verbose:
                    print(f"[STEP {step}] [API] Calling {self.model}...", flush=True)
                self._emit_event({"type": "status", "text": f"Bước {step}: Đang suy luận với {self.model}..."})

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
                    if not verified_once and step < self.max_steps:
                        gap_msg = self._check_execution_gap(prompt, trace, text)
                        if gap_msg:
                            verified_once = True
                            if not active_decls:
                                unlocked = self.router.discover(
                                    query=prompt,
                                    exclude_names=(),
                                    limit=6,
                                    metrics_map=self.memory_store.get_tool_metrics_map(),
                                )
                                if unlocked:
                                    active_decls.extend(unlocked)
                                    turn_config = self._make_turn_config(
                                        active_decls, playbook_hint=playbook_hint, prompt=prompt
                                    )
                            self._emit_event({"type": "status", "text": "Đang tự kiểm chứng kết quả thực thi..."})
                            message_input = gap_msg
                            continue
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

                prev_decl_count = len(active_decls)
                with self.mlflow_tracker.trace_span(
                    name=f"tool_batch_step_{step}",
                    span_type="TOOL",
                    inputs={"tools": [fc.name for fc in func_calls]},
                ):
                    response_parts, step_traces, step_hits = self._execute_tool_batch(
                        step, func_calls, verbose=verbose, active_decls=active_decls, prompt=prompt
                    )
                trace.extend(step_traces)
                total_cache_hits += step_hits
                escalated = self._escalate_backups_if_failed(
                    step, step_traces, active_decls, response_parts, verbose=verbose
                )
                # Mid-Turn Failure Escalation (upward-only): if >=2 consecutive failures on weaker model, upgrade mid-turn
                if step_traces and all(not t.get("ok") for t in step_traces):
                    consecutive_tool_failures += 1
                else:
                    consecutive_tool_failures = 0
                cur_rank = MODEL_STRENGTH_RANK.get(self.model, 99)
                esc_rank = MODEL_STRENGTH_RANK.get(ESCALATION_TARGET_MODEL, 3)
                if consecutive_tool_failures >= 2 and cur_rank < esc_rank:
                    if verbose:
                        print(f"[ESCALATE MID-TURN] {self.model} -> {ESCALATION_TARGET_MODEL} (consecutive tool errors)", flush=True)
                    self._emit_event({"type": "status", "text": f"Gặp lỗi liên tiếp -> Tự nâng cấp model lên {ESCALATION_TARGET_MODEL}..."})
                    self.switch_model(ESCALATION_TARGET_MODEL, preserve_history=True)
                    consecutive_tool_failures = 0
                if escalated or len(active_decls) > prev_decl_count:
                    turn_config = self._make_turn_config(active_decls, playbook_hint=playbook_hint, prompt=prompt)
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

    def _record_playbook_if_applicable(self, prompt: str, trace: list[dict[str, Any]]) -> None:
        if not trace or not all(t.get("ok") for t in trace):
            return
        ordered = [str(t["tool"]) for t in trace if t.get("tool") and t.get("tool") != DISCOVER_TOOLS_NAME]
        action_steps: list[str] = []
        for t in trace:
            tname = str(t.get("tool") or "")
            if not tname or tname == DISCOVER_TOOLS_NAME:
                continue
            targs = t.get("args") or {}
            act = targs.get("action") if isinstance(targs, dict) else None
            action_steps.append(f"{tname}[action={act}]" if act else tname)
        kws = self.router.extract_significant_keywords(prompt)
        try:
            self.memory_store.record_successful_workflow(kws, ordered, action_steps=action_steps)
        except Exception:
            pass

    def send(
        self,
        prompt: str,
        verbose: bool = True,
        run_name: str | None = None,
        on_event: Callable[[dict[str, Any]], None] | None = None,
        confirm_callback: Callable[[str, dict[str, Any], str], bool] | None = None,
    ) -> dict[str, Any]:
        """Send a user message with Adaptive Telemetry, Playbooks, Safety Gate, SSE Streaming, and MLflow."""
        prev_on_event = self._active_on_event
        prev_confirm_cb = self._active_confirm_cb
        self._active_on_event = on_event
        self._active_confirm_cb = confirm_callback
        self._approved_tools_in_turn.clear()
        try:
            return self._send_impl(prompt=prompt, verbose=verbose, run_name=run_name)
        finally:
            self._active_on_event = prev_on_event
            self._active_confirm_cb = prev_confirm_cb
            self._approved_tools_in_turn.clear()

    @staticmethod
    def _intercept_and_vault_chat_credentials(prompt: str) -> tuple[str, list[dict[str, str]]]:
        """0ms Security Interceptor: detect user/pass typed in chat, save encrypted (DPAPI) to Web Vault,
        and redact raw password before sending prompt to LLM or storing in SQLite messages."""
        import re as _re

        text = prompt or ""
        if not text:
            return text, []

        # Match explicit user/pass pairs (e.g. "zalo user 0912345678 pass Abc@123" or "gmail email: a@b.com mk: xxx")
        m_user = _re.search(
            r"(?:user(?:name)?|email|tk|tai\s*khoan|tài\s*khoản|sdt|sđt)\s*[:=]?\s*([^\s,;]+)",
            text,
            flags=_re.IGNORECASE,
        )
        m_pass = _re.search(
            r"(?:pass(?:word)?|mk|mat\s*khau|mật\s*khẩu)\s*[:=]?\s*([^\s,;]+)",
            text,
            flags=_re.IGNORECASE,
        )
        if not (m_user and m_pass):
            return text, []

        username = m_user.group(1).strip().strip("'\"")
        raw_pass = m_pass.group(1).strip().strip("'\"")
        if not username or not raw_pass or raw_pass.startswith("***"):
            return text, []

        norm_low = normalize_text(text)
        known_sites = {
            "zalo": "https://chat.zalo.me/",
            "gmail": "https://mail.google.com/",
            "google": "https://accounts.google.com/",
            "telegram": "https://web.telegram.org/",
            "github": "https://github.com/login",
            "facebook": "https://www.facebook.com/login",
            "notion": "https://www.notion.so/login",
        }
        detected_site = ""
        detected_url = ""
        for s_key, s_url in known_sites.items():
            if s_key in norm_low:
                detected_site = s_key
                detected_url = s_url
                break
        if not detected_site:
            m_url = _re.search(r"(https?://[^\s]+)", text)
            if m_url:
                detected_url = m_url.group(1).rstrip(".,;")
                detected_site = detected_url.split("//", 1)[-1].split("/", 1)[0].lower()
            else:
                detected_site = "custom_web"

        saved_list: list[dict[str, str]] = []
        try:
            from agent_runtime.credential_vault import EncryptedCredentialVault

            vault = EncryptedCredentialVault()
            vault.save_credential(
                site=detected_site,
                username=username,
                password=raw_pass,
                login_url=detected_url,
                notes="Auto-saved from chat",
            )
            saved_list.append({"site": detected_site, "username": username, "login_url": detected_url})
            # Redact raw password so it NEVER leaves PC to Cloud LLM or SQLite messages
            redacted = text.replace(raw_pass, "***[SAVED_IN_DPAPI_VAULT]***")
            redacted += (
                f"\n[HE THONG BAO MAT]: Da tu dong ma hoa (Windows DPAPI) va luu tai khoan "
                f"`{detected_site}` (user: `{username}`) vao Kho Tai khoan Web trong Ho so & Bo nho. "
                f"Cac tool (`browser_cdp_controller`, `zalo_read_notifications`) se tu dong doc mat khau da giai ma trong RAM khi dang nhap."
            )
            return redacted, saved_list
        except Exception:
            return text, []

    def _send_impl(self, prompt: str, verbose: bool = True, run_name: str | None = None) -> dict[str, Any]:
        # 0ms Security Vault Interceptor: encrypt & save user/pass typed in chat, redact raw password
        prompt, vaulted_creds = self._intercept_and_vault_chat_credentials(prompt)
        if vaulted_creds and verbose:
            print(f"[VAULT] Auto-saved encrypted DPAPI credential(s): {vaulted_creds}", flush=True)

        # Zero-cost Auto-Profile Extractor + Implicit Contrastive Habit Miner
        try:
            for cand in extract_profile_candidates(prompt):
                self.memory_store.add_pending_fact(
                    key=cand["key"],
                    value=cand["value"],
                    category=cand["category"],
                    evidence=cand["evidence"],
                )
            if self._last_user_prompt:
                for habit in detect_implicit_correction(self._last_user_prompt, self._last_model_answer, prompt):
                    self.memory_store.add_pending_fact(
                        key=habit["key"],
                        value=habit["value"],
                        category=habit["category"],
                        evidence=habit["evidence"],
                    )
        except Exception:
            pass

        metrics_map = self.memory_store.get_tool_metrics_map()
        playbooks = self.memory_store.list_playbooks()
        pb_tools, pb_hint = self.router.match_playbook(prompt, playbooks)

        active_decls = list(
            self.router.route(
                prompt,
                top_k=self.top_k,
                pinned_names=self.pinned_tools,
                metrics_map=metrics_map,
                playbook_tools=pb_tools,
                use_embeddings=bool(self.router._embeddings),
            )
        )
        if verbose and pb_hint:
            print(f"[PLAYBOOK] Matched strategy -> tools={pb_tools}", flush=True)
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
            res = self._execute_turn_via_multi_router(
                prompt, active_decls, verbose=verbose, playbook_hint=pb_hint
            )
            self._record_playbook_if_applicable(prompt, res["trace"])
            try:
                if not str(res["model"]).lower().startswith(("ollama:", "qwen2.5")):
                    self.distill_store.record_turn(
                        session_id=self.session_id,
                        teacher_model=res["model"],
                        user_prompt=prompt,
                        final_answer=res["answer"],
                        routed_decls=active_decls,
                        trace=res["trace"],
                        escalated=False,
                        source="teacher_multi_router",
                    )
            except Exception:
                pass
            self._recently_updated_tools.clear()
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

        # Topic-Clustered Associative Fuzzy Memory: dynamically sharpen relevant topic groups & fade unrelated turns
        if self.compactor.enabled and len(self._clean_history) >= 6:
            try:
                assoc_history = self.compactor.apply_faded_session_window(
                    self._clean_history, sharp_turns=5, current_query=prompt
                )
                self._chat = self._create_chat(model=self.model, history=assoc_history or None)
            except Exception:
                pass

        try:
            history_snapshot = list(self._chat.get_history())
        except Exception:
            history_snapshot = None

        # Upward-only Complexity-Aware Model Escalation (NEVER downgrades a stronger model)
        orig_model = self.model
        effective_start_model = self.model
        is_complex, complex_reason = self._assess_prompt_complexity(prompt)
        if is_complex and active_decls and all(d.name != RUN_PIPELINE_NAME for d in active_decls):
            active_decls.append(RUN_PIPELINE_DECLARATION)
        cur_rank = MODEL_STRENGTH_RANK.get(self.model, 99)
        esc_rank = MODEL_STRENGTH_RANK.get(ESCALATION_TARGET_MODEL, 3)
        if is_complex and cur_rank < esc_rank:
            effective_start_model = ESCALATION_TARGET_MODEL
            if verbose:
                print(
                    f"[ESCALATE] Complex prompt ({complex_reason}) -> upgrading {self.model} -> {effective_start_model}",
                    flush=True,
                )
            self._emit_event(
                {
                    "type": "status",
                    "text": f"Tác vụ phức tạp ({complex_reason}) -> tự nâng cấp lên {effective_start_model}...",
                }
            )

        candidates = [effective_start_model] + [m for m in FALLBACK_MODELS if m != effective_start_model]
        last_exc: Exception | None = None

        try:
            for idx, candidate in enumerate(candidates):
                if candidate != self.model:
                    self.model = candidate
                    self._chat = self._create_chat(model=candidate, history=history_snapshot)
                try:
                    res = self._execute_turn(
                        prompt, active_decls, verbose=verbose, playbook_hint=pb_hint
                    )
                    self._record_playbook_if_applicable(prompt, res["trace"])
                    self._recently_updated_tools.clear()
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

                        faded_window = self.compactor.apply_faded_session_window(self._clean_history, sharp_turns=5)
                        self._chat = self._create_chat(model=orig_model, history=faded_window or None)

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
                    self._last_user_prompt = prompt
                    self._last_model_answer = res["answer"]
                    try:
                        self.distill_store.record_turn(
                            session_id=self.session_id,
                            teacher_model=res["model"],
                            user_prompt=prompt,
                            final_answer=res["answer"],
                            routed_decls=active_decls,
                            trace=res["trace"],
                            escalated=(res["model"] != orig_model),
                            source="escalated_rescue" if res["model"] != orig_model else "teacher_api",
                        )
                    except Exception:
                        pass
                    return res
                except KeyboardInterrupt:
                    self._chat = self._create_chat(model=orig_model, history=history_snapshot)
                    raise
                except Exception as exc:
                    last_exc = exc
                    self._chat = self._create_chat(model=orig_model, history=history_snapshot)
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
        finally:
            self.model = orig_model

        assert last_exc is not None
        raise last_exc
