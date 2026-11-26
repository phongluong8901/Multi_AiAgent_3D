"""Launch the 2-Tab Web UI (Chat Workspace + Skill Studio) on http://127.0.0.1:8000."""
from __future__ import annotations

import argparse
import socket
import uvicorn

from agent_runtime.web_app import create_web_app


def _pick_free_port(host: str, preferred: int) -> int:
    for p in (preferred, 8888, 9000, 9090, 9876, 3000, 3030, 5050, 0):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            try:
                s.bind((host, p))
                return s.getsockname()[1]
            except OSError:
                continue
    return preferred


def main() -> None:
    parser = argparse.ArgumentParser(description="Start Gemini Skill Studio & Chat Web UI.")
    parser.add_argument("--host", default="127.0.0.1", help="Bind host (default: 127.0.0.1)")
    parser.add_argument("--port", type=int, default=8000, help="Bind port (default: 8000)")
    parser.add_argument("--mlflow", action="store_true", help="Enable MLflow tracking in Web UI")
    args = parser.parse_args()

    chosen_port = _pick_free_port(args.host, args.port)
    if chosen_port != args.port:
        print(
            f"[WARN] Port {args.port} unavailable/reserved on Windows; switched to port {chosen_port}.",
            flush=True,
        )
    app = create_web_app(enable_mlflow=args.mlflow)
    print(f"[INFO] Starting Web UI at http://{args.host}:{chosen_port}", flush=True)
    uvicorn.run(app, host=args.host, port=chosen_port, log_level="info")


if __name__ == "__main__":
    main()
