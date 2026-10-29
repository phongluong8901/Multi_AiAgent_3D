"""
Multi-Agent Distributed Hardware Worker Entrypoint.
Delegates to modular services in backend_worker/.
"""
import os
import sys
import importlib.util

_base_dir = os.path.dirname(os.path.abspath(__file__))
if _base_dir not in sys.path:
    sys.path.insert(0, _base_dir)

_bw_dir = os.path.join(_base_dir, "backend_worker")
if not os.path.exists(_bw_dir):
    _bw_dir = os.path.join(_base_dir, "backend-worker")

if _bw_dir not in sys.path:
    sys.path.insert(0, _bw_dir)

def run():
    main_py = os.path.join(_bw_dir, "main.py")
    if not os.path.exists(main_py):
        raise FileNotFoundError(f"Missing main.py at {main_py}")
    spec = importlib.util.spec_from_file_location("backend_worker_main", main_py)
    if spec and spec.loader:
        mod = importlib.util.module_from_spec(spec)
        sys.modules["backend_worker_main"] = mod
        spec.loader.exec_module(mod)
        mod.run()
    else:
        raise ImportError(f"Failed to load spec for {main_py}")

if __name__ == "__main__":
    run()
