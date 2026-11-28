"""
Module định nghĩa các Pydantic Schema cho Đồ thị Quy trình Tự động hóa (Workflow DAG Schema).
Mô hình hóa các Node (Trigger, Condition, Action, Gate) và Edge nối giữa các node trên Canvas n8n.
"""

from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional

class FlowNode(BaseModel):
    """
    Mô hình dữ liệu của một node trên đồ thị luồng xử lý:
    định danh (id), loại node (type) và cấu hình tham số thực thi (data).
    """
    id: str
    type: str  # "metric_trigger", "service_action", "process_node", "automation_node", "schedule_trigger", "condition_node", "logic_gate"
    data: Dict[str, Any] = Field(default_factory=dict)

class FlowEdge(BaseModel):
    """
    Mô hình đường nối có hướng (Edge) liên kết giữa cổng ra của node nguồn và cổng vào của node đích.
    """
    id: str
    source: str
    target: str
    sourceHandle: Optional[str] = None
    targetHandle: Optional[str] = None

class WorkflowGraphRequest(BaseModel):
    """
    Payload yêu cầu lưu trữ và kích hoạt đồ thị quy trình tự động hóa (DAG Workflow):
    mã quy trình, danh sách node, danh sách cạnh kết nối và chu kỳ kiểm tra điều kiện.
    """
    workflow_id: str
    name: str
    nodes: List[FlowNode]
    edges: List[FlowEdge]
    interval_sec: float = 2.0
    force_breach: bool = False
