import os
import json
import re
import pathlib

TOOL_SCHEMA = {
    "name": "skill_dev_spec_architect_planner",
    "description": "Generate and validate structured full-stack app architecture blueprints before coding: produce normalized JSON specs containing db_tables, api_endpoints, ui_views, and phased milestones, validate spec completeness, and export `spec.json` + `SPEC.md` (dry_run=True default). Thiết kế kiến trúc phần mềm trước khi code spec architect, sinh lược đồ database API endpoint màn hình UI và file SPEC.md cho Gemini Flash",
    "risk_level": "safe",
    "parameters": {
        "type": "object",
        "properties": {
            "action": {"type": "string", "enum": ["build_app_spec", "validate_app_spec", "export_spec_files"]},
        },
        "required": ["action"],
    },
}

def _run_cmd(cmd: list[str], cwd: str = None) -> str:
    import subprocess
    result = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True, check=True)
    return result.stdout

def _http_get(url: str, timeout: float = 3.0) -> str:
    import urllib.request
    with urllib.request.urlopen(url, timeout=timeout) as response:
        return response.read().decode('utf-8')

def build_app_spec(app_name: str, goal: str, features: list[str] = None, stack: str = 'fastapi_tailwind', dry_run: bool = True) -> dict:
    if features is None:
        features = []

    spec = {
        "app_name": app_name,
        "goal": goal,
        "features": features,
        "stack": stack,
        "db_tables": [],
        "api_endpoints": [],
        "ui_views": [],
        "milestones": []
    }

    # Placeholder logic to generate spec
    if stack == 'fastapi_tailwind':
        spec["db_tables"] = [{"name": "users", "fields": ["id", "name", "email"]}]
        spec["api_endpoints"] = [{"path": "/users", "method": "GET"}]
        spec["ui_views"] = [{"name": "UserList", "path": "/users"}]
        spec["milestones"] = ["Design database schema", "Implement API endpoints", "Build UI views"]

    if not dry_run:
        with open(f"{app_name}_spec.json", "w") as f:
            json.dump(spec, f, indent=4)

    return spec

def validate_app_spec(spec: dict) -> dict:
    required_keys = ["app_name", "db_tables", "api_endpoints", "ui_views"]
    issues = [key for key in required_keys if key not in spec]
    return {"ok": not issues, "issues": issues}

def export_spec_files(spec: dict, project_dir: str, dry_run: bool = True) -> dict:
    if not os.path.exists(project_dir):
        os.makedirs(project_dir)

    spec_json_path = os.path.join(project_dir, "spec.json")
    spec_md_path = os.path.join(project_dir, "SPEC.md")

    if not dry_run:
        with open(spec_json_path, "w") as f:
            json.dump(spec, f, indent=4)

        with open(spec_md_path, "w") as f:
            f.write(f"# {spec['app_name']} Specification\n")
            f.write(f"## Goal\n{spec['goal']}\n")
            f.write("## Features\n")
            for feature in spec.get("features", []):
                f.write(f"- {feature}\n")
            f.write("## Database Tables\n")
            for table in spec.get("db_tables", []):
                f.write(f"- {table['name']}: {', '.join(table['fields'])}\n")
            f.write("## API Endpoints\n")
            for endpoint in spec.get("api_endpoints", []):
                f.write(f"- {endpoint['method']} {endpoint['path']}\n")
            f.write("## UI Views\n")
            for view in spec.get("ui_views", []):
                f.write(f"- {view['name']} at {view['path']}\n")
            f.write("## Milestones\n")
            for milestone in spec.get("milestones", []):
                f.write(f"- {milestone}\n")

    return {"ok": True, "spec_json_path": spec_json_path, "spec_md_path": spec_md_path}

def execute(action: str = "build_app_spec", **kwargs) -> dict:
    if action not in TOOL_SCHEMA["parameters"]["properties"]["action"]["enum"]:
        return {"ok": False, "error": f"Unknown action: {action}"}

    if action == "build_app_spec":
        return build_app_spec(**kwargs)
    elif action == "validate_app_spec":
        return validate_app_spec(**kwargs)
    elif action == "export_spec_files":
        return export_spec_files(**kwargs)
