import os
import time
import json
import csv
import io
import subprocess
import psutil
from typing import List, Dict, Optional

DUMP_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "dumps")
os.makedirs(DUMP_DIR, exist_ok=True)

class IncidentManager:
    def __init__(self):
        self.incidents: List[dict] = []

    def record_incident(self, incident: dict) -> dict:
        entry = {
            "id": f"inc-{int(time.time()*1000)}",
            "timestamp": time.time(),
            "time_str": time.strftime("%Y-%m-%d %H:%M:%S"),
            "proc_name": incident.get("proc_name", "System"),
            "pid": incident.get("pid"),
            "severity": incident.get("severity", "CRITICAL"),
            "metric": incident.get("metric", "CPU/RAM Breach"),
            "threshold": incident.get("threshold"),
            "action_taken": incident.get("action_taken", "Intervention Executed"),
            "status": incident.get("status", "RESOLVED"),
            "screenshot_path": incident.get("screenshot_path"),
            "dump_path": incident.get("dump_path")
        }
        self.incidents.append(entry)
        if len(self.incidents) > 200:
            self.incidents.pop(0)
        return entry

    def get_incidents(self, limit: int = 50, severity: Optional[str] = None) -> List[dict]:
        res = list(reversed(self.incidents))
        if severity:
            res = [r for r in res if r["severity"].lower() == severity.lower()]
        return res[:limit]

    def export_csv(self) -> str:
        output = io.StringIO()
        fieldnames = ["id", "time_str", "proc_name", "pid", "severity", "metric", "threshold", "action_taken", "status"]
        writer = csv.DictWriter(output, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        for inc in self.incidents:
            writer.writerow(inc)
        return output.getvalue()

    def export_json(self) -> List[dict]:
        return self.incidents

    def capture_screenshot(self, prefix: str = "incident") -> dict:
        """
        Chụp ảnh màn hình Desktop bằng PowerShell .NET và lưu vào thư mục dumps.
        """
        filename = f"{prefix}-{int(time.time()*1000)}.png"
        filepath = os.path.abspath(os.path.join(DUMP_DIR, filename))
        ps_code = f"""
Add-Type -AssemblyName System.Windows.Forms,System.Drawing
$bounds = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
$bmp = New-Object System.Drawing.Bitmap $bounds.Width, $bounds.Height
$graphics = [System.Drawing.Graphics]::FromImage($bmp)
$graphics.CopyFromScreen($bounds.Location, [System.Drawing.Point]::Empty, $bounds.Size)
$bmp.Save('{filepath.replace(os.sep, "/")}')
$graphics.Dispose()
$bmp.Dispose()
"""
        try:
            subprocess.run(["powershell", "-NoProfile", "-Command", ps_code], capture_output=True, timeout=5)
            if os.path.exists(filepath):
                return {"status": "captured", "filename": filename, "filepath": filepath, "size": os.path.getsize(filepath)}
            return {"status": "error", "reason": "Screenshot file was not generated"}
        except Exception as e:
            return {"status": "error", "reason": str(e)}

    def dump_process_tree(self, pid: Optional[int] = None, metadata: Optional[dict] = None) -> dict:
        """
        Lưu snapshot toàn bộ cây tiến trình, ports và trạng thái vào file JSON.
        """
        filename = f"dump-{int(time.time()*1000)}.json"
        filepath = os.path.abspath(os.path.join(DUMP_DIR, filename))
        dump_data = {
            "timestamp": time.time(),
            "time_str": time.strftime("%Y-%m-%d %H:%M:%S"),
            "target_pid": pid,
            "metadata": metadata or {},
            "processes": []
        }

        attrs = ['pid', 'name', 'status', 'cpu_percent', 'memory_info', 'num_threads']
        for proc in psutil.process_iter(attrs=attrs):
            try:
                info = proc.info
                mem_rss = getattr(info.get('memory_info'), 'rss', 0)
                dump_data["processes"].append({
                    "pid": info['pid'],
                    "name": info['name'],
                    "status": info['status'],
                    "cpu_percent": info['cpu_percent'],
                    "memory_mb": round(mem_rss / (1024**2), 1),
                    "threads": info['num_threads']
                })
            except Exception:
                continue

        try:
            with open(filepath, "w", encoding="utf-8") as f:
                json.dump(dump_data, f, indent=2)
            return {"status": "dumped", "filename": filename, "filepath": filepath, "total_processes": len(dump_data["processes"])}
        except Exception as e:
            return {"status": "error", "reason": str(e)}

incident_manager = IncidentManager()

