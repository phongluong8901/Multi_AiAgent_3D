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

import os
import subprocess
import sys
from pathlib import Path


def _reexec_in_venv_if_needed() -> int | None:
    """Auto-delegate to local `.venv` Python when launched via global `python` so all installed skill libs work."""
    if os.environ.get("AGY_SKIP_VENV_REEXEC") == "1":
        return None
    root = Path(__file__).resolve().parent
    venv_py = root / ".venv" / ("Scripts/python.exe" if os.name == "nt" else "bin/python")
    if not venv_py.exists():
        return None
    try:
        cur_exe = Path(sys.executable).resolve()
        if cur_exe == venv_py.resolve() or (root / ".venv").resolve() in cur_exe.parents:
            return None
    except OSError:
        return None

    env = dict(os.environ)
    env["AGY_SKIP_VENV_REEXEC"] = "1"
    print(f"[VENV] Switching from global Python to {venv_py}", flush=True)
    try:
        return subprocess.call([str(venv_py), str(Path(__file__).resolve()), *sys.argv[1:]], env=env)
    except KeyboardInterrupt:
        return 130


if __name__ == "__main__":
    rc = _reexec_in_venv_if_needed()
    if rc is not None:
        raise SystemExit(rc)
    from agent_runtime.cli import main

    raise SystemExit(main())
