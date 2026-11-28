"""
Module Workflow DAG Engine & Auto-Guard Runner:
Quản lý việc thực thi đồ thị quy trình DAG (Directed Acyclic Graph) tự động hóa,
đánh giá các node Trigger, Condition rẽ nhánh True/False, Cổng logic AND/OR,
và điều phối các hành động can thiệp (Action Nodes) bảo vệ phần cứng.
"""

import asyncio
import time
from typing import Dict, List, Optional, Set
from app.schemas.workflow_schema import WorkflowGraphRequest, FlowNode, FlowEdge
from app.modules.telemetry.collector import telemetry_collector
from app.modules.workflow_engine.triggers import evaluate_metric_trigger
from app.modules.workflow_engine.actions import execute_node_action
from app.modules.service_manager.resource_quota_manager import resource_quota_manager

class WorkflowDAGRunner:
    """
    Trình thông dịch và thực thi luồng quy trình DAG tự động hóa.
    Hỗ trợ chạy một lần (Dry-run / Run Once) hoặc chạy nền theo chu kỳ (Continuous Loop).
    """

    def __init__(self):
        """Khởi tạo trạng thái và bộ nhớ theo dõi quá trình thực thi workflow."""
        self.active_tasks: Dict[str, asyncio.Task] = {}
        self.active_schedules: Dict[str, dict] = {}
        self.execution_logs: List[dict] = []
        self.last_execution_trace: List[dict] = []
        self.guard_armed: bool = True
        self.interventions_count: int = 0
        self.last_intervention: Optional[dict] = None
        self.total_ticks: int = 0
        self.last_tick_time: Optional[float] = None

    def toggle_guard(self, armed: Optional[bool] = None) -> bool:
        """
        Bật hoặc tắt cơ chế Auto-Guard (chốt an toàn cho phép hoặc chặn thực thi can thiệp).

        Tham số:
            armed (Optional[bool]): Trạng thái mong muốn (True: Bật, False: Tắt, None: Đảo trạng thái).

        Trả về:
            bool: Trạng thái mới của Auto-Guard.
        """
        if armed is not None:
            self.guard_armed = armed
        else:
            self.guard_armed = not self.guard_armed
        return self.guard_armed

    def get_guard_status(self) -> dict:
        """
        Lấy thông tin tổng quan về trạng thái giám sát của Auto-Guard.

        Trả về:
            dict: Thống kê số lần can thiệp, trạng thái armed, số lượng workflow đang chạy nền.
        """
        return {
            "guard_armed": self.guard_armed,
            "interventions_count": self.interventions_count,
            "last_intervention": self.last_intervention,
            "active_workflows_count": len(self.active_tasks),
            "total_ticks": self.total_ticks,
            "last_tick_time": self.last_tick_time,
            "active_schedules": self.active_schedules,
        }

    def execute_once(self, graph: WorkflowGraphRequest) -> list[dict]:
        """
        Thực thi duyệt đồ thị DAG một lần duy nhất từ các Node Trigger gốc tới các Action đích.

        Tham số:
            graph (WorkflowGraphRequest): Cấu trúc đồ thị gồm danh sách node và edge.

        Trả về:
            list[dict]: Danh sách sự kiện và hành động đã được kích hoạt trong lượt chạy.
        """
        snapshot = telemetry_collector.get_snapshot()
        nodes_map: Dict[str, FlowNode] = {n.id: n for n in graph.nodes}
        edge_map: Dict[str, List[FlowEdge]] = {n.id: [] for n in graph.nodes}
        incoming_map: Dict[str, List[FlowEdge]] = {n.id: [] for n in graph.nodes}

        # Xây dựng bảng ánh xạ cạnh liên kết hai chiều (Forward và Backward)
        for edge in graph.edges:
            if edge.source in edge_map:
                edge_map[edge.source].append(edge)
            if edge.target in incoming_map:
                incoming_map[edge.target].append(edge)

        # Tạo bảng tra cứu nhanh thông tin tiến trình theo PID
        proc_lookup = {p.pid: p.model_dump() for p in snapshot.processes}

        # Tìm các Trigger & Root Node (Node khởi đầu: metric_trigger, schedule_trigger, hoặc node không có incoming)
        trigger_nodes = [n for n in graph.nodes if n.type in ["metric_trigger", "schedule_trigger"]]
        if not trigger_nodes:
            # Dự phòng: Nếu đồ thị không có trigger rõ ràng thì lấy các root node không có cạnh đi vào
            trigger_nodes = [n for n in graph.nodes if len(incoming_map[n.id]) == 0]

        events = []
        trace = []
        is_force_test = bool(graph.force_breach)

        # Tập hợp các node đã kích hoạt thành công để xử lý cổng logic (AND / OR)
        triggered_set: Set[str] = set()

        for trigger in trigger_nodes:
            # Thu thập ngữ cảnh tiến trình (context process) liên kết trực tiếp
            connected_node_ids = [e.target for e in edge_map.get(trigger.id, [])] + [e.source for e in incoming_map.get(trigger.id, [])]
            direct_proc = None
            for cid in connected_node_ids:
                cand_node = nodes_map.get(cid)
                if cand_node and cand_node.type == "process_node":
                    pid = int(cand_node.data.get("pid", 0))
                    if pid in proc_lookup:
                        direct_proc = proc_lookup[pid]
                    else:
                        direct_proc = {
                            "pid": pid,
                            "name": cand_node.data.get("name", "Target Process"),
                            "cpu_percent": float(cand_node.data.get("cpu_percent", 0.0)),
                            "memory_mb": float(cand_node.data.get("memory_mb", 0.0))
                        }
                    break

            # Đánh giá điều kiện kích hoạt của Trigger
            if trigger.type == "metric_trigger":
                node_force = is_force_test or bool(trigger.data.get("force_breach", False))
                is_triggered = node_force or evaluate_metric_trigger(trigger.data, snapshot, direct_proc)
            else:
                # Node schedule_trigger hoặc root node mặc định luôn phát xung
                is_triggered = True

            trigger_label = trigger.data.get("name") or ("Metric Alert Trigger" if trigger.type == "metric_trigger" else "Schedule Timer Trigger")
            if is_triggered:
                trace.append({
                    "step": len(trace) + 1,
                    "node_id": trigger.id,
                    "node_type": trigger.type,
                    "label": trigger_label,
                    "status": "TRIGGERED",
                    "detail": f"Condition met: {trigger.data.get('metric', 'timer')} {trigger.data.get('operator', '')} {trigger.data.get('threshold', '')}".strip()
                })
                triggered_set.add(trigger.id)
                visited = set()
                queue = [e.target for e in edge_map.get(trigger.id, [])]
                context_pid = direct_proc["pid"] if direct_proc else None

                while queue:
                    current_id = queue.pop(0)
                    if current_id in visited:
                        continue
                    visited.add(current_id)

                    node = nodes_map.get(current_id)
                    if not node:
                        continue

                    # 1. Process Node: Trích xuất PID và lan truyền ngữ cảnh xuống hạ lưu (downstream)
                    if node.type == "process_node":
                        context_pid = int(node.data.get("pid", 0))
                        if context_pid in proc_lookup:
                            direct_proc = proc_lookup[context_pid]
                        p_name = direct_proc.get('name', 'Process') if direct_proc else 'Process'
                        p_ram = f"{direct_proc.get('memory_mb', 0):.0f}MB" if direct_proc else "0MB"
                        p_cpu = f"{direct_proc.get('cpu_percent', 0):.1f}%" if direct_proc else "0%"
                        trace.append({
                            "step": len(trace) + 1,
                            "node_id": node.id,
                            "node_type": node.type,
                            "label": node.data.get("name") or f"OS Process [PID {context_pid}]",
                            "status": "EVALUATED",
                            "detail": f"Bound: {p_name} (RAM: {p_ram}, CPU: {p_cpu})"
                        })
                        queue.extend([e.target for e in edge_map.get(current_id, [])])

                    # 2. Condition Node: Rẽ nhánh luồng dựa trên cổng ra True hoặc False
                    elif node.type == "condition_node":
                        cond_res = is_force_test or evaluate_metric_trigger(node.data, snapshot, direct_proc)
                        target_handle = "true" if cond_res else "false"
                        triggered_set.add(f"{node.id}:{target_handle}")

                        trace.append({
                            "step": len(trace) + 1,
                            "node_id": node.id,
                            "node_type": node.type,
                            "label": node.data.get("name") or "Condition Router (If/Else)",
                            "status": "BRANCH_TRUE" if cond_res else "BRANCH_FALSE",
                            "detail": f"Result: {cond_res} -> Dispatched to '{target_handle.upper()}' branch"
                        })

                        log_entry = {
                            "workflow_id": graph.workflow_id,
                            "condition_node": node.id,
                            "result": cond_res,
                            "branch": target_handle,
                            "target_pid": context_pid
                        }
                        events.append(log_entry)
                        self.execution_logs.append(log_entry)

                        # Chỉ thêm vào hàng đợi các cạnh khớp chính xác với nhánh kết quả
                        next_edges = edge_map.get(current_id, [])
                        for e in next_edges:
                            if not e.sourceHandle or e.sourceHandle == target_handle:
                                queue.append(e.target)

                    # 3. Logic Gate Node: Đánh giá cổng logic tổng hợp AND hoặc OR
                    elif node.type == "logic_gate":
                        gate_type = str(node.data.get("gate_type", "AND")).upper()
                        inc_edges = incoming_map.get(current_id, [])
                        inc_sources = [e.source for e in inc_edges]

                        if gate_type == "AND":
                            gate_pass = all(s in triggered_set for s in inc_sources) if inc_sources else True
                        else:  # OR
                            gate_pass = any(s in triggered_set for s in inc_sources) if inc_sources else True

                        trace.append({
                            "step": len(trace) + 1,
                            "node_id": node.id,
                            "node_type": node.type,
                            "label": node.data.get("name") or f"Logic Gate ({gate_type})",
                            "status": "PASSED" if gate_pass else "BLOCKED",
                            "detail": f"{gate_type} gate {'passed all inputs' if gate_pass else 'blocked (inputs pending)'}"
                        })

                        if gate_pass:
                            triggered_set.add(node.id)
                            log_entry = {
                                "workflow_id": graph.workflow_id,
                                "logic_gate": node.id,
                                "gate_type": gate_type,
                                "status": "PASSED"
                            }
                            events.append(log_entry)
                            queue.extend([e.target for e in edge_map.get(current_id, [])])

                    # 4. Action & Webhook Node: Thực thi các lệnh can thiệp bảo vệ tài nguyên
                    elif node.type in ["service_action", "automation_node", "resource_quota", "quota_node", "webhook_node"]:
                        action_data = dict(node.data)
                        if is_force_test:
                            action_data["is_test"] = True

                        if context_pid and not action_data.get("pid"):
                            action_data["pid"] = context_pid

                        action_data["metric"] = trigger.data.get("metric", "CPU/RAM Load")
                        action_data["threshold"] = trigger.data.get("threshold")
                        if context_pid and context_pid in proc_lookup:
                            action_data["proc_name"] = proc_lookup[context_pid].get("name", "Process")
                        elif direct_proc and direct_proc.get("name"):
                            action_data["proc_name"] = direct_proc.get("name")

                        # Chỉ tiến hành can thiệp thật nếu Auto-Guard đang ở trạng thái vũ trang (armed)
                        if self.guard_armed or is_force_test:
                            res = execute_node_action(action_data)
                            if is_force_test:
                                res["simulated_breach"] = True

                            if res.get("status") in ["executed", "started"]:
                                self.interventions_count += 1
                                self.last_intervention = {
                                    "timestamp": time.time(),
                                    "workflow_id": graph.workflow_id,
                                    "trigger_id": trigger.id,
                                    "metric": trigger.data.get("metric"),
                                    "threshold": trigger.data.get("threshold"),
                                    "action": action_data.get("action_type"),
                                    "pid": context_pid,
                                    "result": res,
                                    "is_simulated": is_force_test
                                }
                        else:
                            res = {"status": "skipped", "reason": "Auto-Guard is disarmed"}

                        trace.append({
                            "step": len(trace) + 1,
                            "node_id": node.id,
                            "node_type": node.type,
                            "label": node.data.get("name") or node.data.get("title") or node.type,
                            "status": "EXECUTED",
                            "detail": f"Action: {res.get('action') or res.get('status') or 'Completed'}"
                        })

                        log_entry = {
                            "workflow_id": graph.workflow_id,
                            "trigger_node": trigger.id,
                            "action_node": node.id,
                            "target_pid": context_pid,
                            "result": res,
                            "is_simulated": is_force_test
                        }
                        events.append(log_entry)
                        self.execution_logs.append(log_entry)
                        triggered_set.add(node.id)
                        queue.extend([e.target for e in edge_map.get(current_id, [])])
            else:
                trace.append({
                    "step": len(trace) + 1,
                    "node_id": trigger.id,
                    "node_type": trigger.type,
                    "label": trigger_label,
                    "status": "SAFE",
                    "detail": f"Metric within safe limits ({trigger.data.get('metric', 'timer')})"
                })

        self.last_execution_trace = trace
        return events

    async def _loop_runner(self, graph: WorkflowGraphRequest):
        """
        Vòng lặp bất đồng bộ thực hiện quét định kỳ workflow và áp đặt định mức tài nguyên.

        Tham số:
            graph (WorkflowGraphRequest): Cấu hình đồ thị workflow cần duy trì chạy nền.
        """
        while True:
            try:
                self.total_ticks += 1
                self.last_tick_time = time.time()
                if graph.workflow_id in self.active_schedules:
                    self.active_schedules[graph.workflow_id]["last_run"] = self.last_tick_time
                    self.active_schedules[graph.workflow_id]["total_runs"] = (
                        self.active_schedules[graph.workflow_id].get("total_runs", 0) + 1
                    )
                self.execute_once(graph)
                resource_quota_manager.enforce_quotas()
            except Exception as e:
                self.execution_logs.append({"workflow_id": graph.workflow_id, "error": str(e)})
            await asyncio.sleep(graph.interval_sec)

    def deploy_loop(self, graph: WorkflowGraphRequest) -> dict:
        """
        Triển khai một workflow vào tác vụ nền (background asyncio task) theo tần suất lặp.

        Tham số:
            graph (WorkflowGraphRequest): Đồ thị quy trình cần kích hoạt.

        Trả về:
            dict: Thông tin xác nhận triển khai thành công.
        """
        schedule_node = next((n for n in graph.nodes if n.type == "schedule_trigger"), None)
        interval = float(schedule_node.data.get("interval_sec", graph.interval_sec)) if schedule_node else graph.interval_sec
        graph.interval_sec = max(0.5, interval)

        # Hủy bỏ tác vụ cũ nếu cùng workflow_id đang hoạt động
        if graph.workflow_id in self.active_tasks:
            self.active_tasks[graph.workflow_id].cancel()

        loop = asyncio.get_event_loop()
        task = loop.create_task(self._loop_runner(graph))
        self.active_tasks[graph.workflow_id] = task

        self.active_schedules[graph.workflow_id] = {
            "interval_sec": graph.interval_sec,
            "started_at": time.time(),
            "total_runs": 0,
            "last_run": None,
            "name": graph.name
        }

        return {
            "status": "deployed",
            "workflow_id": graph.workflow_id,
            "interval_sec": graph.interval_sec
        }

    def start_background_workflow(self, graph: WorkflowGraphRequest) -> dict:
        """Bí danh cho phương thức deploy_loop."""
        return self.deploy_loop(graph)

    def stop_background_workflow(self, workflow_id: str) -> dict:
        """
        Dừng một workflow nền đang chạy theo ID.

        Tham số:
            workflow_id (str): Mã định danh workflow cần dừng.

        Trả về:
            dict: Trạng thái dừng tiến trình.
        """
        if workflow_id in self.active_tasks:
            self.active_tasks[workflow_id].cancel()
            del self.active_tasks[workflow_id]
            if workflow_id in self.active_schedules:
                del self.active_schedules[workflow_id]
            return {"status": "stopped", "workflow_id": workflow_id}
        return {"status": "not_running", "workflow_id": workflow_id}

# Đối tượng Singleton của trình điều phối quy trình DAG
dag_runner = WorkflowDAGRunner()
workflow_runner = dag_runner
