import sys
import types
from typing import List, Dict, Any

TOOL_SCHEMA = {
    "name": "skill_csv_json_transformer",
    "risk_level": "safe",
    "description": "Convert between CSV, JSON, and Markdown tables, filter dữ liệu bảng, thống kê tổng trung bình cột CSV",
    "parameters": {
        "type": "object",
        "properties": {
            "action": {
                "type": "string",
                "enum": ["csv_to_json", "json_to_markdown_table", "column_stats"]
            },
            "csv_path": {
                "type": "string"
            },
            "json_data": {
                "type": "string"
            },
            "limit": {
                "type": "integer",
                "default": 100
            },
            "max_rows": {
                "type": "integer",
                "default": 30
            },
            "column": {
                "type": "string"
            }
        },
        "required": ["action"]
    }
}

def execute(action: str = "", **kwargs) -> Dict[str, Any]:
    if action == "csv_to_json":
        return csv_to_json(kwargs.get("csv_path", ""), kwargs.get("limit", 100))
    elif action == "json_to_markdown_table":
        import json  # Lazy import
        return json_to_markdown_table(json.loads(kwargs.get("json_data", "[]")), kwargs.get("max_rows", 30))
    elif action == "column_stats":
        return column_stats(kwargs.get("csv_path", ""), kwargs.get("column", ""))
    else:
        return {"ok": False, "error": f"Unknown action: {action}"}

def csv_to_json(csv_path: str, limit: int = 100) -> Dict[str, Any]:
    try:
        import pandas as pd
    except ImportError:
        return {"ok": False, "error": "Missing package pandas"}
    
    try:
        df = pd.read_csv(csv_path)
        json_data = df.head(limit).to_json(orient="records")
        return {"ok": True, "data": json_data}
    except Exception as e:
        return {"ok": False, "error": str(e)}

def json_to_markdown_table(records: List[Dict[str, Any]], max_rows: int = 30) -> Dict[str, Any]:
    if not records:
        return {"ok": False, "error": "No data to convert"}
    
    headers = records[0].keys()
    table = [f"| {' | '.join(headers)} |"]
    table.append(f"| {' | '.join(['---'] * len(headers))} |")
    
    for record in records[:max_rows]:
        row = [str(record.get(header, "")) for header in headers]
        table.append(f"| {' | '.join(row)} |")
    
    return {"ok": True, "data": "\n".join(table)}

def column_stats(csv_path: str, column: str) -> Dict[str, Any]:
    try:
        import pandas as pd
    except ImportError:
        return {"ok": False, "error": "Missing package pandas"}
    
    try:
        df = pd.read_csv(csv_path)
        if column not in df.columns:
            return {"ok": False, "error": f"Column {column} not found in CSV"}
        
        stats = {
            "sum": df[column].sum(),
            "avg": df[column].mean(),
            "min": df[column].min(),
            "max": df[column].max()
        }
        return {"ok": True, "data": stats}
    except Exception as e:
        return {"ok": False, "error": str(e)}
