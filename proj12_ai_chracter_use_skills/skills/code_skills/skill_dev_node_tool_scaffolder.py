import os
import json
import pathlib
import shutil

TOOL_SCHEMA = {
    "name": "skill_dev_node_tool_scaffolder",
    "description": "Tạo nhanh tool Node.js Express web nhẹ, sinh package.json và bộ nạp biến môi trường .env JS",
    "risk_level": "confirm",
    "parameters": {
        "type": "object",
        "properties": {
            "action": {"type": "string", "enum": ["scaffold_node_tool", "generate_package_json", "generate_env_loader_js"]},
        },
        "required": ["action"],
    },
}

def _run_cmd(cmd: list[str], cwd: str = None) -> str:
    import subprocess
    result = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True)
    return result.stdout

def generate_package_json(app_name: str, deps: dict = None, scripts: dict = None) -> str:
    package_data = {
        "name": app_name,
        "version": "1.0.0",
        "description": "",
        "main": "index.js",
        "scripts": scripts or {},
        "dependencies": deps or {},
        "author": "",
        "license": "ISC"
    }
    return json.dumps(package_data, indent=2)

def generate_env_loader_js(required_keys: list[str]) -> str:
    env_loader = [
        "const dotenv = require('dotenv');",
        "dotenv.config();",
        "",
        "const requiredKeys = [{}];".format(', '.join(f'"{key}"' for key in required_keys)),
        "requiredKeys.forEach(key => {",
        "  if (!process.env[key]) {",
        "    throw new Error(`Missing environment variable: ${key}`);",
        "  }",
        "});"
    ]
    return '\n'.join(env_loader)

def scaffold_node_tool(project_dir: str, app_name: str, stack: str = 'express_js', port: int = 3000, dry_run: bool = True) -> dict:
    project_path = pathlib.Path(project_dir) / app_name
    if not dry_run:
        project_path.mkdir(parents=True, exist_ok=True)
    
    package_json_content = generate_package_json(app_name, scripts={"start": f"node index.js"})
    env_loader_content = generate_env_loader_js(["PORT"])

    if not dry_run:
        with open(project_path / "package.json", "w") as f:
            f.write(package_json_content)
        with open(project_path / ".env", "w") as f:
            f.write(f"PORT={port}")
        with open(project_path / "index.js", "w") as f:
            if stack == 'express_js':
                f.write("const express = require('express');\nconst app = express();\nconst port = process.env.PORT || 3000;\n\napp.get('/', (req, res) => {\n  res.send('Hello World!');\n});\n\napp.listen(port, () => {\n  console.log(`App listening at http://localhost:${port}`);\n});")
            elif stack == 'cli_js':
                f.write("console.log('CLI tool is running...');")
            elif stack == 'webhook_js':
                f.write("console.log('Webhook server is running...');")

    return {
        "ok": True,
        "project_path": str(project_path),
        "package_json": package_json_content,
        "env_loader_js": env_loader_content,
        "dry_run": dry_run
    }

def execute(action: str = "scaffold_node_tool", **kwargs) -> dict:
    if action not in TOOL_SCHEMA["parameters"]["properties"]["action"]["enum"]:
        return {"ok": False, "error": f"Unknown action: {action}"}
    
    if action == "scaffold_node_tool":
        return scaffold_node_tool(**kwargs)
    elif action == "generate_package_json":
        return {"ok": True, "package_json": generate_package_json(**kwargs)}
    elif action == "generate_env_loader_js":
        return {"ok": True, "env_loader_js": generate_env_loader_js(**kwargs)}
