"""
Module thực thi hành động tự động hóa trong Workflow Engine (Actions Executor).
Bao gồm:
- Điều khiển tiến trình: Kill, Terminate, Suspend, Resume
- Tối ưu bộ nhớ: EmptyWorkingSet trim
- Điều chỉnh ưu tiên và gán lõi: Set Priority, CPU Affinity Cores
- Quản lý mạng: Release Port, Notify Webhook (Telegram, Discord, Slack)
- Tự động hóa Desktop: Chụp ảnh màn hình sự cố, Dump cây tiến trình, Mở trình duyệt tìm giải pháp, Mở thư mục, Mở Task Manager
- Áp đặt hạn mức: Resource Partitioning & Quota
- Cơ chế Cooldown tránh spam hành động (5 giây).
"""

import time
import os
import sys
import webbrowser
import urllib.parse
import subprocess
from app.modules.service_manager.os_process import process_manager
from app.modules.service_manager.resource_quota_manager import resource_quota_manager
from app.modules.workflow_engine.notifier import dispatch_notification
from app.modules.workflow_engine.incident_manager import incident_manager
from app.schemas.process_schema import ProcessActionType

# Bộ đệm thời gian cooldown theo PID hoặc loại hành động (giây): tránh lặp lại hành động trong 5s
_action_cooldowns: dict[str, float] = {}

