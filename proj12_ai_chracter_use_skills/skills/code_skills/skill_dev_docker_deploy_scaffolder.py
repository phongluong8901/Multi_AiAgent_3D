import os
import pathlib
import shutil

TOOL_SCHEMA = {
    "name": "skill_dev_docker_deploy_scaffolder",
    "description": "Tạo Dockerfile docker-compose.yml và .dockerignore cho app Python Node.js Rust để triển khai lên server Linux hoặc Orange Pi. Generate production-ready Dockerfile (Python slim, Node alpine, or multi-stage Rust), standard `.dockerignore`, and `docker-compose.yml` files for shipping DevForge mini-apps to Linux/ARM hosts (dry_run=True default).",
    "risk_level": "confirm",
    "parameters": {
        "type": "object",
        "properties": {
            "action": {"type": "string", "enum": ["generate_dockerfile", "generate_compose_yml", "scaffold_docker_files"]},
        },
        "required": ["action"],
    },
}

DOCKERFILE_TEMPLATES = {
    "python": """# Use an official Python runtime as a parent image
FROM python:3.9-slim

# Set the working directory in the container
WORKDIR /app

# Copy the current directory contents into the container at /app
COPY . /app

# Install any needed packages specified in requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Make port 8000 available to the world outside this container
EXPOSE {port}

# Define environment variable
ENV NAME World

# Run app.py when the container launches
CMD ["python", "{entry}"]
""",
    "node": """# Use an official Node runtime as a parent image
FROM node:14-alpine

# Set the working directory in the container
WORKDIR /app

# Copy the current directory contents into the container at /app
COPY . /app

# Install any needed packages specified in package.json
RUN npm install

# Make port 8000 available to the world outside this container
EXPOSE {port}

# Run app.js when the container launches
CMD ["node", "{entry}"]
""",
    "rust": """# Use the official Rust image to create a build artifact.
FROM rust:latest AS builder
WORKDIR /usr/src/myapp
COPY . .
RUN cargo build --release

# Use a minimal base image to package the build artifact.
FROM debian:buster-slim
WORKDIR /usr/src/myapp
COPY --from=builder /usr/src/myapp/target/release/{entry} .

# Make port 8000 available to the world outside this container
EXPOSE {port}

# Run the binary.
CMD ["./{entry}"]
"""
}

DOCKERIGNORE_TEMPLATE = """# Byte-compiled / optimized / DLL files
__pycache__/
*.py[cod]
*$py.class

# Distribution / packaging
.Python
build/
develop-eggs/
dist/
downloads/
eggs/
.eggs/
lib/
lib64/
parts/
sdist/
var/
wheels/
*.egg-info/
.installed.cfg
*.egg

# PyInstaller
#  Usually these files are written by a python script from a template
#  before PyInstaller builds the exe, so as to inject date/other infos into it.
*.manifest
*.spec

# Installer logs
pip-log.txt
pip-delete-this-directory.txt

# Unit test / coverage reports
htmlcov/
.tox/
.nox/
.coverage
.coverage.*
.cache
nosetests.xml
coverage.xml
*.cover
.hypothesis/
.pytest_cache/

# Translations
*.mo
*.pot

# Django stuff:
*.log
db.sqlite3
db.sqlite3-journal

# Flask stuff:
instance/
.webassets-cache

# Scrapy stuff:
.scrapy

# Sphinx documentation
docs/_build/

# PyBuilder
target/

# Jupyter Notebook
.ipynb_checkpoints

# IPython
profile_default/
ipython_config.py

# pyenv
.python-version

# celery beat schedule file
celerybeat-schedule

# SageMath parsed files
*.sage.py

# Environments
.env
.venv
env/
venv/
ENV/
env.bak/
venv.bak/

# Spyder project settings
.spyderproject
.spyproject

# Rope project settings
.ropeproject

# mkdocs documentation
/site

# mypy
.mypy_cache/

# Sublime Text
*.sublime-project
*.sublime-workspace

# VSCode
.vscode/

# JetBrains
.idea/
*.iml
*.ipr
*.iws

# NetBeans
nbproject/private/
build/
nbbuild/
dist/
nbdist/
.nb-gradle/
"""

DOCKER_COMPOSE_TEMPLATE = """version: '3.8'

services:
  {service_name}:
    build: .
    ports:
      - "{port}:{port}"
    environment:
      - PORT={port}
    env_file:
      - {env_file}
"""

def _run_cmd(cmd: list[str], cwd: str = None):
    # Placeholder for running shell commands
    pass

def generate_dockerfile(lang: str = 'python', entry: str = 'main.py', port: int = 8000, dry_run: bool = True) -> str:
    if lang not in DOCKERFILE_TEMPLATES:
        return f"Unsupported language: {lang}"
    dockerfile_content = DOCKERFILE_TEMPLATES[lang].format(entry=entry, port=port)
    if not dry_run:
        with open('Dockerfile', 'w') as f:
            f.write(dockerfile_content)
    return dockerfile_content

def generate_compose_yml(service_name: str, port: int = 8000, env_file: str = '.env', dry_run: bool = True) -> str:
    compose_content = DOCKER_COMPOSE_TEMPLATE.format(service_name=service_name, port=port, env_file=env_file)
    if not dry_run:
        with open('docker-compose.yml', 'w') as f:
            f.write(compose_content)
    return compose_content

def scaffold_docker_files(project_dir: str, lang: str = 'python', service_name: str = 'app', port: int = 8000, dry_run: bool = True) -> dict:
    project_path = pathlib.Path(project_dir)
    if not project_path.exists():
        if not dry_run:
            project_path.mkdir(parents=True, exist_ok=True)
    dockerfile_content = generate_dockerfile(lang, entry='main.py', port=port, dry_run=dry_run)
    compose_content = generate_compose_yml(service_name, port=port, env_file='.env', dry_run=dry_run)
    dockerignore_content = DOCKERIGNORE_TEMPLATE
    if not dry_run:
        with open(project_path / 'Dockerfile', 'w') as f:
            f.write(dockerfile_content)
        with open(project_path / 'docker-compose.yml', 'w') as f:
            f.write(compose_content)
        with open(project_path / '.dockerignore', 'w') as f:
            f.write(dockerignore_content)
    return {
        "dockerfile": dockerfile_content,
        "docker_compose": compose_content,
        "dockerignore": dockerignore_content
    }

def execute(action: str = "generate_dockerfile", **kwargs) -> dict:
    if action not in TOOL_SCHEMA["parameters"]["properties"]["action"]["enum"]:
        return {"ok": False, "error": f"Unknown action: {action}"}
    if action == "generate_dockerfile":
        return {"ok": True, "dockerfile": generate_dockerfile(**kwargs)}
    elif action == "generate_compose_yml":
        return {"ok": True, "docker_compose": generate_compose_yml(**kwargs)}
    elif action == "scaffold_docker_files":
        return {"ok": True, "scaffolded_files": scaffold_docker_files(**kwargs)}
    return {"ok": False, "error": "Invalid action parameters"}
