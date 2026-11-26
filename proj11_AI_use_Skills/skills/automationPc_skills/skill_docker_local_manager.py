import json
import subprocess
from typing import List, Dict, Any

TOOL_SCHEMA = {
    "name": "skill_docker_local_manager",
    "risk_level": "confirm",
    "description": "Quản lý Docker Desktop, liệt kê container image đang chạy, xem log container, khởi động dừng container. Manage Docker Desktop, list running container images, view container logs, start/stop containers.",
    "parameters": {
        "type": "object",
        "properties": {
            "action": {
                "type": "string",
                "enum": ["list_containers", "list_images", "container_logs", "control_container"]
            },
            "all_containers": {
                "type": "boolean",
                "default": True
            },
            "tail": {
                "type": "integer",
                "default": 50
            },
            "container": {
                "type": "string"
            },
            "op": {
                "type": "string",
                "enum": ["start", "stop", "restart"],
                "default": "restart"
            },
            "dry_run": {
                "type": "boolean",
                "default": True
            }
        },
        "required": ["action"]
    }
}

def execute(action: str = "list_containers", **kwargs) -> Dict[str, Any]:
    try:
        if action == "list_containers":
            return list_containers(all_containers=kwargs.get("all_containers", True))
        elif action == "list_images":
            return list_images()
        elif action == "container_logs":
            container = kwargs.get("container")
            tail = kwargs.get("tail", 50)
            if not container:
                return {"ok": False, "error": "Container name is required for container_logs"}
            return container_logs(container, tail)
        elif action == "control_container":
            container = kwargs.get("container")
            op = kwargs.get("op", "restart")
            dry_run = kwargs.get("dry_run", True)
            if not container:
                return {"ok": False, "error": "Container name is required for control_container"}
            return control_container(container, op, dry_run)
        else:
            return {"ok": False, "error": f"Unknown action: {action}"}
    except Exception as e:
        return {"ok": False, "error": str(e)}

def list_containers(all_containers: bool = True) -> Dict[str, Any]:
    try:
        import subprocess
        cmd = ["docker", "ps", "-a"] if all_containers else ["docker", "ps"]
        result = subprocess.run(cmd, capture_output=True, text=True, check=True)
        return {"ok": True, "data": result.stdout}
    except ImportError:
        return {"ok": False, "error": "Missing package subprocess"}
    except subprocess.CalledProcessError as e:
        return {"ok": False, "error": e.stderr}

def list_images() -> Dict[str, Any]:
    try:
        import subprocess
        result = subprocess.run(["docker", "images"], capture_output=True, text=True, check=True)
        return {"ok": True, "data": result.stdout}
    except ImportError:
        return {"ok": False, "error": "Missing package subprocess"}
    except subprocess.CalledProcessError as e:
        return {"ok": False, "error": e.stderr}

def container_logs(container: str, tail: int = 50) -> Dict[str, Any]:
    try:
        import subprocess
        result = subprocess.run(["docker", "logs", "--tail", str(tail), container], capture_output=True, text=True, check=True)
        return {"ok": True, "data": result.stdout}
    except ImportError:
        return {"ok": False, "error": "Missing package subprocess"}
    except subprocess.CalledProcessError as e:
        return {"ok": False, "error": e.stderr}

def control_container(container: str, op: str = "restart", dry_run: bool = True) -> Dict[str, Any]:
    try:
        import subprocess
        if dry_run:
            return {"ok": True, "data": f"Preview: docker {op} {container}"}
        result = subprocess.run(["docker", op, container], capture_output=True, text=True, check=True)
        return {"ok": True, "data": result.stdout}
    except ImportError:
        return {"ok": False, "error": "Missing package subprocess"}
    except subprocess.CalledProcessError as e:
        return {"ok": False, "error": e.stderr}
