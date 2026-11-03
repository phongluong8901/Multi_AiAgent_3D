import sys
import time
import subprocess
from typing import Dict, Any

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
    Thực thi mã kiểm nghiệm (Simulation / Benchmark / Solver) trong môi trường con cô lập.
    Đo đạc thời gian, bắt toàn bộ stdout, stderr và mã thoát.
    """
    # 1. Kiểm tra an toàn tĩnh (Static safety check)
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

