import os
import pathlib
import subprocess

TOOL_SCHEMA = {
    "name": "skill_dev_rust_cli_scaffolder",
    "description": "Tạo nhanh tool Rust CLI siêu nhẹ chạy nhanh trên PC và Linux, sinh Cargo.toml và src/main.rs cho poller watcher. Scaffold compact Rust CLI projects (cli_poller, file_watcher, http_checker) with Cargo.toml and src/main.rs (dry_run=True default), generate valid Cargo.toml text, and generate starter main.rs code for each preset.",
    "risk_level": "confirm",
    "parameters": {
        "type": "object",
        "properties": {
            "action": {"type": "string", "enum": ["scaffold_rust_tool", "generate_cargo_toml", "generate_rust_main_rs"]},
            "project_dir": {"type": "string"},
            "crate_name": {"type": "string"},
            "preset": {"type": "string", "default": "cli_poller"},
            "features": {"type": "array", "items": {"type": "string"}, "default": []},
            "dry_run": {"type": "boolean", "default": True},
        },
        "required": ["action", "crate_name"],
    },
}

def _run_cmd(cmd: list[str], cwd: str = None) -> str:
    result = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True, check=True)
    return result.stdout

def generate_cargo_toml(crate_name: str, features: list[str] = None) -> str:
    features_str = ", ".join(features) if features else ""
    return f"""[package]
name = "{crate_name}"
version = "0.1.0"
edition = "2021"

[dependencies]
{features_str}
"""

def generate_rust_main_rs(crate_name: str, preset: str = 'cli_poller') -> str:
    if preset == 'cli_poller':
        return f"""fn main() {{
    println!("Hello, world! This is {crate_name} CLI poller.");
}}
"""
    elif preset == 'file_watcher':
        return f"""fn main() {{
    println!("Hello, world! This is {crate_name} file watcher.");
}}
"""
    elif preset == 'http_checker':
        return f"""fn main() {{
    println!("Hello, world! This is {crate_name} HTTP checker.");
}}
"""
    else:
        return f"""fn main() {{
    println!("Hello, world! This is {crate_name}.");
}}
"""

def scaffold_rust_tool(project_dir: str, crate_name: str, preset: str = 'cli_poller', dry_run: bool = True) -> dict:
    project_path = pathlib.Path(project_dir) / crate_name
    cargo_toml_content = generate_cargo_toml(crate_name)
    main_rs_content = generate_rust_main_rs(crate_name, preset)

    if not dry_run:
        project_path.mkdir(parents=True, exist_ok=True)
        (project_path / "src").mkdir(parents=True, exist_ok=True)
        (project_path / "Cargo.toml").write_text(cargo_toml_content)
        (project_path / "src" / "main.rs").write_text(main_rs_content)

    return {
        "ok": True,
        "project_path": str(project_path),
        "cargo_toml": cargo_toml_content,
        "main_rs": main_rs_content,
    }

def execute(action: str, **kwargs) -> dict:
    if action not in TOOL_SCHEMA["parameters"]["properties"]["action"]["enum"]:
        return {"ok": False, "error": f"Unknown action: {action}"}

    if action == "scaffold_rust_tool":
        return scaffold_rust_tool(**kwargs)
    elif action == "generate_cargo_toml":
        return {"ok": True, "cargo_toml": generate_cargo_toml(kwargs["crate_name"], kwargs.get("features", []))}
    elif action == "generate_rust_main_rs":
        return {"ok": True, "main_rs": generate_rust_main_rs(kwargs["crate_name"], kwargs.get("preset", "cli_poller"))}
    else:
        return {"ok": False, "error": "Invalid action"}
