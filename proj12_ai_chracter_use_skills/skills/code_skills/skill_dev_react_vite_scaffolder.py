import os
import json
import shutil
import subprocess
from pathlib import Path

TOOL_SCHEMA = {
    "name": "skill_dev_react_vite_scaffolder",
    "description": "Tạo khung ứng dụng Frontend hiện đại React Vite Tailwind CSS, sinh component React JSX và cấu hình vite.config.js cho web app nhiều màn hình. Scaffold modern React + Vite + Tailwind CSS frontend projects (`package.json`, `vite.config.js`, `index.html`, `src/App.jsx`, `src/api/client.js`) (dry_run=True default), generate reusable functional React components wired to an API endpoint, and generate Vite/Tailwind config texts.",
    "risk_level": "confirm",
    "parameters": {
        "type": "object",
        "properties": {
            "action": {"type": "string", "enum": ["scaffold_react_vite_app", "generate_react_component", "generate_vite_tailwind_configs"]},
        },
        "required": ["action"],
    },
}

def _run_cmd(cmd: list[str], cwd: str = None) -> str:
    result = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True, check=True)
    return result.stdout

def scaffold_react_vite_app(project_dir: str, app_name: str, pages: list[str] = None, api_base: str = 'http://127.0.0.1:8765', dry_run: bool = True) -> dict:
    project_path = Path(project_dir) / app_name
    if not dry_run:
        project_path.mkdir(parents=True, exist_ok=True)
        _run_cmd(['npm', 'create', 'vite@latest', app_name, '--template', 'react'], cwd=project_dir)
        _run_cmd(['npm', 'install', 'tailwindcss', 'postcss', 'autoprefixer'], cwd=str(project_path))
        _run_cmd(['npx', 'tailwindcss', 'init', '-p'], cwd=str(project_path))
    
    package_json_path = project_path / 'package.json'
    if not dry_run:
        package_json = json.loads(package_json_path.read_text())
        package_json['scripts']['dev'] = 'vite'
        package_json['scripts']['build'] = 'vite build'
        package_json['scripts']['serve'] = 'vite preview'
        package_json['dependencies']['axios'] = '^1.0.0'
        package_json_path.write_text(json.dumps(package_json, indent=2))
    else:
        package_json = {
            "name": app_name,
            "version": "0.0.0",
            "scripts": {
                "dev": "vite",
                "build": "vite build",
                "serve": "vite preview"
            },
            "dependencies": {
                "axios": "^1.0.0"
            }
        }
    
    vite_config_path = project_path / 'vite.config.js'
    vite_config_content = """
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
  },
})
"""
    if not dry_run:
        vite_config_path.write_text(vite_config_content)
    
    index_html_path = project_path / 'index.html'
    index_html_content = """
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Vite + React</title>
    <link href="/index.css" rel="stylesheet">
    <link href="/input.css" rel="stylesheet">
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
"""
    if not dry_run:
        index_html_path.write_text(index_html_content)
    
    main_jsx_path = project_path / 'src' / 'main.jsx'
    main_jsx_content = """
import React from 'react'
import ReactDOM from 'react-dom'
import App from './App'

ReactDOM.render(<App />, document.getElementById('root'))
"""
    if not dry_run:
        main_jsx_path.write_text(main_jsx_content)
    
    app_jsx_path = project_path / 'src' / 'App.jsx'
    app_jsx_content = """
import React from 'react'
import './App.css'

function App() {
  return (
    <div className="App">
      <h1>Welcome to {app_name}</h1>
    </div>
  )
}

export default App
""".replace('{app_name}', app_name)
    if not dry_run:
        app_jsx_path.write_text(app_jsx_content)
    
    api_client_js_path = project_path / 'src' / 'api' / 'client.js'
    api_client_js_content = """
import axios from 'axios'

const apiClient = axios.create({
  baseURL: '{api_base}',
  headers: {
    'Content-Type': 'application/json',
  },
})

export default apiClient
""".replace('{api_base}', api_base)
    if not dry_run:
        api_client_js_path.parent.mkdir(parents=True, exist_ok=True)
        api_client_js_path.write_text(api_client_js_content)
    
    tailwind_config_path = project_path / 'tailwind.config.js'
    tailwind_config_content = """
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
"""
    if not dry_run:
        tailwind_config_path.write_text(tailwind_config_content)
    
    index_css_path = project_path / 'index.css'
    index_css_content = """
@tailwind base;
@tailwind components;
@tailwind utilities;
"""
    if not dry_run:
        index_css_path.write_text(index_css_content)
    
    if pages:
        for page in pages:
            page_jsx_path = project_path / 'src' / f'{page}.jsx'
            page_jsx_content = """
import React from 'react'

function {PageName}() {{
  return (
    <div className="p-4">
      <h2>{PageName}</h2>
    </div>
  )
}}

export default {PageName}
""".replace('{PageName}', page.capitalize())
            if not dry_run:
                page_jsx_path.write_text(page_jsx_content)
    
    return {"ok": True, "message": "Scaffolded React Vite app successfully"}

def generate_react_component(component_name: str, props: list[str] = None, endpoint: str = '', dry_run: bool = True) -> dict:
    component_path = Path('src') / f'{component_name}.jsx'
    props_str = ', '.join(props) if props else ''
    props_destructured = ', '.join([f'{prop}' for prop in props]) if props else ''
    endpoint_content = f"""
  const response = await fetch('{endpoint}');
  const data = await response.json();
  console.log(data);
""" if endpoint else ''
    component_content = """
import React, {{ useState, useEffect }} from 'react'

function {ComponentName}({{ {props_destructured} }}) {{
  {endpoint_content}
  return (
    <div className="p-4">
      <h3>{ComponentName}</h3>
    </div>
  )
}}

export default {ComponentName}
""".replace('{ComponentName}', component_name.capitalize()).replace('{props_destructured}', props_destructured).replace('{endpoint_content}', endpoint_content)
    if not dry_run:
        component_path.parent.mkdir(parents=True, exist_ok=True)
        component_path.write_text(component_content)
    
    return {"ok": True, "message": "Generated React component successfully"}

def generate_vite_tailwind_configs(app_name: str, port: int = 5173, dry_run: bool = True) -> dict:
    vite_config_path = Path('vite.config.js')
    vite_config_content = """
import {{ defineConfig }} from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({{
  plugins: [react()],
  server: {{
    port: {port},
  }},
}})
""".replace('{port}', str(port))
    if not dry_run:
        vite_config_path.write_text(vite_config_content)
    
    tailwind_config_path = Path('tailwind.config.js')
    tailwind_config_content = """
/** @type {{import('tailwindcss').Config}} */
export default {{
  content: [
    './index.html',
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {{
    extend: {{}},
  }},
  plugins: [],
}}
"""
    if not dry_run:
        tailwind_config_path.write_text(tailwind_config_content)
    
    return {"ok": True, "message": "Generated Vite and Tailwind config successfully"}

def execute(action: str = "", **kwargs) -> dict:
    if action not in TOOL_SCHEMA["parameters"]["properties"]["action"]["enum"]:
        return {"ok": False, "error": f"Unknown action: {action}"}
    
    if action == "scaffold_react_vite_app":
        return scaffold_react_vite_app(**kwargs)
    elif action == "generate_react_component":
        return generate_react_component(**kwargs)
    elif action == "generate_vite_tailwind_configs":
        return generate_vite_tailwind_configs(**kwargs)
