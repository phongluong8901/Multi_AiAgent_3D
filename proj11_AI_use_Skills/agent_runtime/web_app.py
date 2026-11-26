"""FastAPI backend powering the 2-Tab Web UI (Chat Workspace + Skill Studio)."""
from __future__ import annotations

import os
import re
import threading
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException, Query
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import FileResponse, HTMLResponse
from pydantic import BaseModel, Field

from agent_runtime.compactor import ContextCompactor
from agent_runtime.config import (
    DEFAULT_MODEL,
    DEFAULT_TOP_K,
    FALLBACK_MODELS,
    OUTPUTS_DIR,
    PERSONA_PRESETS,
    SKILLS_ROOT,
)
from agent_runtime.executor import create_client
from agent_runtime.memory_consolidator import MemoryConsolidator
from agent_runtime.memory_store import SQLiteMemoryStore
from agent_runtime.mlflow_tracker import MLflowTracker
from agent_runtime.session import GeminiSkillSession
from agent_runtime.skill_evolver import SkillEvolver, sanitize_module_name
from agent_runtime.skill_registry import SkillRegistry
from agent_runtime.skill_router import SkillRouter
from agent_runtime.tool_cache import ToolTTLCache

STATIC_DIR = Path(__file__).resolve().parent / "static"


class ChatRequest(BaseModel):
    message: str
    model: str | None = None
    top_k: int | None = None


class LoadSessionRequest(BaseModel):
    session_id: str


class NewSessionRequest(BaseModel):
    title: str = ""


class EvolveRequest(BaseModel):
    mode: str = Field(default="rewrite", pattern="^(rewrite|create)$")
    pack: str = "search_skills"
    module_name: str
    requirement: str
    error_context: str = ""
    model: str = DEFAULT_MODEL
    max_fix_rounds: int = 3
    live_smoke_test: bool = True


class ManualSaveRequest(BaseModel):
    pack: str
    module_name: str
    skill_code: str
    test_code: str = ""


class RestoreRequest(BaseModel):
    pack: str
    module_name: str


class ActivateVersionRequest(BaseModel):
    pack: str
    module_name: str
    version: str


class FactRequest(BaseModel):
    key: str
    value: str
    category: str = "profile"


class RuleRequest(BaseModel):
    rule_text: str
    source: str = "manual"


class ToggleRuleRequest(BaseModel):
    active: bool


class FeedbackRequest(BaseModel):
    session_id: str = ""
    prompt: str = ""
    correction_text: str
    save_as_rule: bool = True


class PersonaUpdateRequest(BaseModel):
    user_name: str = "Phong"
    user_role: str = "DEV"
    default_city: str = "Hà Nội"
    work_tech_stack: str = ""
    persona_preset: str = "expert"
    persona_custom_prompt: str = ""


class ProspectiveTaskRequest(BaseModel):
    title: str
    trigger_condition: str = "session_start"
    due_date: str = ""
    priority: str = "normal"


class ConsolidateRequest(BaseModel):
    use_llm: bool = True
    ttl_days: int = 14


_SUGGEST_RE = re.compile(
    r"\[\[SUGGEST_SKILL:\s*([a-zA-Z0-9_\-]+)\s*\|\s*(.+?)\s*\]\]",
    flags=re.DOTALL,
)


def extract_suggested_skill(answer: str) -> tuple[str, dict[str, str] | None]:
    """Extract [[SUGGEST_SKILL: name | requirement]] from answer and return clean text + suggestion."""
    match = _SUGGEST_RE.search(answer or "")
    if not match:
        return answer or "", None
    mod_name = sanitize_module_name(match.group(1))
    req = match.group(2).strip()
    cleaned = _SUGGEST_RE.sub("", answer or "").strip()
    return cleaned, {"module_name": mod_name, "requirement": req}


