"""
Module đánh giá sức khỏe và đề xuất tối ưu hóa hệ thống (Health Advisor).
Phân tích ảnh chụp snapshot (CPU, RAM, GPU, tiến trình ngốn tài nguyên) để tính điểm sức khỏe
và tạo khuyến nghị xử lý tự động (Hạ priority, Trim memory, Suspend, Gán CPU affinity).
"""

from typing import Dict, Any, List
from app.schemas.telemetry_schema import SystemSnapshot

def calculate_health_and_recommendations(snapshot: SystemSnapshot) -> Dict[str, Any]:
    """
    Tính toán điểm sức khỏe hệ thống (thang điểm 100) và tạo danh sách khuyến nghị tối ưu.
    - Trừ điểm khi CPU quá tải (>= 90% hoặc >= 75%).
    - Trừ điểm khi RAM cạn kiệt (>= 88% hoặc >= 75%).
    - Trừ điểm khi GPU bị quá nhiệt (>= 82 độ C hoặc >= 75 độ C).
    - Phát hiện tiến trình chiếm dụng bộ nhớ lớn (> 3000 MB) để đề xuất cô lập.

    Args:
        snapshot: Dữ liệu ảnh chụp hiện thời của hệ thống.

    Returns:
        Dictionary chứa điểm số (score), phân loại (status), chi tiết khấu trừ và các khuyến nghị.
    """
    score = 100
    deductions: List[Dict[str, Any]] = []
    recommendations: List[Dict[str, Any]] = []

    # 1. Đánh giá Tải CPU
    cpu_percent = snapshot.cpu.percent
    if cpu_percent >= 90:
        score -= 25
        deductions.append({"factor": "CPU Extreme Load", "points": -25, "value": f"{cpu_percent}%"})
        recommendations.append({
            "id": "rec-cpu-high",
            "type": "CPU_THROTTLE",
            "title": "CPU Overload Mitigation",
            "action": "Hạ độ ưu tiên của tiến trình ngốn CPU xuống IDLE để giải phóng tài nguyên",
            "suggested_action": "set_priority",
            "priority": "HIGH"
        })
    elif cpu_percent >= 75:
        score -= 12
        deductions.append({"factor": "CPU High Load", "points": -12, "value": f"{cpu_percent}%"})

    # 2. Đánh giá Bộ nhớ RAM
    ram_percent = snapshot.ram.percent
    if ram_percent >= 88:
        score -= 25
        deductions.append({"factor": "RAM Critical Saturation", "points": -25, "value": f"{ram_percent}%"})
        recommendations.append({
            "id": "rec-ram-trim",
            "type": "MEMORY_LEAK",
            "title": "EmptyWorkingSet RAM Trim Required",
            "action": "Kích hoạt Auto Trim Working Set RAM để thu hồi bộ nhớ rò rỉ mà không cần tắt ứng dụng",
            "suggested_action": "trim_memory",
            "priority": "CRITICAL"
        })
    elif ram_percent >= 75:
        score -= 10
        deductions.append({"factor": "RAM High Usage", "points": -10, "value": f"{ram_percent}%"})

    # 3. Đánh giá Nhiệt độ & VRAM GPU
    if snapshot.gpus:
        gpu = snapshot.gpus[0]
        if gpu.temp_c >= 82:
            score -= 25
            deductions.append({"factor": "GPU Critical Thermal", "points": -25, "value": f"{gpu.temp_c} C"})
            recommendations.append({
                "id": "rec-gpu-thermal",
                "type": "THERMAL_THROTTLE",
                "title": "GPU Overheating Warning",
                "action": "Tạm dừng các tiến trình ML / GPU nặng để làm nguội card đồ họa",
                "suggested_action": "suspend_pid",
                "priority": "CRITICAL"
            })
        elif gpu.temp_c >= 75:
            score -= 10
            deductions.append({"factor": "GPU Elevated Temp", "points": -10, "value": f"{gpu.temp_c} C"})

    # 4. Quét tìm các Tiến trình chiếm dụng bất thường
    top_procs = sorted(snapshot.processes, key=lambda p: p.memory_mb, reverse=True)[:5]
    for p in top_procs:
        if p.memory_mb > 3000:
            recommendations.append({
                "id": f"rec-heavy-proc-{p.pid}",
                "type": "HEAVY_PROCESS",
                "title": f"Process {p.name} consuming {p.memory_mb:.0f} MB",
                "action": f"Gán Core CPU Affinity hoặc thêm Alert Guard theo dõi tiến trình {p.name} [PID {p.pid}]",
                "pid": p.pid,
                "proc_name": p.name,
                "suggested_action": "set_affinity",
                "priority": "MEDIUM"
            })
            break

    score = max(5, min(100, score))
    status = "OPTIMAL" if score >= 85 else "HEALTHY" if score >= 70 else "WARNING" if score >= 45 else "CRITICAL"

    return {
        "score": score,
        "status": status,
        "deductions": deductions,
        "recommendations": recommendations,
        "summary": f"Hệ thống đạt {score}/100 điểm ({status}). {len(recommendations)} khuyến nghị tối ưu đang chờ."
    }
