"""MLflow Tracing & Experiment Tracking integration backed by SQLite."""
from __future__ import annotations

import time
from contextlib import contextmanager
from pathlib import Path
from typing import Any, Iterator

from agent_runtime.config import DATA_DIR

DEFAULT_MLFLOW_DB = DATA_DIR / "mlflow.db"
DEFAULT_EXPERIMENT_NAME = "proj11_gemini_skills_agent"


class MLflowTracker:
    """Logs agent turns, tool spans, token usage, latency, and cost to MLflow (SQLite store)."""

    def __init__(
        self,
        enabled: bool = False,
        tracking_uri: str | None = None,
        experiment_name: str = DEFAULT_EXPERIMENT_NAME,
    ):
        self.enabled = enabled
        self.experiment_name = experiment_name
        self._mlflow: Any = None
        self.tracking_uri = tracking_uri or self._default_sqlite_uri()

        if self.enabled:
            self._setup()

    @staticmethod
    def _default_sqlite_uri() -> str:
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        # SQLAlchemy SQLite URI with forward slashes on Windows
        return f"sqlite:///{DEFAULT_MLFLOW_DB.as_posix()}"

    def _setup(self) -> None:
        try:
            import mlflow  # type: ignore

            mlflow.set_tracking_uri(self.tracking_uri)
            mlflow.set_experiment(self.experiment_name)
            self._mlflow = mlflow
            print(
                f"[MLFLOW] Enabled | uri={self.tracking_uri} | experiment={self.experiment_name}",
                flush=True,
            )
        except Exception as exc:
            self.enabled = False
            self._mlflow = None
            print(f"[WARN] MLflow unavailable ({type(exc).__name__}: {exc}). Continuing without MLflow.", flush=True)

    @contextmanager
    def trace_span(
        self,
        name: str,
        span_type: str = "CHAIN",
        inputs: dict[str, Any] | None = None,
    ) -> Iterator[Any]:
        """Create an MLflow trace span when enabled; no-op otherwise."""
        if not self.enabled or self._mlflow is None or not hasattr(self._mlflow, "start_span"):
            yield None
            return
        with self._mlflow.start_span(name=name, span_type=span_type) as span:
            if inputs:
                try:
                    span.set_inputs(inputs)
                except Exception:
                    pass
            yield span

    def log_turn(
        self,
        *,
        session_id: str,
        prompt: str,
        answer: str,
        model: str,
        top_k: int,
        routed_tools: list[str],
        trace: list[dict[str, Any]],
        elapsed_sec: float,
        input_tokens: int,
        output_tokens: int,
        thoughts_tokens: int,
        total_tokens: int,
        est_cost_usd: float,
        cache_hits: int,
        run_name: str | None = None,
    ) -> None:
        """Log a completed agent turn as an MLflow run with params, metrics, and tags."""
        if not self.enabled or self._mlflow is None:
            return
        try:
            tool_total = len(trace)
            tool_ok = sum(1 for t in trace if t.get("ok"))
            tool_success_rate = (tool_ok / tool_total) if tool_total > 0 else 1.0
            called_names = [t.get("tool", "") for t in trace]
            label = run_name or f"{session_id}_t{int(time.time())}"

            with self._mlflow.start_run(run_name=label):
                self._mlflow.log_params(
                    {
                        "session_id": session_id,
                        "model": model,
                        "router_top_k": top_k,
                        "routed_count": len(routed_tools),
                        "tools_called": ",".join(called_names)[:250] or "NONE",
                    }
                )
                self._mlflow.log_metrics(
                    {
                        "elapsed_sec": float(elapsed_sec),
                        "input_tokens": int(input_tokens),
                        "output_tokens": int(output_tokens),
                        "thoughts_tokens": int(thoughts_tokens),
                        "total_tokens": int(total_tokens),
                        "est_cost_usd": float(est_cost_usd),
                        "tool_calls_count": int(tool_total),
                        "tool_success_rate": float(tool_success_rate),
                        "cache_hits": int(cache_hits),
                    }
                )
                self._mlflow.set_tags(
                    {
                        "prompt_preview": prompt[:250],
                        "answer_preview": (answer or "")[:250],
                    }
                )
        except Exception as exc:
            print(f"[WARN] MLflow log_turn failed: {type(exc).__name__}: {exc}", flush=True)
