"""Memory Consolidation ("Sleep Cycle"): distills Episodic logs into Semantic/Failure/Prospective memories."""
from __future__ import annotations

import json
import re
import threading
from typing import Any

from agent_runtime.llm_router import MultiProviderRouter
from agent_runtime.memory_store import SQLiteMemoryStore

_CONSOLIDATION_SYSTEM_PROMPT = """Ban la bo may Memory Consolidation (Tong hop tri nho) cua he thong AI Agent.
Nhiem vu: Doc cac log Episodic gan day (hoi thoai, loi tool, gop y) va rut ra tri thuc sach, ngan gon, khong ao giac.
Tra ve DUY NHAT mot doi tuong JSON hop le (khong markdown, khong giai thich them) theo schema:
{
  "semantic_facts": [
    {"key": "ten_key_ngan_khong_dau", "value": "gia tri ro rang", "category": "consolidated", "evidence": "trich dan ngan"}
  ],
  "antipatterns": [
    {"tool_name": "ten_tool", "error_signature": "tom tat loi", "lesson_learned": "bai hoc ne bay ngan gon"}
  ],
  "prospective_tasks": [
    {"title": "viec can lam trong tuong lai neu nguoi dung co nhac", "due_date": "", "priority": "normal"}
  ],
  "summary": "Tom tat 1-2 cau ve cac bai hoc vua tong hop."
}
Quy tac nghiem ngat:
- CHI rut ra thong tin co that trong log, KHONG tu suy dien hay bia dat.
- Neu khong co gi dang luu cho muc nao thi tra ve mang rong [].
- Toi da 3 semantic_facts, 3 antipatterns, 2 prospective_tasks.
"""


def _extract_json_block(text: str) -> dict[str, Any] | None:
    raw = (text or "").strip()
    if not raw:
        return None
    # Strip markdown fences if present
    fenced = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", raw, flags=re.DOTALL)
    if fenced:
        raw = fenced.group(1).strip()
    else:
        start = raw.find("{")
        end = raw.rfind("}")
        if start != -1 and end > start:
            raw = raw[start : end + 1]
    try:
        parsed = json.loads(raw)
        return parsed if isinstance(parsed, dict) else None
    except Exception:
        return None


