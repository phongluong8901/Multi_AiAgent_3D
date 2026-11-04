from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional

class FlowNode(BaseModel):
    id: str
    type: str  # "metric_trigger", "service_action", "process_node", "automation_node", "schedule_trigger", "condition_node", "logic_gate"
    data: Dict[str, Any] = Field(default_factory=dict)

class FlowEdge(BaseModel):
    id: str
    source: str
    target: str
    sourceHandle: Optional[str] = None
    targetHandle: Optional[str] = None

class WorkflowGraphRequest(BaseModel):
    workflow_id: str
    name: str
    nodes: List[FlowNode]
    edges: List[FlowEdge]
    interval_sec: float = 2.0
    force_breach: bool = False
