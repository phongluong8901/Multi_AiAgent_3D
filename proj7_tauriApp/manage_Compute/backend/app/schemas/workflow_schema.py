from pydantic import BaseModel, Field
from typing import List, Dict, Any

class FlowNode(BaseModel):
    id: str
    type: str  # VD: "metric_trigger", "service_action"
    data: Dict[str, Any] = Field(default_factory=dict)

class FlowEdge(BaseModel):
    id: str
    source: str
    target: str

class WorkflowGraphRequest(BaseModel):
    workflow_id: str
    name: str
    nodes: List[FlowNode]
    edges: List[FlowEdge]
    interval_sec: float = 2.0