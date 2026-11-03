from app.modules.service_manager.os_process import process_manager
from app.schemas.process_schema import ProcessActionType

def execute_node_action(node_data: dict) -> dict:
    """
    Ví dụ node_data từ React Flow:
    {"action_type": "kill_pid", "pid": 1234}
    hoặc {"action_type": "spawn_command", "command": "python worker.py"}
    """
    action_type = node_data.get("action_type")

    if action_type == "kill_pid":
        pid = int(node_data["pid"])
        return process_manager.control_process(pid, ProcessActionType.KILL)

    if action_type == "spawn_command":
        cmd = node_data["command"]
        cwd = node_data.get("cwd")
        return process_manager.spawn_managed_service(cmd, cwd)

    return {"status": "noop", "reason": f"Unknown action_type: {action_type}"}