class WebRuntimeState:
    """Thread-safe shared state connecting Tab 1 (Chat) and Tab 2 (Skill Studio)."""

    def __init__(self, enable_mlflow: bool = False):
        self.lock = threading.Lock()
        self.client = create_client()
        self.memory_store = SQLiteMemoryStore()
        self.tool_cache = ToolTTLCache(self.memory_store, enabled=True)
        self.mlflow_tracker = MLflowTracker(enabled=enable_mlflow)
        self.compactor = ContextCompactor(enabled=True)

        self.registry = SkillRegistry()
        self.router = SkillRouter(self.registry.declarations)
        self.evolver = SkillEvolver(self.client)
        self._start_embedding_sync_async()

        self.session = GeminiSkillSession(
            client=self.client,
            router=self.router,
            handlers=self.registry.handlers,
            model=DEFAULT_MODEL,
            top_k=DEFAULT_TOP_K,
            stream=False,  # JSON HTTP response for clean UI rendering
            memory_store=self.memory_store,
            tool_cache=self.tool_cache,
            mlflow_tracker=self.mlflow_tracker,
            compactor=self.compactor,
            persist_messages=True,
        )

    def _start_embedding_sync_async(self) -> None:
        def _bg() -> None:
            try:
                self.router.sync_embeddings(self.client, self.memory_store)
            except Exception:
                pass

        threading.Thread(target=_bg, daemon=True).start()

    def hot_reload(self, updated_module: str = "") -> int:
        with self.lock:
            count = self.registry.reload()
            self.router = SkillRouter(self.registry.declarations)
            updated_tools: list[str] = []
            if updated_module:
                updated_tools = [e.name for e in self.registry.entries if e.module_name == updated_module]
            self.session.refresh_skills(self.router, self.registry.handlers, updated_tools=updated_tools)
            self._start_embedding_sync_async()
            return count

    def list_outputs(self) -> list[dict[str, Any]]:
        if not OUTPUTS_DIR.exists():
            return []
        files = []
        for p in sorted(OUTPUTS_DIR.iterdir(), key=lambda x: x.stat().st_mtime, reverse=True):
            if p.is_file() and not p.name.startswith("_hc_"):
                files.append({"name": p.name, "size_bytes": p.stat().st_size})
        return files[:25]

    def resolve_tool_source(self, tool_name: str) -> tuple[str, str]:
        """Resolve a tool name (exact or prefix/shortened) to (pack, module_name)."""
        t = (tool_name or "").strip()
        if not t:
            return ("search_skills", "")
        for e in self.registry.entries:
            if e.name == t:
                return (e.pack, e.module_name)
        prefix = t.split("__", 1)[0]
        for e in self.registry.entries:
            if e.name.startswith(f"{prefix}__") or e.module_name == f"skill_{prefix}" or e.module_name == prefix:
                return (e.pack, e.module_name)
        return ("search_skills", "")

    def enrich_trace(self, trace: list[dict[str, Any]]) -> list[dict[str, Any]]:
        enriched = []
        for item in trace:
            pack, mod = self.resolve_tool_source(str(item.get("tool", "")))
            enriched.append({**item, "pack": pack, "module_name": mod})
        return enriched


