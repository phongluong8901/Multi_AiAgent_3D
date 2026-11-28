import pandas as pd
import os
import time
import signal
from threading import Thread

TOOL_SCHEMA = {
    "name": "skill_python_data_sandbox",
    "description": "Analyze CSV/Excel datasets and safely validate/run restricted Python data-processing snippets (blocking os.system, subprocess, eval, shutil.rmtree) or built-in group-by aggregation and summary export.",
    "risk_level": "confirm",
    "parameters": {
        "validate_code_safety": {
            "code": "str"
        },
        "analyze_csv_summary": {
            "csv_path": "str",
            "group_by": "str",
            "value_col": "str"
        },
        "run_safe_script": {
            "code": "str",
            "work_dir": "str",
            "timeout": "int",
            "dry_run": "bool"
        }
    }
}

def execute(action: str = "", **kwargs) -> dict:
    if action == "validate_code_safety":
        return validate_code_safety(kwargs.get("code", ""))
    elif action == "analyze_csv_summary":
        return analyze_csv_summary(kwargs.get("csv_path", ""), kwargs.get("group_by", ""), kwargs.get("value_col", ""))
    elif action == "run_safe_script":
        return run_safe_script(kwargs.get("code", ""), kwargs.get("work_dir", "."), kwargs.get("timeout", 20), kwargs.get("dry_run", True))
    else:
        return {"ok": False, "error": "Unknown action"}

def validate_code_safety(code: str) -> dict:
    forbidden_functions = ["os.system", "subprocess", "eval", "shutil.rmtree"]
    for func in forbidden_functions:
        if func in code:
            return {"ok": False, "error": f"Forbidden function {func} detected"}
    return {"ok": True}

def analyze_csv_summary(csv_path: str, group_by: str = '', value_col: str = '') -> dict:
    try:
        df = pd.read_csv(csv_path)
        if group_by and value_col:
            summary = df.groupby(group_by)[value_col].agg(['sum', 'mean', 'count']).reset_index()
            return {"ok": True, "summary": summary.to_dict(orient='records')}
        else:
            return {"ok": True, "summary": df.describe().to_dict()}
    except Exception as e:
        return {"ok": False, "error": str(e)}

def run_safe_script(code: str, work_dir: str = '.', timeout: int = 20, dry_run: bool = True) -> dict:
    validation_result = validate_code_safety(code)
    if not validation_result["ok"]:
        return validation_result  # Trả về thông báo lỗi cụ thể từ validate_code_safety

    def target():
        try:
            exec(code, {"__builtins__": None})
        except Exception as e:
            result["error"] = str(e)

    result = {"ok": False, "error": ""}
    if not dry_run:
        try:
            os.chdir(work_dir)
            thread = Thread(target=target)
            thread.start()
            thread.join(timeout)
            if thread.is_alive():
                os.kill(thread.ident, signal.SIGKILL)
                result["error"] = "Script execution timed out"
            else:
                result["ok"] = True
        except Exception as e:
            result["error"] = str(e)
    else:
        result["ok"] = True
        result["message"] = "Dry run completed"

    return result
