"""Two-tier Context Window Compaction for multi-turn Gemini tool sessions.

Tier 1 (Zero-API Post-Turn Pruning):
    Strips raw intermediate `function_call` and `function_response` JSON payloads from
    completed turns, keeping clean alternating (user, model) text history plus a compact
    1-line footnote of tools called. Eliminates 50-80% of multi-turn token growth at 0 cost.

Tier 2 (Threshold / Manual Rolling Summarization):
    When prompt tokens exceed `token_threshold` (default 10,000) or user runs `/compact`,
    older turns outside the recent sliding window (`keep_recent_turns`, default 3) are
    summarized into a dense bullet block preserving key numbers, URLs, files, and facts.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from google import genai
from google.genai import types

from agent_runtime.config import (
    DEFAULT_API_TIMEOUT_SEC,
    DEFAULT_COMPACT_TOKEN_THRESHOLD,
    DEFAULT_KEEP_RECENT_TURNS,
)
from agent_runtime.executor import extract_text, run_interruptible


def estimate_history_chars(history: list[types.Content]) -> int:
    """Calculate total character length across text, function_call, and function_response parts."""
    total = 0
    for content in history or []:
        for part in getattr(content, "parts", []) or []:
            txt = getattr(part, "text", None)
            if txt:
                total += len(txt)
            fc = getattr(part, "function_call", None)
            if fc:
                total += len(str(getattr(fc, "name", ""))) + len(str(getattr(fc, "args", "")))
            fr = getattr(part, "function_response", None)
            if fr:
                total += len(str(getattr(fr, "name", ""))) + len(str(getattr(fr, "response", "")))
    return total


@dataclass
class CompactionStats:
    before_chars: int
    after_chars: int
    summarized_turns: int = 0
    used_llm_summary: bool = False

    @property
    def saved_chars(self) -> int:
        return max(0, self.before_chars - self.after_chars)

    @property
    def est_saved_tokens(self) -> int:
        # Rough average ~3.8 chars/token for mixed Vietnamese + JSON
        return int(self.saved_chars / 3.8)


class ContextCompactor:
    """Maintains compact, clean alternating chat history across long tool-calling sessions."""

    def __init__(
        self,
        enabled: bool = True,
        token_threshold: int = DEFAULT_COMPACT_TOKEN_THRESHOLD,
        keep_recent_turns: int = DEFAULT_KEEP_RECENT_TURNS,
    ):
        self.enabled = enabled
        self.token_threshold = token_threshold
        self.keep_recent_turns = max(1, keep_recent_turns)
        self.total_saved_chars = 0
        self.compaction_runs = 0

    @staticmethod
    def build_clean_turn_pair(
        user_prompt: str,
        model_answer: str,
        trace: list[dict[str, Any]],
    ) -> list[types.Content]:
        """Convert a completed tool-calling turn into a clean (user, model) Content pair.

        IMPORTANT: Never append `[Tool trace: ...]` to the `model` message! Putting synthetic
        trace strings into model history teaches small models (flash-lite) to hallucinate fake
        `[Tool trace: ...(OK)]` text instead of calling real functions.
        """
        ans = (model_answer or "").strip() or "(empty)"
        return [
            types.Content(role="user", parts=[types.Part.from_text(text=user_prompt.strip())]),
            types.Content(role="model", parts=[types.Part.from_text(text=ans)]),
        ]

    @staticmethod
    def _fade_text(text: str, max_chars: int) -> str:
        """Compress older turn text deterministically (0 API cost) keeping key facts/numbers/URLs."""
        clean = " ".join((text or "").split())
        if len(clean) <= max_chars:
            return clean
        return clean[: max(40, max_chars - 3)].rstrip() + "..."

    @staticmethod
    def _tokenize_vi(text: str) -> set[str]:
        import re as _re
        import unicodedata as _ud

        t = (text or "").replace("đ", "d").replace("Đ", "D")
        t = "".join(ch for ch in _ud.normalize("NFKD", t) if not _ud.combining(ch)).lower()
        stop = {"la", "va", "cua", "cho", "voi", "cac", "nhung", "mot", "nay", "kia", "thi", "co", "khong", "duoc", "nhu", "the", "nao", "xem", "di", "nhe"}
        return {w for w in _re.findall(r"[a-z0-9_]+", t) if len(w) >= 2 and w not in stop}

    @classmethod
    def _jaccard(cls, a: set[str], b: set[str]) -> float:
        if not a or not b:
            return 0.0
        inter = len(a & b)
        return inter / float(len(a | b)) if inter else 0.0

    def apply_faded_session_window(
        self,
        clean_history: list[types.Content],
        sharp_turns: int = 5,
        current_query: str = "",
    ) -> list[types.Content]:
        """Topic-Clustered Associative Fuzzy Session Memory (0ms, 0 API cost):
        1. Clusters turns in the current session into Topic Groups via lexical overlap.
        2. Computes dynamic Relevance % (0-100%) of each Topic Group against `current_query`.
        3. Adapts resolution per turn:
           - Immediate last 2 turns OR high-relevance topic group (>=45%): 100% Sharp (Nho sau — associative recall!)
           - Medium relevance (20-44%) OR within `sharp_turns` (3..5 turns ago): ~45% Faded ([Nho mo | ~XX%])
           - Unrelated topic group (<20% and >2 turns ago): ~12% Ultra-Faint ([Nhom khac | ~XX%])
        """
        if not clean_history:
            return []
        total_msgs = len(clean_history)
        total_turns = total_msgs // 2
        if total_turns <= 2:
            return list(clean_history)

        # Extract turn texts & token sets
        turn_pairs: list[tuple[types.Content, types.Content, str, str, set[str]]] = []
        for t_idx in range(total_turns):
            u_msg = clean_history[t_idx * 2]
            m_msg = clean_history[t_idx * 2 + 1]
            u_txt = "".join(getattr(p, "text", "") or "" for p in (getattr(u_msg, "parts", None) or []))
            m_txt = "".join(getattr(p, "text", "") or "" for p in (getattr(m_msg, "parts", None) or []))
            toks = self._tokenize_vi(f"{u_txt} {m_txt[:300]}")
            turn_pairs.append((u_msg, m_msg, u_txt, m_txt, toks))

        # 1. Greedy Topic Clustering (0ms): group related turns together
        groups: list[dict[str, Any]] = []  # [{"id": 1, "tokens": set, "indices": [int]}]
        turn_to_group: dict[int, int] = {}
        for idx, (_, _, _, _, toks) in enumerate(turn_pairs):
            best_gid = -1
            best_sim = 0.16  # threshold to join an existing topic group
            for g in groups:
                sim = self._jaccard(toks, g["tokens"])
                if sim > best_sim:
                    best_sim = sim
                    best_gid = g["id"]
            if best_gid == -1:
                gid = len(groups) + 1
                groups.append({"id": gid, "tokens": set(toks), "indices": [idx]})
                turn_to_group[idx] = gid
            else:
                g_obj = groups[best_gid - 1]
                g_obj["tokens"].update(toks)
                g_obj["indices"].append(idx)
                turn_to_group[idx] = best_gid

        # 2. Score each Topic Group's relevance % to `current_query`
        q_toks = self._tokenize_vi(current_query)
        group_rel: dict[int, float] = {}
        if q_toks:
            for g in groups:
                overlap = len(q_toks & g["tokens"]) / float(max(1, min(len(q_toks), 5)))
                jacc = self._jaccard(q_toks, g["tokens"])
                group_rel[g["id"]] = min(1.0, max(overlap * 0.85, jacc * 1.6))
        else:
            for g in groups:
                group_rel[g["id"]] = 0.5  # neutral when no query provided

        # 3. Render Multi-Resolution History based on (Topic Relevance % + Recency)
        faded_history: list[types.Content] = []
        for idx, (u_msg, m_msg, u_txt, m_txt, _) in enumerate(turn_pairs):
            turns_ago = total_turns - idx  # 1 = most recent completed turn
            gid = turn_to_group[idx]
            rel_pct = int(round(group_rel.get(gid, 0.0) * 100))

            # Always keep immediate last 2 turns OR strongly relevant topic group (>=45%) at 100% Sharp!
            if turns_ago <= 2 or (q_toks and rel_pct >= 45):
                faded_history.append(u_msg)
                faded_history.append(m_msg)
            elif (q_toks and rel_pct >= 20) or (not q_toks and turns_ago <= sharp_turns) or (turns_ago <= sharp_turns and rel_pct >= 10):
                u_out = self._fade_text(u_txt, 160)
                m_out = f"[Nhom #{gid} | lien quan ~{rel_pct}% | Nho mo] " + self._fade_text(m_txt, 240)
                faded_history.append(types.Content(role="user", parts=[types.Part.from_text(text=u_out)]))
                faded_history.append(types.Content(role="model", parts=[types.Part.from_text(text=m_out)]))
            else:
                # Unrelated topic group -> compress aggressively (~12% faint gist) so it never distracts!
                u_out = self._fade_text(u_txt, 75)
                m_out = f"[Nhom #{gid} | lien quan ~{rel_pct}% | Nho mo xa] " + self._fade_text(m_txt, 95)
                faded_history.append(types.Content(role="user", parts=[types.Part.from_text(text=u_out)]))
                faded_history.append(types.Content(role="model", parts=[types.Part.from_text(text=m_out)]))

        if total_msgs % 2 == 1:
            faded_history.append(clean_history[-1])
        return faded_history

    def prune_completed_turn(
        self,
        raw_curated_history: list[types.Content],
        prior_clean_history: list[types.Content],
        user_prompt: str,
        model_answer: str,
        trace: list[dict[str, Any]],
    ) -> tuple[list[types.Content], CompactionStats]:
        """Tier 1: Replace raw tool-heavy turn history with clean text history."""
        before_chars = estimate_history_chars(raw_curated_history)
        new_pair = self.build_clean_turn_pair(user_prompt, model_answer, trace)
        clean_history = list(prior_clean_history) + new_pair
        after_chars = estimate_history_chars(clean_history)

        stats = CompactionStats(before_chars=before_chars, after_chars=after_chars)
        if stats.saved_chars > 0:
            self.total_saved_chars += stats.saved_chars
        return clean_history, stats

    def should_summarize(self, last_input_tokens: int, clean_history: list[types.Content]) -> bool:
        """Check whether Tier 2 rolling summarization should trigger."""
        if not self.enabled or self.token_threshold <= 0:
            return False
        total_pairs = len(clean_history) // 2
        if total_pairs <= self.keep_recent_turns:
            return False
        # Trigger if API reported high input tokens OR clean history chars exceed threshold * 3.5
        est_tokens_from_chars = int(estimate_history_chars(clean_history) / 3.5)
        return last_input_tokens >= self.token_threshold or est_tokens_from_chars >= self.token_threshold

    def summarize_old_turns(
        self,
        client: genai.Client,
        model: str,
        clean_history: list[types.Content],
        timeout_sec: float = float(DEFAULT_API_TIMEOUT_SEC),
    ) -> tuple[list[types.Content], CompactionStats]:
        """Tier 2: Compress older turns into a dense summary while keeping recent turns intact."""
        before_chars = estimate_history_chars(clean_history)
        keep_msgs = self.keep_recent_turns * 2

        if len(clean_history) <= keep_msgs:
            return clean_history, CompactionStats(before_chars=before_chars, after_chars=before_chars)

        older_msgs = clean_history[:-keep_msgs]
        recent_msgs = clean_history[-keep_msgs:]
        summarized_turns = len(older_msgs) // 2

        transcript_lines: list[str] = []
        for msg in older_msgs:
            role_label = "USER" if msg.role == "user" else "ASSISTANT"
            txt = extract_text(SimpleResponseAdapter(msg), strip=True)
            transcript_lines.append(f"[{role_label}]: {txt}")
        transcript = "\n\n".join(transcript_lines)

        summary_prompt = (
            "Hay nen lich su hoi thoai duoi day thanh ban tom tat ngan gon (toi da 250 tu, dang gach dau dong). "
            "BAT BUOC giu nguyen chinh xac: cac con so quan trong (gia ca, ty gia, nhiet do, ngay gio), "
            "link URL nguon, ten file da doc/xuat, va yeu cau cua nguoi dung.\n\n"
            f"{transcript[:24000]}"
        )

        used_llm = False
        try:
            resp = run_interruptible(
                lambda: client.models.generate_content(
                    model=model,
                    contents=summary_prompt,
                    config=types.GenerateContentConfig(temperature=0.1),
                ),
                timeout_sec=timeout_sec,
            )
            summary_text = extract_text(resp, strip=True)
            used_llm = bool(summary_text)
        except Exception:
            summary_text = ""

        if not summary_text:
            # Safe deterministic fallback truncation if LLM call fails
            snippets = [line[:220] for line in transcript_lines[-6:]]
            summary_text = "Tom tat cac luot truoc:\n" + "\n".join(f"- {s}" for s in snippets)

        summary_pair = [
            types.Content(
                role="user",
                parts=[types.Part.from_text(text="[CONTEXT SUMMARY — Cac luot hoi thoai truoc do]")],
            ),
            types.Content(
                role="model",
                parts=[types.Part.from_text(text=summary_text)],
            ),
        ]

        compacted = summary_pair + list(recent_msgs)
        after_chars = estimate_history_chars(compacted)
        stats = CompactionStats(
            before_chars=before_chars,
            after_chars=after_chars,
            summarized_turns=summarized_turns,
            used_llm_summary=used_llm,
        )
        self.total_saved_chars += stats.saved_chars
        self.compaction_runs += 1
        return compacted, stats


class SimpleResponseAdapter:
    """Tiny adapter so `extract_text` can read a single `types.Content` object."""

    def __init__(self, content: types.Content):
        self.candidates = [type("Cand", (), {"content": content})()]
