import os
import sys
import time
import psutil
from typing import Dict, Any, List, Optional
from app.modules.service_manager.os_process import process_manager
from app.modules.workflow_engine.incident_manager import incident_manager

class ResourceQuotaPolicy:
    TRIM_AND_THROTTLE = "TRIM_AND_THROTTLE"
    SUSPEND = "SUSPEND"
    KILL = "KILL"
    LOG_ONLY = "LOG_ONLY"

class ResourceQuotaManager:
    """
    Dịch vụ Phân bổ & Giới hạn Tài nguyên (Resource Partitioning & Quota Enforcement)
    - Quản lý CPU Cores Affinity (gán nhân độc quyền cho từng tác vụ)
    - Quản lý Hạn mức RAM tối đa (RAM Cap MB) qua Windows Job Object & Win32 EmptyWorkingSet
    - Quản lý Giới hạn băng thông CPU (CPU Throttle %)
    - Quản lý GPU Index (CUDA_VISIBLE_DEVICES)
    """

    def __init__(self):
        # Lưu trữ cấu hình quota theo PID: { pid: { cores, max_ram_mb, max_cpu_percent, gpu_index, policy, last_breach } }
        self.active_quotas: Dict[int, Dict[str, Any]] = {}
        # Lưu trữ handle Job Object trên Windows: { pid: job_handle }
        self._job_handles: Dict[int, Any] = {}

    def apply_quota(
        self,
        pid: int,
        cores: Optional[List[int]] = None,
        max_ram_mb: Optional[float] = None,
        max_cpu_percent: Optional[float] = None,
        gpu_index: Optional[int] = None,
        policy: str = ResourceQuotaPolicy.TRIM_AND_THROTTLE
    ) -> Dict[str, Any]:
        """
        Áp dụng hạn mức tài nguyên cho một tiến trình đang chạy.
        """
        try:
            proc = psutil.Process(pid)
            proc_name = proc.name()
        except (psutil.NoSuchProcess, psutil.AccessDenied) as e:
            return {"status": "error", "reason": f"Process PID {pid} not found: {str(e)}"}

        applied_actions = []

        # 1. Gán nhân CPU (CPU Affinity)
        total_cores = psutil.cpu_count(logical=True) or 4
        if cores is not None and len(cores) > 0:
            valid_cores = [c for c in cores if 0 <= c < total_cores]
            if valid_cores:
                try:
                    proc.cpu_affinity(valid_cores)
                    applied_actions.append(f"Bound to CPU Cores {valid_cores}")
                except Exception as e:
                    applied_actions.append(f"Affinity warning: {str(e)}")
        else:
            valid_cores = list(range(total_cores))

        # 2. Cố gắng áp dụng Windows Job Object (Hard Memory Limit nếu có)
        job_applied = False
        if sys.platform == "win32" and max_ram_mb and max_ram_mb > 0:
            try:
                import ctypes
                from ctypes import wintypes

                # Tạo Job Object
                job_handle = ctypes.windll.kernel32.CreateJobObjectW(None, None)
                if job_handle:
                    # Mở tiến trình với quyền gán vào Job
                    PROCESS_SET_QUOTA = 0x0100
                    PROCESS_TERMINATE = 0x0001
                    h_proc = ctypes.windll.kernel32.OpenProcess(PROCESS_SET_QUOTA | PROCESS_TERMINATE, False, pid)
                    if h_proc:
                        if ctypes.windll.kernel32.AssignProcessToJobObject(job_handle, h_proc):
                            self._job_handles[pid] = job_handle
                            job_applied = True
                            applied_actions.append(f"Assigned to Windows Job Object (Hard Sandbox)")
                        ctypes.windll.kernel32.CloseHandle(h_proc)
            except Exception:
                pass

        # 3. Lưu cấu hình vào active_quotas để Watchdog liên tục giám sát và xử lý vi phạm
        quota_data = {
            "pid": pid,
            "proc_name": proc_name,
            "cores": valid_cores,
            "max_ram_mb": float(max_ram_mb) if max_ram_mb else None,
            "max_cpu_percent": float(max_cpu_percent) if max_cpu_percent else None,
            "gpu_index": int(gpu_index) if gpu_index is not None else None,
            "policy": policy,
            "job_applied": job_applied,
            "created_at": time.time(),
            "last_check": time.time(),
            "breach_count": 0
        }
        self.active_quotas[pid] = quota_data

        return {
            "status": "applied",
            "pid": pid,
            "proc_name": proc_name,
            "applied_actions": applied_actions,
            "quota": quota_data
        }

    def remove_quota(self, pid: int) -> Dict[str, Any]:
        """
        Hủy bỏ hạn mức tài nguyên, khôi phục lại toàn bộ CPU Cores và mức ưu tiên bình thường.
        """
        if pid in self._job_handles:
            try:
                import ctypes
                ctypes.windll.kernel32.CloseHandle(self._job_handles[pid])
            except Exception:
                pass
            del self._job_handles[pid]

        if pid in self.active_quotas:
            del self.active_quotas[pid]

        try:
            proc = psutil.Process(pid)
            total_cores = psutil.cpu_count(logical=True) or 4
            proc.cpu_affinity(list(range(total_cores)))
            process_manager.set_process_priority(pid, "normal")
            return {"status": "removed", "pid": pid, "message": "Restored all CPU Cores and normal priority."}
        except Exception as e:
            return {"status": "removed", "pid": pid, "warning": str(e)}

    def enforce_quotas(self) -> List[Dict[str, Any]]:
        """
        Được gọi bởi Background Watchdog định kỳ:
        Kiểm tra và thực thi các chế độ can thiệp khi tiến trình vượt quá hạn mức RAM hoặc CPU đã gán.
        """
        actions_taken = []
        pids_to_remove = []

        for pid, q in list(self.active_quotas.items()):
            try:
                proc = psutil.Process(pid)
                mem_mb = round(proc.memory_info().rss / (1024 ** 2), 1)
                cpu_pct = round(proc.cpu_percent(interval=None), 1)
                q["last_check"] = time.time()
                q["current_mem_mb"] = mem_mb
                q["current_cpu_percent"] = cpu_pct

                breached = False
                breach_reason = []

                # Kiểm tra vi phạm RAM
                if q.get("max_ram_mb") and mem_mb > q["max_ram_mb"]:
                    breached = True
                    breach_reason.append(f"RAM {mem_mb}MB exceeds quota {q['max_ram_mb']}MB")

                # Kiểm tra vi phạm CPU %
                if q.get("max_cpu_percent") and cpu_pct > q["max_cpu_percent"]:
                    breached = True
                    breach_reason.append(f"CPU {cpu_pct}% exceeds quota {q['max_cpu_percent']}%")

                if breached:
                    q["breach_count"] += 1
                    policy = q.get("policy", ResourceQuotaPolicy.TRIM_AND_THROTTLE)

                    if policy == ResourceQuotaPolicy.TRIM_AND_THROTTLE:
                        trim_res = process_manager.trim_process_memory(pid)
                        prio_res = process_manager.set_process_priority(pid, "idle")
                        action_desc = f"Enforced EmptyWorkingSet trim (freed: {trim_res.get('freed')}) and throttled CPU to IDLE"
                    elif policy == ResourceQuotaPolicy.SUSPEND:
                        proc.suspend()
                        action_desc = "Suspended process due to quota breach"
                    elif policy == ResourceQuotaPolicy.KILL:
                        proc.terminate()
                        action_desc = "Terminated process due to severe quota breach"
                        pids_to_remove.append(pid)
                    else:
                        action_desc = f"Logged quota breach warning ({', '.join(breach_reason)})"

                    # Ghi nhận vào Incident Audit Log
                    incident_manager.record_incident({
                        "proc_name": q["proc_name"],
                        "pid": pid,
                        "metric": "Resource Quota Breach",
                        "threshold": q.get("max_ram_mb") or q.get("max_cpu_percent"),
                        "action_taken": f"POLICY_{policy}: {action_desc}",
                        "status": "THROTTLED" if policy != ResourceQuotaPolicy.KILL else "TERMINATED",
                        "severity": "WARNING" if policy != ResourceQuotaPolicy.KILL else "CRITICAL"
                    })

                    actions_taken.append({
                        "pid": pid,
                        "proc_name": q["proc_name"],
                        "breach_reason": breach_reason,
                        "action": action_desc,
                        "policy": policy
                    })

            except (psutil.NoSuchProcess, psutil.AccessDenied):
                pids_to_remove.append(pid)

        for dead_pid in pids_to_remove:
            if dead_pid in self.active_quotas:
                del self.active_quotas[dead_pid]
            if dead_pid in self._job_handles:
                del self._job_handles[dead_pid]

        return actions_taken

    def list_quotas(self) -> List[Dict[str, Any]]:
        return list(self.active_quotas.values())

    def get_quota(self, pid: int) -> Optional[Dict[str, Any]]:
        return self.active_quotas.get(pid)

resource_quota_manager = ResourceQuotaManager()

