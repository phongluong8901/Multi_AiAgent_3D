"""
Module Incident Manager & Forensic Snapshot:
Quản lý nhật ký sự cố vi phạm tài nguyên, ghi nhận lịch sử can thiệp,
chụp ảnh bằng chứng màn hình hệ thống và tạo tệp kết xuất (dump) trạng thái tiến trình.
"""

import os
import time
import json
import csv
import io
import subprocess
import psutil
from typing import List, Dict, Optional

# Thư mục lưu trữ các bản snapshot, ảnh chụp màn hình và dump dữ liệu sự cố
DUMP_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "dumps")
os.makedirs(DUMP_DIR, exist_ok=True)

class IncidentManager:
    """
    Trình quản lý sự cố và kiểm toán an toàn hệ thống (Audit Trail).
    Lưu giữ vòng lặp 200 sự cố gần nhất trong bộ nhớ và hỗ trợ xuất báo cáo CSV/JSON.
    """

    def __init__(self):
        """Khởi tạo danh sách lưu trữ sự cố trong bộ nhớ tạm."""
        self.incidents: List[dict] = []

    def record_incident(self, incident: dict) -> dict:
        """
        Ghi nhận một bản ghi sự cố mới vào hệ thống kiểm toán.

        Tham số:
            incident (dict): Dữ liệu chi tiết về sự cố (tên tiến trình, PID, mức độ nghiêm trọng, hành động đã thực hiện).

        Trả về:
            dict: Bản ghi sự cố hoàn chỉnh kèm mã định danh duy nhất (inc-ID) và dấu thời gian.
        """
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

        # Giới hạn bộ đệm tối đa 200 bản ghi để tránh phình to bộ nhớ
        if len(self.incidents) > 200:
            self.incidents.pop(0)
        return entry

    def get_incidents(self, limit: int = 50, severity: Optional[str] = None) -> List[dict]:
        """
        Truy vấn danh sách sự cố đã xảy ra theo thứ tự thời gian mới nhất trước.

        Tham số:
            limit (int): Số lượng bản ghi tối đa trả về.
            severity (Optional[str]): Bộ lọc theo mức độ nghiêm trọng (CRITICAL, WARN, INFO).

        Trả về:
            List[dict]: Danh sách sự cố phù hợp.
        """
        res = list(reversed(self.incidents))
        if severity:
            res = [r for r in res if r["severity"].lower() == severity.lower()]
        return res[:limit]

    def export_csv(self) -> str:
        """
        Xuất toàn bộ lịch sử sự cố thành chuỗi định dạng CSV phục vụ xuất báo cáo kiểm toán.

        Trả về:
            str: Nội dung file CSV dưới dạng chuỗi UTF-8.
        """
        output = io.StringIO()
        fieldnames = ["id", "time_str", "proc_name", "pid", "severity", "metric", "threshold", "action_taken", "status"]
        writer = csv.DictWriter(output, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        for inc in self.incidents:
            writer.writerow(inc)
        return output.getvalue()

    def export_json(self) -> List[dict]:
        """
        Xuất danh sách sự cố dạng danh sách đối tượng JSON thuần.

        Trả về:
            List[dict]: Toàn bộ mảng sự cố.
        """
        return self.incidents

    def capture_screenshot(self, prefix: str = "incident") -> dict:
        """
        Chụp ảnh màn hình Desktop bằng thư viện .NET (System.Drawing) thông qua PowerShell
        và lưu trữ tại thư mục dumps phục vụ phân tích nguyên nhân gốc (forensics).

        Tham số:
            prefix (str): Tiền tố đặt tên tệp ảnh chụp (mặc định 'incident').

        Trả về:
            dict: Trạng thái tệp ảnh đã chụp hoặc thông báo lỗi.
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
        Lưu vết toàn bộ cây tiến trình, số luồng và tài nguyên đang hoạt động vào tệp JSON
        ngay tại thời điểm xảy ra sự cố.

        Tham số:
            pid (Optional[int]): PID của tiến trình trọng tâm gây lỗi (nếu có).
            metadata (Optional[dict]): Dữ liệu siêu thông tin bổ sung.

        Trả về:
            dict: Đường dẫn tệp dump JSON và số lượng tiến trình được lưu.
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

# Đối tượng Singleton quản lý sự cố dùng chung trong toàn bộ backend
incident_manager = IncidentManager()