class MemoryConsolidator:
    """Distills raw Episodic logs into clean Semantic, Failure, and Prospective memories, then prunes cold logs."""

    _bg_lock = threading.Lock()

    def __init__(
        self,
        memory_store: SQLiteMemoryStore,
        llm_router: MultiProviderRouter | None = None,
    ):
        self.memory_store = memory_store
        self.llm_router = llm_router

    def consolidate(self, *, use_llm: bool = True, ttl_days: int = 14) -> dict[str, Any]:
        """Run a full Memory Consolidation pass (deterministic + optional LLM reflection + cold-log pruning)."""
        episodes = self.memory_store.get_unconsolidated_episodes(limit=60)
        tool_logs = episodes["tool_logs"]
        recent_messages = episodes["recent_messages"]
        recent_feedback = episodes["recent_feedback"]

        new_pending_facts = 0
        new_antipatterns = 0
        new_prospective = 0
        llm_used = False
        llm_model = ""
        summary_note = ""

        # 1. Deterministic pass (0ms, always safe): reinforce tool anti-patterns from failed episodic logs
        for log in tool_logs:
            if not int(log.get("ok") or 0) and (log.get("error_text") or "").strip():
                try:
                    args_obj = json.loads(log.get("args_json") or "{}")
                except Exception:
                    args_obj = {}
                self.memory_store.record_tool_antipattern(
                    tool_name=str(log["tool_name"]),
                    error_text=str(log["error_text"]),
                    args_dict=args_obj if isinstance(args_obj, dict) else None,
                )
                new_antipatterns += 1

        # 2. LLM Reflection pass (distill nuanced lessons from conversations + errors + feedback)
        has_signal = bool(tool_logs or recent_feedback or len(recent_messages) >= 2)
        if use_llm and has_signal and self.llm_router is not None:
            digest = self._build_episodic_digest(tool_logs, recent_messages, recent_feedback)
            try:
                res = self.llm_router.generate(
                    system_instruction=_CONSOLIDATION_SYSTEM_PROMPT,
                    messages=[{"role": "user", "content": digest}],
                    declarations=[],
                    preferred="auto",
                    temperature=0.1,
                    verbose=False,
                )
                llm_used = True
                llm_model = res.endpoint_id
                parsed = _extract_json_block(res.text)
                if parsed:
                    summary_note = str(parsed.get("summary") or "").strip()
                    for item in (parsed.get("semantic_facts") or [])[:3]:
                        if not isinstance(item, dict):
                            continue
                        k = str(item.get("key") or "").strip()
                        v = str(item.get("value") or "").strip()
                        if k and v:
                            added = self.memory_store.add_pending_fact(
                                key=k,
                                value=v,
                                category=str(item.get("category") or "consolidated"),
                                evidence=str(item.get("evidence") or "Memory Consolidation"),
                            )
                            if added:
                                new_pending_facts += 1

                    for ap in (parsed.get("antipatterns") or [])[:3]:
                        if not isinstance(ap, dict):
                            continue
                        tn = str(ap.get("tool_name") or "").strip()
                        es = str(ap.get("error_signature") or "").strip()
                        ls = str(ap.get("lesson_learned") or "").strip()
                        if tn and (es or ls):
                            self.memory_store.record_tool_antipattern(
                                tool_name=tn,
                                error_text=es or ls,
                                lesson_learned=ls,
                            )
                            new_antipatterns += 1

                    for pt in (parsed.get("prospective_tasks") or [])[:2]:
                        if not isinstance(pt, dict):
                            continue
                        title = str(pt.get("title") or "").strip()
                        if title:
                            self.memory_store.add_prospective_task(
                                title=title,
                                due_date=str(pt.get("due_date") or "").strip(),
                                priority=str(pt.get("priority") or "normal").strip(),
                                trigger_condition="session_start",
                            )
                            new_prospective += 1
            except Exception as exc:
                summary_note = f"Chay tong hop deterministic (LLM tam ban: {type(exc).__name__})."

        # 3. Mark processed episodic logs as consolidated & prune cold logs past TTL
        log_ids = [int(x["id"]) for x in tool_logs]
        marked = self.memory_store.mark_episodes_consolidated(log_ids)
        pruned_logs = self.memory_store.prune_old_episodic_logs(ttl_days=ttl_days)
        pruned_cache = self.memory_store.cache_prune_expired()
        self.memory_store.set_meta("last_consolidation_at", self.memory_store.utc_now_iso())

        if not summary_note:
            summary_note = (
                f"Da tong hop {marked} log tool, {len(recent_messages)} tin nhan; "
                f"don {pruned_logs} log cu qua {ttl_days} ngay."
            )

        return {
            "ok": True,
            "processed_tool_logs": marked,
            "processed_messages": len(recent_messages),
            "processed_feedback": len(recent_feedback),
            "new_pending_facts": new_pending_facts,
            "reinforced_antipatterns": new_antipatterns,
            "new_prospective_tasks": new_prospective,
            "pruned_cold_logs": pruned_logs,
            "pruned_expired_cache": pruned_cache,
            "llm_used": llm_used,
            "llm_model": llm_model,
            "summary": summary_note,
            "episodic_stats": self.memory_store.get_episodic_stats(),
        }

    def consolidate_async(self, *, use_llm: bool = True, ttl_days: int = 14) -> None:
        """Trigger non-blocking background consolidation (safe against overlapping runs)."""
        def _worker() -> None:
            if not MemoryConsolidator._bg_lock.acquire(blocking=False):
                return
            try:
                self.consolidate(use_llm=use_llm, ttl_days=ttl_days)
            except Exception:
                pass
            finally:
                MemoryConsolidator._bg_lock.release()

        threading.Thread(target=_worker, daemon=True).start()

    @staticmethod
    def _build_episodic_digest(
        tool_logs: list[dict[str, Any]],
        recent_messages: list[dict[str, Any]],
        recent_feedback: list[dict[str, Any]],
    ) -> str:
        parts: list[str] = ["DU LIEU EPISODIC GAN DAY:"]
        if tool_logs:
            parts.append("\n[TOOL LOGS]")
            for lg in tool_logs[:25]:
                status = "OK" if int(lg.get("ok") or 0) else f"ERR: {lg.get('error_text', '')[:120]}"
                parts.append(f"- {lg['tool_name']}({lg.get('args_json', '{}')[:100]}) -> {status}")
        if recent_feedback:
            parts.append("\n[USER FEEDBACK]")
            for fb in recent_feedback[:10]:
                parts.append(f"- Prompt: {fb.get('prompt_preview', '')[:80]} | Sua: {fb.get('correction_text', '')[:160]}")
        if recent_messages:
            parts.append("\n[RECENT CONVERSATION EXCERPTS]")
            for m in recent_messages[-12:]:
                role = m.get("role", "user")
                content = (m.get("content") or "").replace("\n", " ")[:220]
                parts.append(f"- {role}: {content}")
        return "\n".join(parts)
