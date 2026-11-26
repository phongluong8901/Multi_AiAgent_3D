import json
from typing import List, Dict, Any

TOOL_SCHEMA = {
    "name": "skill_uia_tree_inspector",
    "risk_level": "safe",
    "description": "Đọc cây giao diện ứng dụng Windows UI Automation, tìm nút bấm ô nhập liệu của phần mềm đang mở. Inspect active Windows UI Automation tree (uiautomation lazy-imported) and filter interactive controls (Button, Edit, MenuItem) with bounding boxes.",
    "parameters": {
        "type": "object",
        "properties": {
            "action": {
                "type": "string",
                "enum": ["get_active_window_tree", "filter_interactive_nodes"]
            },
            "max_depth": {
                "type": "integer",
                "default": 3
            },
            "nodes": {
                "type": "array",
                "items": {
                    "type": "object"
                },
                "default": []
            },
            "query": {
                "type": "string",
                "default": ""
            }
        },
        "required": ["action"]
    }
}

def get_active_window_tree(max_depth: int = 3) -> Dict[str, Any]:
    try:
        import uiautomation as auto
    except ImportError:
        return {"ok": False, "error": "Missing package uiautomation"}
    
    def inspect_node(node, depth):
        if depth > max_depth:
            return None
        node_info = {
            "name": node.Name,
            "control_type": node.ControlTypeName,
            "bounding_box": node.BoundingRectangle,
            "children": [inspect_node(child, depth + 1) for child in node.GetChildren()]
        }
        node_info["children"] = [child for child in node_info["children"] if child is not None]
        return node_info
    
    active_window = auto.GetForegroundWindow()
    if not active_window:
        return {"ok": False, "error": "No active window found"}
    
    tree = inspect_node(active_window, 1)
    return {"ok": True, "tree": tree}

def filter_interactive_nodes(nodes: List[Dict[str, Any]], query: str = "") -> Dict[str, Any]:
    interactive_types = {"Button", "Edit", "MenuItem"}
    filtered_nodes = []
    
    def filter_node(node):
        if node["control_type"] in interactive_types and (not query or query.lower() in node["name"].lower()):
            filtered_nodes.append(node)
        for child in node.get("children", []):
            filter_node(child)
    
    for node in nodes:
        filter_node(node)
    
    return {"ok": True, "filtered_nodes": filtered_nodes}

def execute(action: str = "", **kwargs) -> Dict[str, Any]:
    if action == "get_active_window_tree":
        max_depth = kwargs.get("max_depth", 3)
        return get_active_window_tree(max_depth)
    elif action == "filter_interactive_nodes":
        nodes = kwargs.get("nodes", [])
        query = kwargs.get("query", "")
        return filter_interactive_nodes(nodes, query)
    else:
        return {"ok": False, "error": f"Unknown action: {action}"}
