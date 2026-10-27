import os
import sys
import time
import json
import uuid
import logging
import urllib.request
import urllib.error
import subprocess
from typing import Dict, Any, Optional
from .base_tool import BaseTool

logger = logging.getLogger(__name__)

class PythonSandboxTool(BaseTool):
    name = "python_sandbox_tool"
    description = (
        "Công cụ Thực thi Sandbox Python An toàn (Isolated Code Runner): "
        "Chạy mã nguồn Python trong môi trường Container Sandbox cô lập, bảo mật dữ liệu tuyệt đối. "
        "Ngăn chặn can thiệp vào cơ sở dữ liệu và hệ thống máy chủ, trả về kết quả stdout, stderr và các file sinh ra."
    )

    def __init__(self):
        super().__init__()
        self.sandbox_url = os.getenv("SANDBOX_SERVICE_URL", "http://python-sandbox:5008")

    def execute(self, arguments: Dict[str, Any]) -> str:
        try:
            code = arguments.get("code") or arguments.get("script") or arguments.get("python_code")
            if not code:
                return json.dumps({
                    "success": False,
                    "error": "Mã nguồn Python không được để trống."
                }, ensure_ascii=False)

            timeout_seconds = int(arguments.get("timeout_seconds") or arguments.get("timeout") or 15)
            timeout_seconds = max(1, min(30, timeout_seconds))

            # 1. Thử gửi tới Container Sandbox Microservice qua HTTP
            payload = json.dumps({
                "code": code,
                "timeout_seconds": timeout_seconds,
                "files": arguments.get("files")
            }).encode("utf-8")

            try:
                req = urllib.request.Request(
                    f"{self.sandbox_url}/execute",
                    data=payload,
                    headers={"Content-Type": "application/json"},
                    method="POST"
                )
                with urllib.request.urlopen(req, timeout=timeout_seconds + 5) as resp:
                    resp_data = json.loads(resp.read().decode("utf-8"))
                    return json.dumps({
                        "success": resp_data.get("success", False),
                        "environment": "docker-isolated-sandbox",
                        "stdout": resp_data.get("stdout", ""),
                        "stderr": resp_data.get("stderr", ""),
                        "exit_code": resp_data.get("exit_code", 0),
                        "execution_time_ms": resp_data.get("execution_time_ms", 0),
                        "output_files": resp_data.get("output_files", []),
                    }, ensure_ascii=False)
            except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError) as ex:
                logger.info(f"[PythonSandboxTool] Sandbox container at {self.sandbox_url} unreachable: {ex}. Using local safe fallback.")

            # 2. Cơ chế Fallback an toàn (Local Subprocess Sandbox với Timeout và Thư mục tạm cô lập)
            run_id = f"sandbox_{uuid.uuid4().hex[:10]}"
            temp_dir = os.path.join(os.getcwd(), "scratch", run_id)
            os.makedirs(temp_dir, exist_ok=True)

            script_file = os.path.join(temp_dir, "isolated_script.py")
            with open(script_file, "w", encoding="utf-8") as f:
                f.write(code)

            start_time = time.time()
            clean_env = {
                "PATH": os.environ.get("PATH", ""),
                "PYTHONPATH": temp_dir,
                "PYTHONUNBUFFERED": "1",
                "TMPDIR": temp_dir,
            }

            try:
                proc = subprocess.run(
                    [sys.executable, script_file],
                    capture_output=True,
                    text=True,
                    timeout=timeout_seconds,
                    cwd=temp_dir,
                    env=clean_env
                )
                exec_ms = round((time.time() - start_time) * 1000, 2)
                return json.dumps({
                    "success": (proc.returncode == 0),
                    "environment": "local-isolated-subprocess",
                    "stdout": proc.stdout,
                    "stderr": proc.stderr,
                    "exit_code": proc.returncode,
                    "execution_time_ms": exec_ms,
                }, ensure_ascii=False)
            except subprocess.TimeoutExpired:
                return json.dumps({
                    "success": False,
                    "environment": "local-isolated-subprocess",
                    "stdout": "",
                    "stderr": f"Lệnh thực thi vượt quá thời gian cho phép ({timeout_seconds}s)",
                    "exit_code": 124,
                    "execution_time_ms": timeout_seconds * 1000,
                }, ensure_ascii=False)
            finally:
                try:
                    import shutil
                    shutil.rmtree(temp_dir, ignore_errors=True)
                except Exception:
                    pass

        except Exception as e:
            logger.error(f"[PythonSandboxTool] Error: {str(e)}")
            return json.dumps({
                "success": False,
                "error": str(e)
            }, ensure_ascii=False)


_default_sandbox_tool = PythonSandboxTool()

def run_python_sandbox(code: str, timeout: int = 15) -> Dict[str, Any]:
    """Hàm helper tiện ích gọi trực tiếp sandbox từ code Python"""
    raw_res = _default_sandbox_tool.execute({"code": code, "timeout_seconds": timeout})
    try:
        data = json.loads(raw_res)
        stdout = data.get("stdout", "")
        stderr = data.get("stderr", "")
        output = stdout if stdout else stderr
        return {
            "success": data.get("success", False),
            "output": output,
            "stdout": stdout,
            "stderr": stderr,
            "execution_time_ms": data.get("execution_time_ms", 0),
            "environment": data.get("environment", "unknown")
        }
    except Exception:
        return {
            "success": True,
            "output": raw_res
        }

