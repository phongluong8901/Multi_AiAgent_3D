"""
Isolated Code Execution Sandbox.
Executes generated verification benchmarks, simulations, and validation scripts
within a subprocess boundary with strict timeout limits and static safety filtering.
"""

import sys
import time
import subprocess
from typing import Dict, Any

# Dangerous operational keywords barred from execution in the sandbox
FORBIDDEN_KEYWORDS = [
    "shutil.rmtree",
    "os.remove",
    "os.unlink",
    "subprocess.Popen",
    "ctypes",
    "__import__('os').system",
    "format c:",
    "mkfs",
]

def execute_code_sandbox(code: str, timeout_seconds: int = 8) -> Dict[str, Any]:
    """
    Executes a Python validation/benchmark script in a subprocess with output capture.
    Performs pre-execution security keyword inspection, tracks execution duration in ms,
    and captures stdout, stderr, and process return codes.

    Args:
        code: Python source code string to execute.
        timeout_seconds: Subprocess execution timeout ceiling (default 8s).

    Returns:
        Dictionary containing 'success', 'exit_code', 'stdout', 'stderr',
        'execution_time_ms', and 'error'.
    """
    # 1. Static security validation
    for kw in FORBIDDEN_KEYWORDS:
        if kw in code:
            return {
                "success": False,
                "exit_code": -1,
                "stdout": "",
                "stderr": f"Mã bị chặn do chứa lệnh nguy hại: '{kw}'",
                "execution_time_ms": 0.0,
                "error": f"Lệnh không an toàn: {kw}"
            }

    start_time = time.perf_counter()
    try:
        # Run isolated Python subprocess executing code string via -c
        process = subprocess.run(
            [sys.executable, "-c", code],
            capture_output=True,
            text=True,
            timeout=timeout_seconds,
            encoding="utf-8",
            errors="replace"
        )
        elapsed_ms = (time.perf_counter() - start_time) * 1000.0
        is_success = (process.returncode == 0)

        return {
            "success": is_success,
            "exit_code": process.returncode,
            "stdout": process.stdout.strip(),
            "stderr": process.stderr.strip(),
            "execution_time_ms": round(elapsed_ms, 2),
            "error": None if is_success else (process.stderr.strip() or f"Mã thoát lỗi: {process.returncode}")
        }
    except subprocess.TimeoutExpired:
        elapsed_ms = (time.perf_counter() - start_time) * 1000.0
        return {
            "success": False,
            "exit_code": -99,
            "stdout": "",
            "stderr": f"Thực thi quá hạn định mức ({timeout_seconds}s). Có thể có vòng lặp vô tận.",
            "execution_time_ms": round(elapsed_ms, 2),
            "error": "TimeoutExpired"
        }
    except Exception as e:
        elapsed_ms = (time.perf_counter() - start_time) * 1000.0
        return {
            "success": False,
            "exit_code": -1,
            "stdout": "",
            "stderr": str(e),
            "execution_time_ms": round(elapsed_ms, 2),
            "error": str(e)
        }


