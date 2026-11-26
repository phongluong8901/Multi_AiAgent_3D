"""FastAPI backend powering the 2-Tab Web UI (Chat Workspace + Skill Studio)."""
from __future__ import annotations

import os
import threading
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException, Query
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import FileResponse, HTMLResponse
from pydantic import BaseModel, Field

from agent_runtime.compactor import ContextCompactor
from agent_runtime.config import DEFAULT_MODEL, DEFAULT_TOP_K, FALLBACK_MODELS, OUTPUTS_DIR, SKILLS_ROOT
from agent_runtime.executor import create_client
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

    def hot_reload(self) -> int:
        with self.lock:
            count = self.registry.reload()
            self.router = SkillRouter(self.registry.declarations)
            self.session.refresh_skills(self.router, self.registry.handlers)
            return count

    def list_outputs(self) -> list[dict[str, Any]]:
        if not OUTPUTS_DIR.exists():
            return []
        files = []
        for p in sorted(OUTPUTS_DIR.iterdir(), key=lambda x: x.stat().st_mtime, reverse=True):
            if p.is_file() and not p.name.startswith("_hc_"):
                files.append({"name": p.name, "size_bytes": p.stat().st_size})
        return files[:25]

    def enrich_trace(self, trace: list[dict[str, Any]]) -> list[dict[str, Any]]:
        tool_map = {e.name: (e.pack, e.module_name) for e in self.registry.entries}
        enriched = []
        for item in trace:
            pack, mod = tool_map.get(item.get("tool", ""), ("search_skills", ""))
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
            "available_models": ["auto", "groq", "mistral", "cloudflare"] + list(FALLBACK_MODELS),
            "top_k": state.session.top_k,
            "total_tools": len(state.registry.entries),
            "packs": state.registry.loaded_packs,
            "sessions": state.memory_store.list_sessions(limit=25),
            "messages": state.memory_store.get_messages(state.session.session_id),
            "outputs": state.list_outputs(),
            "router_status": state.session.llm_router.get_status(),
        }

    @app.get("/api/router/status")
    def router_status() -> dict[str, Any]:
        return {
            "strategy": state.session.llm_router.strategy,
            "endpoints": state.session.llm_router.get_status(),
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
                usage = res["usage"]
                return {
                    "answer": res["answer"],
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
            total_tools = state.hot_reload()
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
            )
            total_tools = len(state.registry.entries)
            if res.ok:
                total_tools = state.hot_reload()
                res.logs.append(f"[HOT-RELOAD] Registry refreshed -> {total_tools} active tools.")
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
                total_tools = state.hot_reload()
                res.logs.append(f"[HOT-RELOAD] Registry refreshed -> {total_tools} active tools.")
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
            total_tools = state.hot_reload()
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

    @app.get("/api/outputs/{filename}")
    def download_output(filename: str) -> FileResponse:
        safe_name = os.path.basename(filename)
        target = (OUTPUTS_DIR / safe_name).resolve()
        if not target.exists() or not target.is_file() or OUTPUTS_DIR.resolve() not in target.parents:
            raise HTTPException(status_code=404, detail="Output file not found.")
        return FileResponse(path=str(target), filename=safe_name)

    return app
