"""Dedicated SQLite Distillation Database (`data/distillation.db`) for fine-tuning local Qwen2.5-1.5B.

Implements Trajectory Distillation with strict quality filtering:
- Stores ONLY routed Top-K compact tool schemas (4-8 tools, NOT all 181) to fit Qwen2.5-1.5B's 4K-8K
  attention window and prevent Tool Confusion on Colab T4 (15GB VRAM).
- Stores slimmed observations (no raw HTML/JSON noise) in OpenAI/Qwen2.5 native tool-calling format
  (`messages` + `tools`), directly consumable by `tokenizer.apply_chat_template(messages, tools=tools)`
  in Unsloth / TRL / Axolotl.
- Also captures DPO preference pairs (`dpo_pairs`) whenever a teacher model self-corrects a failed
  tool call or rescues an escalated turn.
"""
from __future__ import annotations

import hashlib
import json
import sqlite3
import threading
from collections import Counter
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterator

from google.genai import types

from agent_runtime.config import DATA_DIR, OUTPUTS_DIR
from agent_runtime.llm_router import _genai_schema_to_json_schema

DEFAULT_DISTILL_DB_PATH = DATA_DIR / "distillation.db"

_QWEN_DISTILL_SYSTEM_PROMPT = (
    "Ban la tro ly AI thuc chien co kha nang goi tool chinh xac tren may tinh Windows va Web. "
    "Chi goi tool co trong danh sach duoc cung cap, truyen dung kieu tham so, khong tu bia ket qua."
)


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _estimate_tokens(obj: Any) -> int:
    text = json.dumps(obj, ensure_ascii=False, default=str) if not isinstance(obj, str) else obj
    return max(1, int(len(text) / 3.6))


def _declarations_to_openai_tools(decls: list[types.FunctionDeclaration]) -> list[dict[str, Any]]:
    """Convert routed Gemini FunctionDeclarations into compact OpenAI/Qwen2.5 JSON tool schemas."""
    tools: list[dict[str, Any]] = []
    for d in decls or []:
        if not d.name:
            continue
        tools.append(
            {
                "type": "function",
                "function": {
                    "name": d.name,
                    "description": (d.description or "")[:160],
                    "parameters": _genai_schema_to_json_schema(d.parameters),
                },
            }
        )
    return tools