def execute_node_action(node_data: dict) -> dict:
    """
    Thực thi hành động can thiệp tương ứng với cấu hình của một Action Node trên Canvas n8n.

    Args:
        node_data: Dictionary dữ liệu chứa action_type, PID, thông số cấu hình và cờ is_test.

    Returns:
        Dictionary chứa trạng thái kết quả thực thi và thông tin chi tiết.
    """
    action_type = node_data.get("action_type")
    raw_pid = node_data.get("pid")
    pid = int(raw_pid) if raw_pid is not None else None
    is_test = bool(node_data.get("is_test", False))
    proc_name = node_data.get("proc_name", "Target Process")
    metric = node_data.get("metric", "CPU/RAM Alert")

    now = time.time()
    cooldown_key = f"pid_{pid}" if pid is not None else f"action_{action_type}"

    # Bỏ qua thời gian cooldown nếu người dùng đang chủ động click 'Test Action' trên giao diện
    if not is_test:
        last_time = _action_cooldowns.get(cooldown_key, 0.0)
        if now - last_time < 5.0 and action_type in [
            "kill_pid", "terminate_pid", "suspend_pid", "resume_pid",
            "trim_memory", "set_priority", "set_affinity", "release_port",
            "open_browser", "search_google", "open_folder", "open_taskmgr",
            "send_notification", "notify_webhook", "capture_screen", "dump_incident"
        ]:
            return {
                "status": "cooldown",
                "key": cooldown_key,
                "action": action_type,
                "reason": f"Auto-Guard action '{action_type}' is in cooling down window (5s)"
            }

    res = {}

    # 1. Điều khiển tiến trình OS (Process Controls)
    if action_type in ["kill_pid", "kill"]:
        if pid is None:
            return {"status": "error", "reason": "PID required for kill"}
        res = process_manager.control_process(pid, ProcessActionType.KILL)

    elif action_type in ["terminate_pid", "terminate"]:
        if pid is None:
            return {"status": "error", "reason": "PID required for terminate"}
        res = process_manager.control_process(pid, ProcessActionType.TERMINATE)

    elif action_type in ["suspend_pid", "suspend"]:
        if pid is None:
            return {"status": "error", "reason": "PID required for suspend"}
        res = process_manager.control_process(pid, ProcessActionType.SUSPEND)

    elif action_type in ["resume_pid", "resume"]:
        if pid is None:
            return {"status": "error", "reason": "PID required for resume"}
        res = process_manager.control_process(pid, ProcessActionType.RESUME)

    # 2. Tối ưu hóa Bộ nhớ OS (Win32 EmptyWorkingSet)
    elif action_type in ["trim_memory", "empty_working_set"]:
        if pid is None:
            return {"status": "error", "reason": "PID required to trim working set memory"}
        res = process_manager.trim_process_memory(pid)

    # 3. Điều chỉnh CPU Priority
    elif action_type in ["set_priority", "lower_priority"]:
        if pid is None:
            return {"status": "error", "reason": "PID required to set CPU priority"}
        prio = node_data.get("priority", "idle")
        res = process_manager.set_process_priority(pid, prio)

    # 4. Gán CPU Affinity Cores
    elif action_type == "set_affinity":
        if pid is None:
            return {"status": "error", "reason": "PID required to set CPU affinity"}
        cores = node_data.get("cores", [0, 1])
        res = process_manager.set_process_affinity(pid, cores)

    # 5. Giải phóng Cổng Mạng (Release Port)
    elif action_type == "release_port":
        raw_port = node_data.get("port") or node_data.get("target_port")
        if not raw_port:
            return {"status": "error", "reason": "Port number required to release port"}
        res = process_manager.release_port(int(raw_port))

    # 6. Gửi Thông Báo Webhook (Telegram, Discord, Slack)
    elif action_type in ["send_notification", "notify_webhook"]:
        res = dispatch_notification(node_data)

    # 7. Chụp Ảnh Màn Hình Sự Cố (Incident Screen Capture)
    elif action_type in ["capture_screen", "screenshot"]:
        res = incident_manager.capture_screenshot(prefix=f"incident-{proc_name}")

    # 8. Trích Xuất Snapshot Cây Tiến Trình (Process Tree Dump)
    elif action_type in ["dump_incident", "process_dump"]:
        res = incident_manager.dump_process_tree(pid=pid, metadata=node_data)

    # 9. PC Automation: Mở Trình duyệt & Tự động tìm kiếm nguyên nhân lỗi
    elif action_type in ["open_browser", "search_google"]:
        query = node_data.get("search_query") or node_data.get("query")
        url = node_data.get("url")
        if not url:
            if not query:
                metric_name = node_data.get("metric", "High CPU Load")
                query = f"How to fix high {metric_name} {proc_name} Windows"
            url = f"https://www.google.com/search?q={urllib.parse.quote_plus(query)}"

        try:
            webbrowser.open(url)
            res = {"status": "executed", "action": "open_browser", "url": url, "query": query}
        except Exception as e:
            res = {"status": "error", "reason": str(e)}

    # 10. PC Automation: Mở Folder trong Windows Explorer
    elif action_type == "open_folder":
        folder_path = node_data.get("folder_path") or os.getcwd()
        try:
            if sys.platform == "win32":
                subprocess.Popen(["explorer.exe", folder_path])
            else:
                subprocess.Popen(["xdg-open", folder_path])
            res = {"status": "executed", "action": "open_folder", "folder_path": folder_path}
        except Exception as e:
            res = {"status": "error", "reason": str(e)}

    # 11. PC Automation: Mở Windows Task Manager
    elif action_type == "open_taskmgr":
        try:
            subprocess.Popen(["taskmgr.exe"])
            res = {"status": "executed", "action": "open_taskmgr"}
        except Exception as e:
            res = {"status": "error", "reason": str(e)}

    # 12. Chạy lệnh Shell / CLI Command
    elif action_type in ["spawn_command", "run_powershell"]:
        cmd = node_data.get("command", "")
        cwd = node_data.get("cwd")
        res = process_manager.spawn_managed_service(cmd, cwd)

    # 13. Phân bổ & Giới hạn Tài nguyên (Resource Partitioning & Quota)
    elif action_type in ["apply_quota", "resource_quota", "enforce_quota"]:
        if pid is None:
            return {"status": "error", "reason": "PID required to apply resource quota"}
        cores = node_data.get("cores")
        max_ram_mb = node_data.get("max_ram_mb")
        max_cpu_percent = node_data.get("max_cpu_percent")
        gpu_index = node_data.get("gpu_index")
        policy = node_data.get("policy", "TRIM_AND_THROTTLE")
        res = resource_quota_manager.apply_quota(
            pid=pid,
            cores=cores,
            max_ram_mb=max_ram_mb,
            max_cpu_percent=max_cpu_percent,
            gpu_index=gpu_index,
            policy=policy,
        )

    else:
        return {"status": "noop", "reason": f"Unknown action_type: {action_type}"}

    _action_cooldowns[cooldown_key] = now

    # Tự động ghi lại nhật ký sự cố nếu hành động can thiệp thành công
    if res.get("status") in ["executed", "trimmed", "priority_set", "released", "sent", "captured", "dumped", "applied"]:
        incident_manager.record_incident({
            "proc_name": proc_name,
            "pid": pid,
            "metric": metric,
            "threshold": node_data.get("threshold"),
            "action_taken": action_type,
            "status": "RESOLVED",
            "severity": "CRITICAL" if action_type in ["kill_pid", "terminate_pid"] else "WARNING",
            "screenshot_path": res.get("filepath") if action_type == "capture_screen" else None,
            "dump_path": res.get("filepath") if action_type == "dump_incident" else None
        })

    return res
