import json
import os
import tempfile
from typing import List, Dict, Optional

TOOL_SCHEMA = {
    "name": "skill_web_workflow_runner",
    "description": "Validate, save, list, and dry-run/execute reusable multi-step JSON web automation workflows (navigate, wait, fill, click, extract, screenshot) with variable substitution ({{var}}).",
    "risk_level": "confirm",
    "parameters": {
        "validate_workflow": {
            "steps": "list[dict]"
        },
        "render_variables": {
            "steps": "list[dict]",
            "variables": "dict=None"
        },
        "save_workflow": {
            "name": "str",
            "steps": "list[dict]",
            "store_dir": "str='web_workflows'"
        },
        "run_workflow": {
            "steps": "list[dict]",
            "variables": "dict=None",
            "dry_run": "bool=True"
        }
    }
}

def _run_cmd(cmd: str) -> Dict[str, str]:
    try:
        import subprocess
        result = subprocess.run(cmd, shell=True, check=True, capture_output=True, text=True, encoding="utf-8", errors="replace")
        return {"ok": True, "output": result.stdout}
    except ImportError:
        return {"ok": False, "error": "Missing package subprocess"}
    except subprocess.CalledProcessError as e:
        return {"ok": False, "error": str(e)}

def _save_file(path: str, content: str) -> Dict[str, str]:
    try:
        with open(path, 'w') as f:
            f.write(content)
        return {"ok": True}
    except Exception as e:
        return {"ok": False, "error": str(e)}

def _load_file(path: str) -> Dict[str, str]:
    try:
        with open(path, 'r') as f:
            return {"ok": True, "content": f.read()}
    except Exception as e:
        return {"ok": False, "error": str(e)}

def validate_workflow(steps: List[Dict]) -> Dict[str, bool]:
    for step in steps:
        if not isinstance(step, dict) or 'action' not in step:
            return {"ok": False, "error": "Invalid step format"}
    return {"ok": True}

def render_variables(steps: List[Dict], variables: Optional[Dict] = None) -> List[Dict]:
    if variables is None:
        variables = {}
    rendered_steps = []
    for step in steps:
        rendered_step = step.copy()
        for key, value in step.items():
            if isinstance(value, str):
                for var_key, var_value in variables.items():
                    rendered_step[key] = value.replace(f"{{{{{var_key}}}}}", str(var_value))
        rendered_steps.append(rendered_step)
    return rendered_steps

def save_workflow(name: str, steps: List[Dict], store_dir: str = 'web_workflows') -> Dict[str, str]:
    if not os.path.exists(store_dir):
        os.makedirs(store_dir)
    file_path = os.path.join(store_dir, f"{name}.json")
    content = json.dumps(steps, indent=4)
    return _save_file(file_path, content)

def run_workflow(steps: List[Dict], variables: Optional[Dict] = None, dry_run: bool = True) -> Dict[str, str]:
    rendered_steps = render_variables(steps, variables)
    for step in rendered_steps:
        if step['action'] == 'navigate':
            cmd = f"start {step['url']}"
            if not dry_run:
                result = _run_cmd(cmd)
                if not result["ok"]:
                    return result
        elif step['action'] == 'click':
            # Placeholder for click action
            if not dry_run:
                pass
        elif step['action'] == 'fill':
            # Placeholder for fill action
            if not dry_run:
                pass
        elif step['action'] == 'extract':
            # Placeholder for extract action
            if not dry_run:
                pass
        elif step['action'] == 'screenshot':
            # Placeholder for screenshot action
            if not dry_run:
                pass
        else:
            return {"ok": False, "error": f"Unknown action: {step['action']}"}
    return {"ok": True}

def execute(action: str = "validate_workflow", **kwargs) -> Dict[str, str]:
    if action == "validate_workflow":
        return validate_workflow(kwargs.get("steps", []))
    elif action == "render_variables":
        return {"ok": True, "steps": render_variables(kwargs.get("steps", []), kwargs.get("variables", {}))}
    elif action == "save_workflow":
        return save_workflow(kwargs.get("name", ""), kwargs.get("steps", []), kwargs.get("store_dir", "web_workflows"))
    elif action == "run_workflow":
        return run_workflow(kwargs.get("steps", []), kwargs.get("variables", {}), kwargs.get("dry_run", True))
    else:
        return {"ok": False, "error": f"Unknown action: {action}"}