class DistillationStore:
    """Thread-safe SQLite store for clean Teacher->Student (Qwen2.5-1.5B) distillation trajectories."""

    def __init__(self, db_path: Path = DEFAULT_DISTILL_DB_PATH):
        self.db_path = Path(db_path)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._lock = threading.Lock()
        self._init_schema()

    @contextmanager
    def _connect(self) -> Iterator[sqlite3.Connection]:
        conn = sqlite3.connect(str(self.db_path), timeout=15.0)
        conn.row_factory = sqlite3.Row
        try:
            conn.execute("PRAGMA journal_mode=WAL;")
            with conn:
                yield conn
        finally:
            conn.close()

    def _init_schema(self) -> None:
        with self._lock, self._connect() as conn:
            conn.executescript(
                """
                CREATE TABLE IF NOT EXISTS trajectories (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    sample_hash TEXT NOT NULL UNIQUE,
                    session_id TEXT DEFAULT '',
                    teacher_model TEXT NOT NULL,
                    user_prompt TEXT NOT NULL,
                    routed_tools_json TEXT NOT NULL,
                    messages_json TEXT NOT NULL,
                    tools_used_csv TEXT DEFAULT '',
                    step_count INTEGER NOT NULL DEFAULT 0,
                    all_tools_ok INTEGER NOT NULL DEFAULT 1,
                    has_tool_calls INTEGER NOT NULL DEFAULT 0,
                    est_tokens INTEGER NOT NULL DEFAULT 0,
                    quality_score REAL NOT NULL DEFAULT 0.5,
                    difficulty TEXT NOT NULL DEFAULT 'easy_pc',
                    source TEXT NOT NULL DEFAULT 'teacher_api',
                    exported INTEGER NOT NULL DEFAULT 0,
                    created_at TEXT NOT NULL
                );

                CREATE INDEX IF NOT EXISTS idx_traj_quality ON trajectories(quality_score DESC, id DESC);
                CREATE INDEX IF NOT EXISTS idx_traj_tools ON trajectories(tools_used_csv);

                CREATE TABLE IF NOT EXISTS dpo_pairs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    pair_hash TEXT NOT NULL UNIQUE,
                    teacher_model TEXT NOT NULL,
                    user_prompt TEXT NOT NULL,
                    routed_tools_json TEXT NOT NULL,
                    chosen_json TEXT NOT NULL,
                    rejected_json TEXT NOT NULL,
                    reason TEXT DEFAULT 'tool_self_correction',
                    created_at TEXT NOT NULL
                );
                """
            )

    @staticmethod
    def _classify_difficulty(step_count: int, has_tools: bool, escalated: bool) -> str:
        if escalated:
            return "hard_escalated"
        if not has_tools:
            return "chat_only"
        if step_count <= 2:
            return "easy_pc"
        return "medium_multi"

    @staticmethod
    def _compute_quality_score(
        *,
        all_ok: bool,
        has_tools: bool,
        step_count: int,
        est_tokens: int,
        answer: str,
    ) -> float:
        score = 0.45
        if has_tools and all_ok:
            score += 0.35
        elif has_tools and step_count >= 1:
            # Self-corrected trajectory (we only store the clean successful steps in SFT!)
            score += 0.25
        elif not has_tools and len(answer) >= 20:
            score += 0.15
        # Sweet spot for Qwen2.5-1.5B & Colab T4 (<= 3,200 tokens)
        if est_tokens <= 2200:
            score += 0.15
        elif est_tokens <= 3600:
            score += 0.08
        elif est_tokens > 5000:
            score -= 0.25
        if 1 <= step_count <= 3:
            score += 0.05
        return round(max(0.0, min(1.0, score)), 3)

    def record_turn(
        self,
        *,
        session_id: str,
        teacher_model: str,
        user_prompt: str,
        final_answer: str,
        routed_decls: list[types.FunctionDeclaration],
        trace: list[dict[str, Any]],
        escalated: bool = False,
        source: str = "teacher_api",
    ) -> dict[str, Any]:
        """Build a clean, redacted Qwen2.5 ChatML trajectory and persist if it passes Quality Gate."""
        prompt = (user_prompt or "").strip()
        answer = (final_answer or "").strip()
        if not prompt or not answer:
            return {"saved": False, "reason": "empty_prompt_or_answer"}
        # Never train on hallucinated fake traces or API error messages
        if "[tool trace:" in answer.lower() or answer.startswith("[ERROR]"):
            return {"saved": False, "reason": "rejected_artifact_or_error"}
        # Never store prompts containing raw passwords/secrets
        low_p = prompt.lower()
        if any(k in low_p for k in ("password:", "mat khau:", "pass:", "api_key=", "gsk_", "aiza")):
            return {"saved": False, "reason": "contains_sensitive_secret"}

        ok_steps = [t for t in (trace or []) if t.get("ok")]
        failed_steps = [t for t in (trace or []) if not t.get("ok")]
        has_tools = bool(trace)
        all_ok = (not trace) or (len(failed_steps) == 0)

        # Reject turns where tools failed and never recovered
        if has_tools and not ok_steps:
            return {"saved": False, "reason": "all_tools_failed"}

        openai_tools = _declarations_to_openai_tools(routed_decls[:8])
        messages: list[dict[str, Any]] = [
            {"role": "system", "content": _QWEN_DISTILL_SYSTEM_PROMPT},
            {"role": "user", "content": prompt},
        ]

        # Build clean assistant(tool_calls) -> tool(observation) pairs from ONLY successful steps
        # (so Qwen 1.5B learns the clean optimal trajectory; failed attempts go to dpo_pairs!)
        for idx, tr in enumerate(ok_steps, start=1):
            tname = str(tr.get("tool") or "")
            targs = tr.get("args") if isinstance(tr.get("args"), dict) else {}
            call_id = f"call_{idx}"
            obs = str(tr.get("output_preview") or '{"ok": true}')[:1200]
            messages.append(
                {
                    "role": "assistant",
                    "content": "",
                    "tool_calls": [
                        {
                            "id": call_id,
                            "type": "function",
                            "function": {
                                "name": tname,
                                "arguments": json.dumps(targs, ensure_ascii=False, default=str),
                            },
                        }
                    ],
                }
            )
            messages.append(
                {
                    "role": "tool",
                    "tool_call_id": call_id,
                    "name": tname,
                    "content": obs,
                }
            )

        messages.append({"role": "assistant", "content": answer[:2500]})

        est_tokens = _estimate_tokens(messages) + _estimate_tokens(openai_tools)
        tools_used = sorted({str(t.get("tool")) for t in ok_steps if t.get("tool")})
        quality = self._compute_quality_score(
            all_ok=all_ok,
            has_tools=bool(ok_steps),
            step_count=len(ok_steps),
            est_tokens=est_tokens,
            answer=answer,
        )
        difficulty = self._classify_difficulty(len(ok_steps), bool(ok_steps), escalated)
        tools_csv = ",".join(tools_used)
        sample_hash = hashlib.sha256(f"{prompt.lower()}::{tools_csv}".encode("utf-8")).hexdigest()[:32]
        now = _utc_now_iso()

        with self._lock, self._connect() as conn:
            conn.execute(
                """
                INSERT INTO trajectories (
                    sample_hash, session_id, teacher_model, user_prompt,
                    routed_tools_json, messages_json, tools_used_csv,
                    step_count, all_tools_ok, has_tool_calls, est_tokens,
                    quality_score, difficulty, source, exported, created_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
                ON CONFLICT(sample_hash) DO UPDATE SET
                    teacher_model = CASE WHEN excluded.quality_score >= trajectories.quality_score THEN excluded.teacher_model ELSE trajectories.teacher_model END,
                    routed_tools_json = CASE WHEN excluded.quality_score >= trajectories.quality_score THEN excluded.routed_tools_json ELSE trajectories.routed_tools_json END,
                    messages_json = CASE WHEN excluded.quality_score >= trajectories.quality_score THEN excluded.messages_json ELSE trajectories.messages_json END,
                    est_tokens = CASE WHEN excluded.quality_score >= trajectories.quality_score THEN excluded.est_tokens ELSE trajectories.est_tokens END,
                    quality_score = MAX(trajectories.quality_score, excluded.quality_score),
                    created_at = excluded.created_at
                """,
                (
                    sample_hash,
                    session_id,
                    teacher_model,
                    prompt,
                    json.dumps(openai_tools, ensure_ascii=False),
                    json.dumps(messages, ensure_ascii=False),
                    tools_csv,
                    len(ok_steps),
                    1 if all_ok else 0,
                    1 if ok_steps else 0,
                    est_tokens,
                    quality,
                    difficulty,
                    source,
                    now,
                ),
            )

            # Bonus: if there was a failed attempt that later succeeded in the same turn, save a DPO pair!
            if failed_steps and ok_steps:
                bad = failed_steps[0]
                good = ok_steps[-1]
                pair_hash = hashlib.sha256(
                    f"{prompt.lower()}::{bad.get('tool')}::{good.get('tool')}".encode("utf-8")
                ).hexdigest()[:32]
                rejected_msg = {
                    "role": "assistant",
                    "content": "",
                    "tool_calls": [
                        {
                            "type": "function",
                            "function": {
                                "name": str(bad.get("tool") or ""),
                                "arguments": json.dumps(bad.get("args") or {}, ensure_ascii=False, default=str),
                            },
                        }
                    ],
                }
                chosen_msg = {
                    "role": "assistant",
                    "content": "",
                    "tool_calls": [
                        {
                            "type": "function",
                            "function": {
                                "name": str(good.get("tool") or ""),
                                "arguments": json.dumps(good.get("args") or {}, ensure_ascii=False, default=str),
                            },
                        }
                    ],
                }
                conn.execute(
                    """
                    INSERT OR IGNORE INTO dpo_pairs (
                        pair_hash, teacher_model, user_prompt, routed_tools_json,
                        chosen_json, rejected_json, reason, created_at
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        pair_hash,
                        teacher_model,
                        prompt,
                        json.dumps(openai_tools, ensure_ascii=False),
                        json.dumps(chosen_msg, ensure_ascii=False),
                        json.dumps(rejected_msg, ensure_ascii=False),
                        f"failed_err: {str(bad.get('error') or '')[:120]}",
                        now,
                    ),
                )

        return {"saved": True, "sample_hash": sample_hash, "quality_score": quality, "est_tokens": est_tokens}

    def get_stats(self) -> dict[str, Any]:
        with self._lock, self._connect() as conn:
            total = conn.execute("SELECT COUNT(*) FROM trajectories").fetchone()[0]
            tool_turns = conn.execute("SELECT COUNT(*) FROM trajectories WHERE has_tool_calls = 1").fetchone()[0]
            high_q = conn.execute("SELECT COUNT(*) FROM trajectories WHERE quality_score >= 0.75").fetchone()[0]
            avg_tok = conn.execute("SELECT COALESCE(AVG(est_tokens), 0) FROM trajectories").fetchone()[0]
            dpo_cnt = conn.execute("SELECT COUNT(*) FROM dpo_pairs").fetchone()[0]
            by_teacher = [
                {"teacher": r[0], "count": r[1]}
                for r in conn.execute(
                    "SELECT teacher_model, COUNT(*) FROM trajectories GROUP BY teacher_model ORDER BY COUNT(*) DESC"
                ).fetchall()
            ]
            rows = conn.execute("SELECT tools_used_csv FROM trajectories WHERE tools_used_csv != ''").fetchall()

        tool_counts: Counter[str] = Counter()
        for r in rows:
            for t in str(r[0]).split(","):
                if t.strip():
                    tool_counts[t.strip()] += 1

        return {
            "db_path": str(self.db_path),
            "total_samples": int(total),
            "tool_calling_samples": int(tool_turns),
            "high_quality_samples": int(high_q),
            "dpo_pairs": int(dpo_cnt),
            "avg_est_tokens": int(round(avg_tok or 0)),
            "by_teacher": by_teacher,
            "top_tools_coverage": [{"tool": k, "count": v} for k, v in tool_counts.most_common(15)],
        }

    def export_colab_jsonl(
        self,
        *,
        min_quality: float = 0.65,
        max_tokens: int = 3800,
        only_tool_turns: bool = False,
        max_per_tool: int = 50,
        output_dir: Path = OUTPUTS_DIR,
    ) -> dict[str, Any]:
        """Export balanced, Colab-T4-ready Qwen2.5-1.5B SFT JSONL (+ DPO JSONL if available)."""
        out_dir = Path(output_dir)
        out_dir.mkdir(parents=True, exist_ok=True)
        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        sft_path = out_dir / f"qwen25_1.5b_sft_{ts}.jsonl"
        dpo_path = out_dir / f"qwen25_1.5b_dpo_{ts}.jsonl"

        with self._lock, self._connect() as conn:
            sql = (
                "SELECT id, teacher_model, routed_tools_json, messages_json, tools_used_csv, est_tokens, quality_score, difficulty "
                "FROM trajectories WHERE quality_score >= ? AND est_tokens <= ?"
            )
            params: list[Any] = [float(min_quality), int(max_tokens)]
            if only_tool_turns:
                sql += " AND has_tool_calls = 1"
            sql += " ORDER BY quality_score DESC, id DESC"
            rows = conn.execute(sql, params).fetchall()
            dpo_rows = conn.execute(
                "SELECT user_prompt, routed_tools_json, chosen_json, rejected_json, reason FROM dpo_pairs ORDER BY id DESC"
            ).fetchall()

        per_tool_cap: Counter[str] = Counter()
        exported_ids: list[int] = []
        sft_lines: list[str] = []

        for r in rows:
            primary_tool = str(r["tools_used_csv"] or "chat_only").split(",")[0]
            if max_per_tool > 0 and per_tool_cap[primary_tool] >= max_per_tool:
                continue
            per_tool_cap[primary_tool] += 1
            exported_ids.append(int(r["id"]))
            record = {
                "messages": json.loads(r["messages_json"]),
                "tools": json.loads(r["routed_tools_json"]),
                "meta": {
                    "teacher": r["teacher_model"],
                    "difficulty": r["difficulty"],
                    "quality": r["quality_score"],
                    "est_tokens": r["est_tokens"],
                },
            }
            sft_lines.append(json.dumps(record, ensure_ascii=False))

        sft_path.write_text("\n".join(sft_lines) + ("\n" if sft_lines else ""), encoding="utf-8")

        dpo_count = 0
        if dpo_rows:
            dpo_lines = []
            for dr in dpo_rows:
                dpo_lines.append(
                    json.dumps(
                        {
                            "prompt": dr["user_prompt"],
                            "tools": json.loads(dr["routed_tools_json"]),
                            "chosen": json.loads(dr["chosen_json"]),
                            "rejected": json.loads(dr["rejected_json"]),
                            "reason": dr["reason"],
                        },
                        ensure_ascii=False,
                    )
                )
            dpo_path.write_text("\n".join(dpo_lines) + "\n", encoding="utf-8")
            dpo_count = len(dpo_lines)

        if exported_ids:
            with self._lock, self._connect() as conn:
                conn.executemany(
                    "UPDATE trajectories SET exported = 1 WHERE id = ?",
                    [(i,) for i in exported_ids],
                )

        return {
            "ok": True,
            "sft_file": str(sft_path),
            "sft_count": len(sft_lines),
            "dpo_file": str(dpo_path) if dpo_count > 0 else "",
            "dpo_count": dpo_count,
            "max_tokens": max_tokens,
            "min_quality": min_quality,
        }
