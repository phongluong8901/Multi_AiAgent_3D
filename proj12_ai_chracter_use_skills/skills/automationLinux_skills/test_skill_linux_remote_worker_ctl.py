import pytest
import json
import skill_linux_remote_worker_ctl as mod
from unittest.mock import MagicMock

def test_tool_schema():
    assert mod.TOOL_SCHEMA["name"] == "skill_linux_remote_worker_ctl"

def test_unknown_action():
    result = mod.execute(action="unknown_action")
    assert result == {"ok": False, "error": "Unknown action unknown_action."}

def test_manage_inventory_list(tmp_path):
    inventory_path = tmp_path / "nodes.json"
    inventory_path.write_text(json.dumps([{"host": "node1", "port": 22}]))
    result = mod.execute(action="manage_inventory", inventory_path=str(inventory_path), mode="list")
    assert result == {"ok": True, "nodes": [{"host": "node1", "port": 22}]}

def test_manage_inventory_add(tmp_path, monkeypatch):
    inventory_path = tmp_path / "nodes.json"
    inventory_path.write_text(json.dumps([{"host": "node1", "port": 22}]))
    new_node = {"host": "node2", "port": 22}
    monkeypatch.setattr(mod, "_run_cmd", MagicMock(return_value=(0, "", "")))
    result = mod.execute(action="manage_inventory", inventory_path=str(inventory_path), mode="add", node=new_node, dry_run=False)
    assert result == {"ok": True, "message": "Node added successfully."}
    with open(inventory_path, 'r') as f:
        nodes = json.load(f)
    assert nodes == [{"host": "node1", "port": 22}, {"host": "node2", "port": 22}]

def test_check_nodes_health(monkeypatch):
    nodes = [{"host": "node1", "port": 22}, {"host": "node2", "port": 22}]
    monkeypatch.setattr(mod, "_check_tcp_port", MagicMock(side_effect=[True, False]))
    result = mod.execute(action="check_nodes_health", nodes=nodes)
    assert result == {"ok": True, "results": [
        {"host": "node1", "port": 22, "reachable": True},
        {"host": "node2", "port": 22, "reachable": False}
    ]}

def test_build_ssh_exec_cmd():
    result = mod.execute(action="build_ssh_exec_cmd", host="node1", command="uptime")
    assert result == {"ok": True, "command": ['ssh', 'root@node1', '-p', '22', 'uptime']}
