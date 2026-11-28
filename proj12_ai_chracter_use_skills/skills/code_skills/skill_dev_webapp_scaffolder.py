import os
import shutil
import subprocess
import json
from pathlib import Path

TOOL_SCHEMA = {
    "name": "skill_dev_webapp_scaffolder",
    "description": "Scaffold lightweight local web apps (fastapi_htmx, static_spa, or node_express) into a target directory (dry_run=True default), list supported templates, and generate a clean single-file HTML/JS dashboard page wired to a local API base URL.",
    "risk_level": "confirm",
    "parameters": {
        "type": "object",
        "properties": {
            "action": {"type": "string", "enum": ["list_web_templates", "scaffold_webapp", "generate_single_file_html"]},
        },
        "required": ["action"],
    },
}

def _run_cmd(cmd: list[str], cwd: str = None) -> str:
    result = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True, check=True)
    return result.stdout

def list_web_templates() -> list[str]:
    return ["fastapi_htmx", "static_spa", "node_express"]

def scaffold_webapp(project_dir: str, app_name: str, stack: str = 'fastapi_htmx', features: list[str] = None, dry_run: bool = True) -> dict:
    if stack not in list_web_templates():
        return {"ok": False, "error": f"Unsupported stack: {stack}"}
    
    full_path = Path(project_dir) / app_name
    if not dry_run:
        full_path.mkdir(parents=True, exist_ok=True)
    
    if stack == "fastapi_htmx":
        if not dry_run:
            (full_path / "main.py").write_text(f"from fastapi import FastAPI\napp = FastAPI()\n@app.get('/')\ndef read_root():\n    return {{'message': 'Hello World'}}")
            (full_path / "templates").mkdir(exist_ok=True)
            (full_path / "templates" / "index.html").write_text("<html><body><h1>Hello World</h1></body></html>")
        return {"ok": True, "message": f"Scaffolded {stack} app at {full_path}"}
    
    elif stack == "static_spa":
        if not dry_run:
            (full_path / "index.html").write_text("<html><body><h1>Hello World</h1></body></html>")
        return {"ok": True, "message": f"Scaffolded {stack} app at {full_path}"}
    
    elif stack == "node_express":
        if not dry_run:
            (full_path / "app.js").write_text("const express = require('express');\nconst app = express();\napp.get('/', (req, res) => res.send('Hello World'));\napp.listen(3000, () => console.log('Server running on port 3000'));")
            _run_cmd(["npm", "init", "-y"], cwd=str(full_path))
            _run_cmd(["npm", "install", "express"], cwd=str(full_path))
        return {"ok": True, "message": f"Scaffolded {stack} app at {full_path}"}
    
    return {"ok": False, "error": "Unknown stack"}

def generate_single_file_html(title: str, api_base: str = 'http://127.0.0.1:8765', panels: list[str] = None) -> str:
    panels_html = "\n".join(f"<div>{panel}</div>" for panel in panels) if panels else "<div>No panels provided</div>"
    html_content = f"""
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>{title}</title>
    </head>
    <body>
        <h1>{title}</h1>
        {panels_html}
        <script>
            async function fetchData() {{
                const response = await fetch('{api_base}/data');
                const data = await response.json();
                console.log(data);
            }}
            fetchData();
        </script>
    </body>
    </html>
    """
    return html_content

def execute(action: str = "list_web_templates", **kwargs) -> dict:
    if action not in TOOL_SCHEMA["parameters"]["properties"]["action"]["enum"]:
        return {"ok": False, "error": f"Unknown action: {action}"}
    
    if action == "list_web_templates":
        return {"ok": True, "templates": list_web_templates()}
    
    elif action == "scaffold_webapp":
        return scaffold_webapp(**kwargs)
    
    elif action == "generate_single_file_html":
        html_content = generate_single_file_html(**kwargs)
        return {"ok": True, "html_content": html_content}
    
    return {"ok": False, "error": "Unknown action"}