def create_web_app(enable_mlflow: bool = False) -> FastAPI:
    app = FastAPI(title="Gemini Skill Studio & Agent Workspace", version="1.0.0")
    state = WebRuntimeState(enable_mlflow=enable_mlflow)

    @app.get("/", response_class=HTMLResponse)
    def index() -> str:
        html_file = STATIC_DIR / "index.html"
        return html_file.read_text(encoding="utf-8")

    @app.get("/api/state")
    def get_state() -> dict[str, Any]:
        return {
            "session_id": state.session.session_id,
            "model": state.session.model,
            "available_models": ["auto", "groq", "cloudflare"] + list(FALLBACK_MODELS),
            "top_k": state.session.top_k,
            "total_tools": len(state.registry.entries),
            "packs": state.registry.loaded_packs,
            "sessions": state.memory_store.list_sessions(limit=25),
            "messages": state.memory_store.get_messages(state.session.session_id),
            "outputs": state.list_outputs(),
            "router_status": state.session.llm_router.get_status(),
            "pending_facts_count": len(state.memory_store.list_pending_facts()),
            "prospective_tasks": state.memory_store.list_prospective_tasks(status="pending"),
            "degraded_tools_count": len(state.memory_store.get_degraded_tools()),
            "episodic_stats": state.memory_store.get_episodic_stats(),
        }

    @app.get("/api/router/status")
    def router_status() -> dict[str, Any]:
        return {
            "strategy": state.session.llm_router.strategy,
            "endpoints": state.session.llm_router.get_status(),
        }

    @app.get("/api/insights")
    def get_insights() -> dict[str, Any]:
        raw_metrics = state.memory_store.get_tool_metrics_map()
        stats_list = []
        for tname, m in raw_metrics.items():
            calls = max(1, int(m.get("calls") or 0))
            ok_rate = round((int(m.get("successes") or 0) / calls) * 100.0, 1)
            pack, mod = state.resolve_tool_source(tname)
            stats_list.append(
                {
                    **m,
                    "ok_rate": ok_rate,
                    "pack": pack,
                    "module_name": mod,
                }
            )
        degraded_raw = state.memory_store.get_degraded_tools()
        degraded_enriched = []
        for d in degraded_raw:
            pack, mod = state.resolve_tool_source(d["tool_name"])
            degraded_enriched.append({**d, "pack": pack, "module_name": mod})
        return {
            "total_tools": len(state.registry.entries),
            "embeddings_cached": len(state.router._embeddings),
            "tool_stats": stats_list,
            "playbooks": state.memory_store.list_playbooks(),
            "router_status": state.session.llm_router.get_status(),
            "degraded_tools": degraded_enriched,
            "antipatterns": state.memory_store.list_antipatterns(limit=50),
            "episodic_stats": state.memory_store.get_episodic_stats(),
        }

    @app.post("/api/chat")
    async def chat_endpoint(req: ChatRequest) -> dict[str, Any]:
        msg = (req.message or "").strip()
        if not msg:
            raise HTTPException(status_code=400, detail="Message must not be empty.")

        def _do_chat() -> dict[str, Any]:
            with state.lock:
                if req.model and req.model != state.session.model:
                    state.session.switch_model(req.model, preserve_history=True)
                if req.top_k is not None:
                    state.session.top_k = max(0, int(req.top_k))
                res = state.session.send(msg, verbose=True)
                clean_answer, suggested_skill = extract_suggested_skill(res["answer"])
                usage = res["usage"]
                return {
                    "answer": clean_answer,
                    "suggested_skill": suggested_skill,
                    "model": res["model"],
                    "elapsed_sec": res["elapsed_sec"],
                    "routed_tools": res["routed_tools"],
                    "trace": state.enrich_trace(res["trace"]),
                    "cache_hits": res.get("cache_hits", 0),
                    "usage": {
                        "input_tokens": usage.input_tokens,
                        "output_tokens": usage.output_tokens,
                        "total_tokens": usage.total_tokens,
                        "est_cost_usd": round(usage.estimate_cost_usd(res["model"]), 6),
                    },
                    "session_id": state.session.session_id,
                    "sessions": state.memory_store.list_sessions(limit=25),
                    "outputs": state.list_outputs(),
                    "router_status": state.session.llm_router.get_status(),
                    "pending_facts_count": len(state.memory_store.list_pending_facts()),
                    "prospective_tasks": state.memory_store.list_prospective_tasks(status="pending"),
                    "degraded_tools_count": len(state.memory_store.get_degraded_tools()),
                }

        try:
            return await run_in_threadpool(_do_chat)
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f"{type(exc).__name__}: {exc}") from exc

    @app.post("/api/session/new")
    def new_session(req: NewSessionRequest) -> dict[str, Any]:
        with state.lock:
            state.session.reset(new_title=req.title)
            return {
                "session_id": state.session.session_id,
                "sessions": state.memory_store.list_sessions(limit=25),
                "messages": [],
            }

    @app.post("/api/session/load")
    def load_session(req: LoadSessionRequest) -> dict[str, Any]:
        with state.lock:
            state.session.load_session(req.session_id)
            return {
                "session_id": state.session.session_id,
                "messages": state.memory_store.get_messages(state.session.session_id),
                "sessions": state.memory_store.list_sessions(limit=25),
            }

    @app.get("/api/skills")
    def list_skills() -> dict[str, Any]:
        files = state.registry.list_skill_files()
        for f in files:
            f["backup_available"] = state.evolver.has_backup(f["pack"], f["module_name"])
        return {
            "total_tools": len(state.registry.entries),
            "packs": state.registry.loaded_packs,
            "skills": files,
        }

    @app.get("/api/skills/source")
    def get_skill_source(
        pack: str = Query(...),
        module_name: str = Query(...),
    ) -> dict[str, Any]:
        mod = sanitize_module_name(module_name)
        pack_dir = (SKILLS_ROOT / pack).resolve()
        if SKILLS_ROOT.resolve() not in pack_dir.parents:
            raise HTTPException(status_code=400, detail="Invalid pack path.")

        skill_path = pack_dir / f"{mod}.py"
        test_path = pack_dir / f"test_{mod}.py"
        if not skill_path.exists():
            raise HTTPException(status_code=404, detail=f"Skill not found: {pack}/{mod}.py")

        tools = [e.name for e in state.registry.entries if e.pack == pack and e.module_name == mod]
        return {
            "pack": pack,
            "module_name": mod,
            "skill_code": skill_path.read_text(encoding="utf-8", errors="replace"),
            "test_code": test_path.read_text(encoding="utf-8", errors="replace") if test_path.exists() else "",
            "backup_available": state.evolver.has_backup(pack, mod),
            "versions": state.evolver.list_versions(pack, mod),
            "tools": tools,
        }

    @app.get("/api/skills/version")
    def get_skill_version(
        pack: str = Query(...),
        module_name: str = Query(...),
        version: str = Query(...),
    ) -> dict[str, Any]:
        try:
            return state.evolver.get_version_source(pack, module_name, version)
        except Exception as exc:
            raise HTTPException(status_code=404, detail=f"{type(exc).__name__}: {exc}") from exc

    @app.post("/api/skills/activate-version")
    def activate_skill_version(req: ActivateVersionRequest) -> dict[str, Any]:
        try:
            data = state.evolver.activate_version(req.pack, req.module_name, req.version)
            total_tools = state.hot_reload(updated_module=data["module_name"])
            return {
                "ok": True,
                "pack": req.pack,
                "module_name": data["module_name"],
                "version": req.version,
                "skill_code": data["skill_code"],
                "test_code": data["test_code"],
                "versions": data["versions"],
                "total_tools": total_tools,
                "packs": state.registry.loaded_packs,
                "logs": [
                    f"[VERSION] Activated {req.pack}/{data['module_name']} -> {req.version}",
                    f"[HOT-RELOAD] Registry refreshed -> {total_tools} active tools.",
                ],
            }
        except Exception as exc:
            raise HTTPException(status_code=400, detail=f"{type(exc).__name__}: {exc}") from exc

    @app.post("/api/skills/evolve")
    async def evolve_skill_endpoint(req: EvolveRequest) -> dict[str, Any]:
        if not req.requirement.strip():
            raise HTTPException(status_code=400, detail="Requirement must not be empty.")

        def _do_evolve() -> dict[str, Any]:
            target_pack = "auto_skills" if req.mode == "create" else req.pack
            res = state.evolver.evolve_skill(
                requirement=req.requirement,
                mode=req.mode,
                target_pack=target_pack,
                module_name=req.module_name,
                error_context=req.error_context,
                model=req.model or DEFAULT_MODEL,
                max_fix_rounds=req.max_fix_rounds,
                auto_save=True,
                live_smoke_test=req.live_smoke_test,
            )
            total_tools = len(state.registry.entries)
            if res.ok:
                total_tools = state.hot_reload(updated_module=res.module_name)
                res.logs.append(f"[HOT-RELOAD] Registry refreshed -> {total_tools} active tools (cleared stale anti-patterns).")
            return {
                "ok": res.ok,
                "pack": res.pack,
                "module_name": res.module_name,
                "skill_code": res.skill_code,
                "test_code": res.test_code,
                "pytest_output": res.pytest_output,
                "rounds_used": res.rounds_used,
                "logs": res.logs,
                "backup_available": res.backup_available,
                "version": res.version,
                "versions": res.versions,
                "total_tools": total_tools,
                "packs": state.registry.loaded_packs,
            }

        try:
            return await run_in_threadpool(_do_evolve)
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f"{type(exc).__name__}: {exc}") from exc

    @app.post("/api/skills/test-save")
    async def manual_test_save_endpoint(req: ManualSaveRequest) -> dict[str, Any]:
        def _do_save() -> dict[str, Any]:
            res = state.evolver.test_and_save_manual(
                pack=req.pack,
                module_name=req.module_name,
                skill_code=req.skill_code,
                test_code=req.test_code,
            )
            total_tools = len(state.registry.entries)
            if res.ok:
                total_tools = state.hot_reload(updated_module=res.module_name)
                res.logs.append(f"[HOT-RELOAD] Registry refreshed -> {total_tools} active tools (cleared stale anti-patterns).")
            return {
                "ok": res.ok,
                "pack": res.pack,
                "module_name": res.module_name,
                "skill_code": res.skill_code,
                "test_code": res.test_code,
                "pytest_output": res.pytest_output,
                "logs": res.logs,
                "backup_available": res.backup_available,
                "version": res.version,
                "versions": res.versions,
                "total_tools": total_tools,
                "packs": state.registry.loaded_packs,
            }

        try:
            return await run_in_threadpool(_do_save)
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f"{type(exc).__name__}: {exc}") from exc

    @app.post("/api/skills/restore")
    def restore_skill_endpoint(req: RestoreRequest) -> dict[str, Any]:
        try:
            mod = sanitize_module_name(req.module_name)
            data = state.evolver.restore_backup(req.pack, mod)
            total_tools = state.hot_reload(updated_module=mod)
            return {
                "ok": True,
                "pack": req.pack,
                "module_name": mod,
                "skill_code": data["skill_code"],
                "test_code": data.get("test_code", ""),
                "total_tools": total_tools,
                "packs": state.registry.loaded_packs,
                "logs": [
                    f"[RESTORE] Restored previous version of {req.pack}/{mod}.py",
                    f"[HOT-RELOAD] Registry refreshed -> {total_tools} active tools.",
                ],
            }
        except Exception as exc:
            raise HTTPException(status_code=400, detail=f"{type(exc).__name__}: {exc}") from exc

    @app.post("/api/skills/reload")
    def force_reload_endpoint() -> dict[str, Any]:
        total_tools = state.hot_reload()
        return {
            "ok": True,
            "total_tools": total_tools,
            "packs": state.registry.loaded_packs,
        }

    @app.post("/api/skills/delete")
    def delete_skill_endpoint(req: RestoreRequest) -> dict[str, Any]:
        try:
            mod = sanitize_module_name(req.module_name)
            removed_tools = [e.name for e in state.registry.entries if e.pack == req.pack and e.module_name == mod]
            info = state.evolver.delete_skill(req.pack, mod)
            for tn in removed_tools:
                state.memory_store.dismiss_tool_flag(tn)
            total_tools = state.hot_reload()
            return {
                "ok": True,
                "pack": req.pack,
                "module_name": mod,
                "deleted_files": info["deleted_files"],
                "total_tools": total_tools,
                "packs": state.registry.loaded_packs,
                "logs": [
                    f"[DELETE] Đã xóa {req.pack}/{mod}.py (đã lưu bản sao lưu tự động trong data/skill_backups/).",
                    f"[HOT-RELOAD] Registry refreshed -> {total_tools} active tools.",
                ],
            }
        except Exception as exc:
            raise HTTPException(status_code=400, detail=f"{type(exc).__name__}: {exc}") from exc

    @app.delete("/api/insights/flag/{tool_name}")
    def dismiss_degraded_flag_endpoint(tool_name: str) -> dict[str, Any]:
        dismissed = state.memory_store.dismiss_tool_flag(tool_name)
        return {
            "ok": True,
            "dismissed": dismissed,
            "degraded_tools_count": len(state.memory_store.get_degraded_tools()),
        }

    @app.get("/api/outputs/{filename}")
    def download_output(filename: str) -> FileResponse:
        safe_name = os.path.basename(filename)
        target = (OUTPUTS_DIR / safe_name).resolve()
        if not target.exists() or not target.is_file() or OUTPUTS_DIR.resolve() not in target.parents:
            raise HTTPException(status_code=404, detail="Output file not found.")
        return FileResponse(path=str(target), filename=safe_name)

    # ------------------------------------------------------------------
    # Personalization: Profile, Rules, Pending Auto-Learned Facts & Feedback
    # ------------------------------------------------------------------
    @app.get("/api/profile")
    def get_profile() -> dict[str, Any]:
        return {
            "persona": state.memory_store.get_persona_config(),
            "persona_presets": PERSONA_PRESETS,
            "facts": state.memory_store.get_facts(include_internal=False),
            "fact_history": state.memory_store.get_fact_history(limit=30),
            "rules": state.memory_store.list_rules(),
            "pending_facts": state.memory_store.list_pending_facts(),
            "prospective_tasks": state.memory_store.list_prospective_tasks(status="all", limit=30),
            "episodic_stats": state.memory_store.get_episodic_stats(),
        }

    @app.post("/api/profile/persona")
    def update_persona(req: PersonaUpdateRequest) -> dict[str, Any]:
        saved = state.memory_store.save_persona_config(
            user_name=req.user_name,
            user_role=req.user_role,
            default_city=req.default_city,
            work_tech_stack=req.work_tech_stack,
            persona_preset=req.persona_preset,
            persona_custom_prompt=req.persona_custom_prompt,
        )
        return {"ok": True, "persona": saved}

    @app.post("/api/profile/fact")
    def upsert_profile_fact(req: FactRequest) -> dict[str, Any]:
        try:
            saved = state.memory_store.set_fact(req.key, req.value, req.category)
            return {"ok": True, "fact": saved}
        except Exception as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @app.delete("/api/profile/fact/{key}")
    def delete_profile_fact(key: str) -> dict[str, Any]:
        return {"ok": True, "deleted": state.memory_store.delete_fact(key)}

    @app.post("/api/profile/rule")
    def add_profile_rule(req: RuleRequest) -> dict[str, Any]:
        try:
            rule = state.memory_store.add_rule(req.rule_text, source=req.source)
            return {"ok": True, "rule": rule}
        except Exception as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @app.post("/api/profile/rule/{rule_id}/toggle")
    def toggle_profile_rule(rule_id: int, req: ToggleRuleRequest) -> dict[str, Any]:
        return {"ok": True, "updated": state.memory_store.toggle_rule(rule_id, req.active)}

    @app.delete("/api/profile/rule/{rule_id}")
    def delete_profile_rule(rule_id: int) -> dict[str, Any]:
        return {"ok": True, "deleted": state.memory_store.delete_rule(rule_id)}

    @app.post("/api/profile/pending/{pending_id}/approve")
    def approve_pending(pending_id: int) -> dict[str, Any]:
        res = state.memory_store.approve_pending_fact(pending_id)
        if res is None:
            raise HTTPException(status_code=404, detail="Pending item not found")
        return {"ok": True, **res}

    @app.delete("/api/profile/pending/{pending_id}")
    def dismiss_pending(pending_id: int) -> dict[str, Any]:
        return {"ok": True, "deleted": state.memory_store.dismiss_pending_fact(pending_id)}

    @app.post("/api/feedback")
    def submit_feedback(req: FeedbackRequest) -> dict[str, Any]:
        try:
            return state.memory_store.record_feedback(
                session_id=req.session_id or state.session.session_id,
                prompt_preview=req.prompt,
                correction_text=req.correction_text,
                save_as_rule=req.save_as_rule,
            )
        except Exception as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    # ------------------------------------------------------------------
    # Cognitive Memory OS: Consolidation, Anti-Patterns & Prospective Tasks
    # ------------------------------------------------------------------
    @app.post("/api/memory/consolidate")
    async def consolidate_memory_endpoint(req: ConsolidateRequest) -> dict[str, Any]:
        def _run() -> dict[str, Any]:
            consolidator = MemoryConsolidator(state.memory_store, state.session.llm_router)
            return consolidator.consolidate(use_llm=req.use_llm, ttl_days=req.ttl_days)

        try:
            return await run_in_threadpool(_run)
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f"{type(exc).__name__}: {exc}") from exc

    @app.delete("/api/memory/antipattern/{ap_id}")
    def delete_antipattern_endpoint(ap_id: int) -> dict[str, Any]:
        return {"ok": True, "deleted": state.memory_store.delete_antipattern(ap_id)}

    @app.post("/api/memory/prospective")
    def add_prospective_endpoint(req: ProspectiveTaskRequest) -> dict[str, Any]:
        try:
            task = state.memory_store.add_prospective_task(
                title=req.title,
                trigger_condition=req.trigger_condition,
                due_date=req.due_date,
                priority=req.priority,
            )
            return {"ok": True, "task": task}
        except Exception as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @app.post("/api/memory/prospective/{task_id}/complete")
    def complete_prospective_endpoint(task_id: int) -> dict[str, Any]:
        return {"ok": True, "completed": state.memory_store.complete_prospective_task(task_id)}

    @app.delete("/api/memory/prospective/{task_id}")
    def delete_prospective_endpoint(task_id: int) -> dict[str, Any]:
        return {"ok": True, "deleted": state.memory_store.delete_prospective_task(task_id)}

    return app
