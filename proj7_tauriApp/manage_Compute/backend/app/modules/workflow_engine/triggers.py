from app.schemas.telemetry_schema import SystemSnapshot

def evaluate_metric_trigger(node_data: dict, snapshot: SystemSnapshot) -> bool:
    """
    Ví dụ node_data từ React Flow gửi xuống:
    {"metric": "cpu_percent", "operator": ">", "threshold": 85}
    hoặc {"metric": "gpu_temp", "operator": ">=", "threshold": 80}
    """
    metric = node_data.get("metric", "cpu_percent")
    operator = node_data.get("operator", ">")
    threshold = float(node_data.get("threshold", 80.0))

    current_val = 0.0
    if metric == "cpu_percent":
        current_val = snapshot.cpu.percent
    elif metric == "ram_percent":
        current_val = snapshot.ram.percent
    elif metric == "gpu_temp" and snapshot.gpus:
        current_val = snapshot.gpus[0].temp_c
    elif metric == "gpu_vram_percent" and snapshot.gpus:
        current_val = snapshot.gpus[0].memory_percent

    if operator == ">":
        return current_val > threshold
    if operator == ">=":
        return current_val >= threshold
    if operator == "<":
        return current_val < threshold
    if operator == "==":
        return current_val == threshold
    return False