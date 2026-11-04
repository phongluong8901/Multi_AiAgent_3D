import os
import sys
import time
import uuid
import logging
import subprocess
from typing import Dict, Any, Optional
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("sandbox-service")

app = FastAPI(
    title="Multi-Agent Python Sandbox Service",
    description="Isolated, secure execution environment for multi-agent Python code and data tools",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

WORKSPACE_DIR = os.getenv("SANDBOX_WORKSPACE", "/sandbox/workspace")
os.makedirs(WORKSPACE_DIR, exist_ok=True)

# Danh sách các lệnh nguy hiểm bị chặn trước khi chạy
BLOCKED_PATTERNS = [
    "import shutil; shutil.rmtree('/')",
    "os.system('rm -rf",
    "os.system(\"rm -rf",
    ":(){ :|:& };:",
    "subprocess.Popen(['rm', '-rf'",
]

class CodeExecutionRequest(BaseModel):
    code: str = Field(..., description="Python source code to execute")
    timeout_seconds: int = Field(default=15, ge=1, le=30, description="Max execution time in seconds")
    input_data: Optional[str] = Field(default=None, description="Optional standard input (stdin)")
    files: Optional[Dict[str, str]] = Field(default=None, description="Optional files to write before running: filename -> content")

class CodeExecutionResponse(BaseModel):
    success: bool
    stdout: str
    stderr: str
    exit_code: int
    execution_time_ms: float
    output_files: list = []
    error: Optional[str] = None

@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "service": "python-sandbox-service",
        "workspace": WORKSPACE_DIR,
        "python_version": sys.version
    }

@app.post("/execute", response_model=CodeExecutionResponse)
def execute_code(request: CodeExecutionRequest):
    code = request.code.strip()
    if not code:
        raise HTTPException(status_code=400, detail="Mã nguồn Python không được để trống.")

    # 1. Kiểm tra an toàn tĩnh (Static safety guard)
    for pattern in BLOCKED_PATTERNS:
        if pattern in code:
            return CodeExecutionResponse(
                success=False,
                stdout="",
                stderr="[Bảo mật Sandbox]: Phát hiện lệnh nguy hiểm có nguy cơ làm tổn hại hệ thống.",
                exit_code=1,
                execution_time_ms=0,
                error="Lệnh bị chặn bởi chính sách an toàn của Sandbox."
            )

    # 2. Tạo thư mục tạm thời riêng biệt cho lần chạy này (Per-execution isolation)
    run_id = f"run_{uuid.uuid4().hex[:12]}"
    run_dir = os.path.join(WORKSPACE_DIR, run_id)
    os.makedirs(run_dir, exist_ok=True)

    script_path = os.path.join(run_dir, "script.py")

    # 3. Ghi file mã nguồn và các file đính kèm nếu có
    try:
        with open(script_path, "w", encoding="utf-8") as f:
            f.write(code)

        if request.files:
            for fname, content in request.files.items():
                safe_fname = os.path.basename(fname)
                file_dest = os.path.join(run_dir, safe_fname)
                with open(file_dest, "w", encoding="utf-8") as f:
                    f.write(content)

        # 4. Thực thi trong Subprocess với giới hạn thời gian (Timeout)
        start_time = time.time()
        
        # Môi trường chạy cách ly: Không truyền API key hoặc biến bí mật
        isolated_env = {
            "PATH": os.environ.get("PATH", ""),
            "PYTHONPATH": run_dir,
            "PYTHONUNBUFFERED": "1",
            "HOME": run_dir,
            "TMPDIR": run_dir,
        }

        process = subprocess.run(
            [sys.executable, script_path],
            input=request.input_data,
            capture_output=True,
            text=True,
            timeout=request.timeout_seconds,
            cwd=run_dir,
            env=isolated_env
        )

        exec_time_ms = round((time.time() - start_time) * 1000, 2)

        # 5. Kiểm tra các file đầu ra tạo ra (ảnh biểu đồ .png, kết quả .csv, .json)
        created_files = []
        for root, _, files in os.walk(run_dir):
            for file in files:
                if file != "script.py" and not file.endswith(".pyc"):
                    created_files.append(file)

        return CodeExecutionResponse(
            success=(process.returncode == 0),
            stdout=process.stdout,
            stderr=process.stderr,
            exit_code=process.returncode,
            execution_time_ms=exec_time_ms,
            output_files=created_files
        )

    except subprocess.TimeoutExpired:
        return CodeExecutionResponse(
            success=False,
            stdout="",
            stderr=f"[Timeout]: Chương trình thực thi vượt quá thời gian tối đa cho phép ({request.timeout_seconds} giây).",
            exit_code=124,
            execution_time_ms=request.timeout_seconds * 1000,
            error="Execution timed out"
        )
    except Exception as e:
        logger.error(f"Sandbox execution error: {str(e)}")
        return CodeExecutionResponse(
            success=False,
            stdout="",
            stderr=str(e),
            exit_code=-1,
            execution_time_ms=0,
            error=str(e)
        )
    finally:
        # Dọn dẹp thư mục sau khi chạy xong để tiết kiệm tài nguyên
        try:
            import shutil
            shutil.rmtree(run_dir, ignore_errors=True)
        except Exception:
            pass
