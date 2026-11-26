"""Thin CLI entrypoint for the Gemini skill-calling runtime.

All core modules live in `agent_runtime/`:
- `agent_runtime.config`         : paths, models, fallback chain, system prompt
- `agent_runtime.schema_builder` : Python type -> Gemini Schema conversion
- `agent_runtime.skill_registry` : multi-pack auto-discovery across `skills/*/`
- `agent_runtime.skill_router`   : dynamic top-K tool router
- `agent_runtime.executor`       : Gemini client & Windows-safe interruptible runner
- `agent_runtime.session`        : multi-turn chat memory + automatic model fallback
- `agent_runtime.cli`            : CLI commands (--list-tools, --route-test, --prompt, --benchmark, --chat)
"""
from __future__ import annotations

from agent_runtime.cli import main

if __name__ == "__main__":
    raise SystemExit(main())
