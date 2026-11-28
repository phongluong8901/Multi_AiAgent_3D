import os
import json
import subprocess
from pathlib import Path

TOOL_SCHEMA = {
    "name": "skill_dev_ecosystem_glue_composer",
    "description": "Kết nối ghép chuỗi các skill giữa Search WebChrome WinPC LinuxOps và DevForge thành một app hoàn chỉnh tự động. Validate multi-domain ecosystem pipeline specs linking skills across AI/WebChrome/WinPC/LinuxOps/DevForge, generate a runnable Python glue runner script executing steps sequentially with variable passing (dry_run=True default), and export JSON pipeline configs.",
    "risk_level": "confirm",
    "parameters": {
        "type": "object",
        "properties": {
            "action": {"type": "string", "enum": ["validate_pipeline_spec", "generate_glue_runner_py", "generate_glue_config_json"]},
        },
        "required": ["action"],
    },
}

def _run_cmd(cmd: list[str], cwd: str = None) -> str:
    """Helper function to run shell commands."""
    result = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True, check=True)
    return result.stdout

def validate_pipeline_spec(steps: list[dict]) -> dict:
    """Validate the pipeline specification."""
    if not isinstance(steps, list):
        return {"ok": False, "error": "Steps must be a list of dictionaries."}
    for step in steps:
        if not isinstance(step, dict) or "command" not in step:
            return {"ok": False, "error": "Each step must be a dictionary with a 'command' key."}
    return {"ok": True}

def generate_glue_runner_py(app_name: str, steps: list[dict], output_path: str = 'run_glue.py', dry_run: bool = True) -> dict:
    """Generate a Python glue runner script."""
    if dry_run:
        return {"ok": True, "message": "Dry run complete. No file generated."}
    
    script_content = f"# Generated glue runner script for {app_name}\n\n"
    script_content += "import subprocess\n\n"
    script_content += "def run_steps():\n"
    for step in steps:
        script_content += f"    _run_cmd({step['command']})\n"
    script_content += "\nif __name__ == '__main__':\n    run_steps()\n"
    
    with open(output_path, 'w') as f:
        f.write(script_content)
    
    return {"ok": True, "message": f"Script generated at {output_path}"}

def generate_glue_config_json(app_name: str, steps: list[dict]) -> dict:
    """Generate a JSON pipeline configuration."""
    config = {
        "app_name": app_name,
        "steps": steps
    }
    config_json = json.dumps(config, indent=4)
    return {"ok": True, "config": config_json}

def execute(action: str, **kwargs) -> dict:
    """Execute the specified action."""
    if action not in TOOL_SCHEMA["parameters"]["properties"]["action"]["enum"]:
        return {"ok": False, "error": f"Unknown action: {action}"}
    
    if action == "validate_pipeline_spec":
        return validate_pipeline_spec(kwargs.get("steps", []))
    elif action == "generate_glue_runner_py":
        return generate_glue_runner_py(
            kwargs.get("app_name", "default_app"),
            kwargs.get("steps", []),
            kwargs.get("output_path", "run_glue.py"),
            kwargs.get("dry_run", True)
        )
    elif action == "generate_glue_config_json":
        return generate_glue_config_json(
            kwargs.get("app_name", "default_app"),
            kwargs.get("steps", [])
        )
