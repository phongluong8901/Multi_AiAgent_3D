"""Token usage and estimated cost telemetry for Gemini API responses."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any

# Reference Pay-as-you-go pricing (USD per 1M tokens: input, output) for cost estimation
_MODEL_PRICING_PER_1M: dict[str, tuple[float, float]] = {
    "gemini-3.5-flash-lite": (0.10, 0.40),
    "gemini-3.1-flash-lite": (0.10, 0.40),
    "gemini-2.5-flash-lite": (0.10, 0.40),
    "gemini-3.5-flash": (0.30, 2.50),
    "gemini-3.6-flash": (0.30, 2.50),
    "gemini-3.8-flash": (0.30, 2.50),
    "gemini-2.5-flash": (0.30, 2.50),
}
_DEFAULT_PRICING = (0.15, 0.60)


@dataclass
class TokenUsage:
    input_tokens: int = 0
    output_tokens: int = 0
    thoughts_tokens: int = 0
    total_tokens: int = 0
    peak_input_tokens: int = 0
    api_calls: int = 0

    def add(self, other: TokenUsage) -> None:
        self.input_tokens += other.input_tokens
        self.output_tokens += other.output_tokens
        self.thoughts_tokens += other.thoughts_tokens
        self.total_tokens += other.total_tokens
        self.peak_input_tokens = max(self.peak_input_tokens, other.input_tokens, other.peak_input_tokens)
        self.api_calls += other.api_calls

    def estimate_cost_usd(self, model: str) -> float:
        key = (model or "").lower().replace("models/", "")
        in_price, out_price = _MODEL_PRICING_PER_1M.get(key, _DEFAULT_PRICING)
        billable_out = self.output_tokens + self.thoughts_tokens
        return (self.input_tokens / 1_000_000.0) * in_price + (billable_out / 1_000_000.0) * out_price

    def format_summary(self, model: str) -> str:
        cost = self.estimate_cost_usd(model)
        parts = [
            f"calls={self.api_calls}",
            f"in={self.input_tokens:,}",
            f"out={self.output_tokens:,}",
        ]
        if self.thoughts_tokens > 0:
            parts.append(f"thoughts={self.thoughts_tokens:,}")
        parts.append(f"total={self.total_tokens:,}")
        parts.append(f"est_payg=${cost:.6f}")
        return " | ".join(parts)


def extract_usage(response: Any) -> TokenUsage:
    """Extract token counts from a google.genai GenerateContentResponse."""
    meta = getattr(response, "usage_metadata", None)
    if meta is None:
        return TokenUsage(api_calls=1)

    in_tok = int(getattr(meta, "prompt_token_count", 0) or 0)
    out_tok = int(getattr(meta, "candidates_token_count", 0) or 0)
    thoughts_tok = int(getattr(meta, "thoughts_token_count", 0) or 0)
    total_tok = int(getattr(meta, "total_token_count", 0) or (in_tok + out_tok + thoughts_tok))
    return TokenUsage(
        input_tokens=in_tok,
        output_tokens=out_tok,
        thoughts_tokens=thoughts_tok,
        total_tokens=total_tok,
        peak_input_tokens=in_tok,
        api_calls=1,
    )
