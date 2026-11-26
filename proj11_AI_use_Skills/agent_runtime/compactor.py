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
        """Convert a completed tool-calling turn into a compact (user, model) Content pair."""
        ans = (model_answer or "").strip() or "(empty)"
        if trace:
            tools_brief = ", ".join(
                f"{t.get('tool')}({'OK' if t.get('ok') else 'ERR'})" for t in trace
            )
            compact_model_text = f"{ans}\n\n[Tool trace: {tools_brief}]"
        else:
            compact_model_text = ans

        return [
            types.Content(role="user", parts=[types.Part.from_text(text=user_prompt.strip())]),
            types.Content(role="model", parts=[types.Part.from_text(text=compact_model_text)]),
        ]

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
