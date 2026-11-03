import asyncio
from typing import Dict
from app.schemas.workflow_schema import WorkflowGraphRequest, FlowNode
from app.modules.telemetry.collector import telemetry_collector
from app.modules.workflow_engine.triggers import evaluate_metric_trigger
from app.modules.workflow_engine.actions import execute_node_action

class WorkflowDAGRunner:
    def __init__(self):
        self.active_tasks: Dict[str, asyncio.Task] = {}
        self.execution_logs: list[dict] = []

    def execute_once(self, graph: WorkflowGraphRequest) -> list[dict]:
        snapshot = telemetry_collector.get_snapshot()
        nodes_map: Dict[str, FlowNode] = {n.id: n for n in graph.nodes}
        adjacency: Dict[str, list[str]] = {n.id: [] for n in graph.nodes}

        for edge in graph.edges:
            if edge.source in adjacency:
                adjacency[edge.source].append(edge.target)

        # Tìm các Trigger Node (Node khởi đầu)
        trigger_nodes = [n for n in graph.nodes if n.type == "metric_trigger"]
        events = []

        for trigger in trigger_nodes:
            is_triggered = evaluate_metric_trigger(trigger.data, snapshot)
            if is_triggered:
                # Duyệt sang các Action Node được nối dây trực tiếp
                for target_id in adjacency.get(trigger.id, []):
                    target_node = nodes_map.get(target_id)
                    if target_node and target_node.type == "service_action":
                        res = execute_node_action(target_node.data)
                        log_entry = {
                            "workflow_id": graph.workflow_id,
                            "trigger_node": trigger.id,
                            "action_node": target_node.id,
                            "result": res
                        }
                        events.append(log_entry)
                        self.execution_logs.append(log_entry)
        return events

    async def _loop_runner(self, graph: WorkflowGraphRequest):
        while True:
            try:
                self.execute_once(graph)
            except Exception as e:
                self.execution_logs.append({"workflow_id": graph.workflow_id, "error": str(e)})
            await asyncio.sleep(graph.interval_sec)

    def start_background_workflow(self, graph: WorkflowGraphRequest) -> dict:
        if graph.workflow_id in self.active_tasks:
            self.active_tasks[graph.workflow_id].cancel()

        task = asyncio.create_task(self._loop_runner(graph))
        self.active_tasks[graph.workflow_id] = task
        return {"workflow_id": graph.workflow_id, "status": "running_in_background"}

    def stop_background_workflow(self, workflow_id: str) -> dict:
        task = self.active_tasks.pop(workflow_id, None)
        if task:
            task.cancel()
            return {"workflow_id": workflow_id, "status": "stopped"}
        return {"workflow_id": workflow_id, "status": "not_found"}

dag_runner = WorkflowDAGRunner()