import psutil
from typing import Dict, List
from app.schemas.telemetry_schema import SystemSnapshot

# Bộ nhớ đệm lịch sử RAM theo PID để phân tích độ dốc rò rỉ bộ nhớ (Memory Leak Trend)
_process_mem_history: Dict[int, List[float]] = {}

def evaluate_metric_trigger(node_data: dict, snapshot: SystemSnapshot, context_process: dict | None = None) -> bool:
    """
    Hỗ trợ đánh giá các ngưỡng Auto-Guard phần cứng, tiến trình, và chẩn đoán thông minh:
    - cpu_percent, ram_percent, gpu_temp, gpu_vram_percent
    - process_memory_mb, process_cpu_percent
    - memory_leak_slope (Phát hiện rò rỉ bộ nhớ sớm 5 chu kỳ liên tiếp)
    - port_collision (Phát hiện xung đột / chiếm dụng cổng mạng)
    """
    metric = node_data.get("metric", "cpu_percent")
    operator = node_data.get("operator", ">")
    threshold = float(node_data.get("threshold", 80.0))

    # 1. Chẩn đoán Rò rỉ Bộ nhớ Thông minh (Memory Leak Heuristic)
    if metric == "memory_leak_slope":
        if not context_process:
            return False
        pid = int(context_process.get("pid", 0))
        current_mem = float(context_process.get("memory_mb", 0.0))
        if pid <= 0:
            return False

        if pid not in _process_mem_history:
            _process_mem_history[pid] = []
        _process_mem_history[pid].append(current_mem)
        if len(_process_mem_history[pid]) > 10:
            _process_mem_history[pid].pop(0)

        history = _process_mem_history[pid]
        if len(history) >= 5:
            recent_5 = history[-5:]
            # Kiểm tra xem RAM có tăng liên tục trong 5 chu kỳ gần nhất không
            is_increasing = all(recent_5[i] <= recent_5[i+1] for i in range(len(recent_5) - 1))
            total_growth_mb = recent_5[-1] - recent_5[0]
            # Nếu tăng liên tục VÀ mức tăng >= threshold (mặc định 20MB)
            if is_increasing and total_growth_mb >= threshold:
                return True
        return False

    # 2. Giám sát Cổng Mạng Xung Đột (Port Collision & Socket Watchdog)
    if metric == "port_collision":
        import socket
        target_port = int(node_data.get("target_port") or threshold or 8000)
        # Kiểm tra socket probe trực tiếp (nhanh, chuẩn xác 100%, không bị lỗi quyền Windows)
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                s.settimeout(0.15)
                res = s.connect_ex(('127.0.0.1', target_port))
                if res == 0:
                    return True
        except Exception:
            pass

        # Quét bổ sung qua psutil net_connections có bọc try/except
        try:
            for conn in psutil.net_connections(kind='inet'):
                if conn.status == 'LISTEN' and conn.laddr:
                    p = getattr(conn.laddr, "port", None)
                    if p is None and isinstance(conn.laddr, (tuple, list)) and len(conn.laddr) > 1:
                        p = conn.laddr[1]
                    if p == target_port:
                        return True
        except Exception:
            pass
        return False

    # 3. Các chỉ số Telemetry thông thường
    current_val = 0.0
    if metric == "cpu_percent":
        current_val = snapshot.cpu.percent
    elif metric == "ram_percent":
        current_val = snapshot.ram.percent
    elif metric == "gpu_temp":
        current_val = snapshot.gpus[0].temp_c if snapshot.gpus else 0.0
    elif metric == "gpu_vram_percent":
        current_val = snapshot.gpus[0].memory_percent if snapshot.gpus else 0.0
    elif metric == "process_memory_mb" and context_process:
        current_val = float(context_process.get("memory_mb", 0.0))
    elif metric == "process_cpu_percent" and context_process:
        current_val = float(context_process.get("cpu_percent", 0.0))

    if operator == ">":
        return current_val > threshold
    if operator == ">=":
        return current_val >= threshold
    if operator == "<":
        return current_val < threshold
    if operator == "<=":
        return current_val <= threshold
    if operator == "==":
        return abs(current_val - threshold) < 0.01
    return False
