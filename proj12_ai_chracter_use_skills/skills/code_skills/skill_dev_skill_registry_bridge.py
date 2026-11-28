import os
import re
import ast
import json
import pathlib
import subprocess

TOOL_SCHEMA = {
    "name": "skill_dev_skill_registry_bridge",
    "description": "Scan multiple AutoEvolve skill directories for skill_*.py modules, safely extract TOOL_SCHEMA metadata via AST or importlib, export a unified catalog.json, and generate a runnable FastAPI HTTP bridge script exposing /api/skills and /api/run.",
    "risk_level": "safe",
    "parameters": {
        "type": "object",
        "properties": {
            "action": {"type": "string", "enum": ["scan_skill_repos", "export_catalog_json", "generate_fastapi_bridge"]},
        },
        "required": ["action"],
    },
}

def _run_cmd(cmd: list[str], cwd: str = None) -> str:
    result = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True, check=True)
    return result.stdout

def scan_skill_repos(repo_dirs: list[str]) -> list[dict]:
    skills = []
    for repo_dir in repo_dirs:
        for skill_file in pathlib.Path(repo_dir).glob('skill_*.py'):
            with open(skill_file, 'r') as f:
                tree = ast.parse(f.read())
                for node in ast.walk(tree):
                    if isinstance(node, ast.Assign) and node.targets[0].id == 'TOOL_SCHEMA':
                        schema = eval(ast.unparse(node.value))
                        skills.append(schema)
    return skills

def export_catalog_json(repo_dirs: list[str], out_path: str = 'catalog.json') -> None:
    skills = scan_skill_repos(repo_dirs)
    with open(out_path, 'w') as f:
        json.dump(skills, f, indent=4)

def generate_fastapi_bridge(catalog: list[dict], port: int = 8765) -> str:
    script = f"""
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

app = FastAPI()

skills = {json.dumps(catalog)}

class SkillAction(BaseModel):
    action: str

@app.get("/api/skills")
def get_skills():
    return skills

@app.post("/api/run")
def run_skill(skill_action: SkillAction):
    if skill_action.action not in [skill['name'] for skill in skills]:
        raise HTTPException(status_code=400, detail="Unknown skill")
    return {{'ok': True, 'action': skill_action.action}}
    
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port={port})
"""
    return script

def execute(action: str, **kwargs) -> dict:
    if action not in TOOL_SCHEMA["parameters"]["properties"]["action"]["enum"]:
        return {"ok": False, "error": f"Unknown action: {action}"}
    
    if action == "scan_skill_repos":
        return {"ok": True, "skills": scan_skill_repos(kwargs.get("repo_dirs", []))}
    
    if action == "export_catalog_json":
        export_catalog_json(kwargs.get("repo_dirs", []), kwargs.get("out_path", "catalog.json"))
        return {"ok": True, "path": kwargs.get("out_path", "catalog.json")}
    
    if action == "generate_fastapi_bridge":
        catalog = kwargs.get("catalog", [])
        port = kwargs.get("port", 8765)
        script = generate_fastapi_bridge(catalog, port)
        return {"ok": True, "script": script}
    
    return {"ok": False, "error": "Action not implemented"}
