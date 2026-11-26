import importlib.util
import json
import os
from typing import List, Dict, Any

TOOL_SCHEMA = {
    "name": "skill_office_com_excel",
    "description": "Read, write, summarize, and apply formulas to Excel spreadsheets using openpyxl or live Windows Excel COM (win32com.client lazy-imported).",
    "risk_level": "confirm",
    "parameters": {
        "type": "object",
        "properties": {
            "action": {
                "type": "string",
                "enum": ["read_sheet", "write_rows", "attach_live_excel"]
            },
            "file_path": {
                "type": "string"
            },
            "sheet_name": {
                "type": "string"
            },
            "max_rows": {
                "type": "integer"
            },
            "rows": {
                "type": "array",
                "items": {
                    "type": "array",
                    "items": {
                        "type": "any"
                    }
                }
            }
        },
        "required": ["action"]
    }
}

def lazy_import(module_name: str) -> Any:
    spec = importlib.util.find_spec(module_name)
    if spec is None:
        return None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module

def read_sheet(file_path: str, sheet_name: str = '', max_rows: int = 100) -> Dict[str, Any]:
    openpyxl = lazy_import('openpyxl')
    if openpyxl is None:
        return {"ok": False, "error": "Missing package openpyxl"}
    
    try:
        workbook = openpyxl.load_workbook(file_path)
        if sheet_name:
            sheet = workbook[sheet_name]
        else:
            sheet = workbook.active
        
        data = []
        for row in sheet.iter_rows(values_only=True, max_row=max_rows):
            data.append(tuple(row))  # Convert list to tuple
        
        return {"ok": True, "data": data}
    except Exception as e:
        return {"ok": False, "error": str(e)}

def write_rows(file_path: str, sheet_name: str, rows: List[List[Any]]) -> Dict[str, Any]:
    openpyxl = lazy_import('openpyxl')
    if openpyxl is None:
        return {"ok": False, "error": "Missing package openpyxl"}
    
    try:
        workbook = openpyxl.load_workbook(file_path)
        if sheet_name in workbook.sheetnames:
            sheet = workbook[sheet_name]
        else:
            sheet = workbook.create_sheet(title=sheet_name)
        
        for row in rows:
            sheet.append(row)
        
        workbook.save(file_path)
        return {"ok": True}
    except Exception as e:
        return {"ok": False, "error": str(e)}

def attach_live_excel() -> Dict[str, Any]:
    win32com_client = lazy_import('win32com.client')
    if win32com_client is None:
        return {"ok": False, "error": "Missing package win32com.client"}
    
    try:
        excel = win32com_client.Dispatch("Excel.Application")
        excel.Visible = True
        return {"ok": True, "excel": excel}
    except Exception as e:
        return {"ok": False, "error": str(e)}

def execute(action: str, **kwargs) -> Dict[str, Any]:
    if action == "read_sheet":
        return read_sheet(**kwargs)
    elif action == "write_rows":
        return write_rows(**kwargs)
    elif action == "attach_live_excel":
        return attach_live_excel()
    else:
        return {"ok": False, "error": "Invalid action"}
