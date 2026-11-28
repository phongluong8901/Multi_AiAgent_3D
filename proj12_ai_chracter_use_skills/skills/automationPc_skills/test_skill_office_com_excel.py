import pytest
from unittest.mock import patch, MagicMock
from skill_office_com_excel import TOOL_SCHEMA, execute

def test_tool_schema():
    assert isinstance(TOOL_SCHEMA, dict)
    assert TOOL_SCHEMA["name"] == "skill_office_com_excel"
    assert TOOL_SCHEMA["risk_level"] == "confirm"
    assert "parameters" in TOOL_SCHEMA
    assert "action" in TOOL_SCHEMA["parameters"]["properties"]
    assert "enum" in TOOL_SCHEMA["parameters"]["properties"]["action"]
    assert "read_sheet" in TOOL_SCHEMA["parameters"]["properties"]["action"]["enum"]
    assert "write_rows" in TOOL_SCHEMA["parameters"]["properties"]["action"]["enum"]
    assert "attach_live_excel" in TOOL_SCHEMA["parameters"]["properties"]["action"]["enum"]

@patch('skill_office_com_excel.lazy_import')
def test_read_sheet_openpyxl_missing(mock_lazy_import):
    mock_lazy_import.return_value = None
    result = execute("read_sheet", file_path="test.xlsx")
    assert result == {"ok": False, "error": "Missing package openpyxl"}

@patch('skill_office_com_excel.lazy_import')
def test_read_sheet_success(mock_lazy_import):
    mock_openpyxl = MagicMock()
    mock_workbook = MagicMock()
    mock_sheet = MagicMock()
    mock_openpyxl.load_workbook.return_value = mock_workbook
    mock_workbook.active = mock_sheet
    mock_sheet.iter_rows.return_value = [[1, 2, 3], [4, 5, 6]]
    mock_lazy_import.return_value = mock_openpyxl
    
    result = execute("read_sheet", file_path="test.xlsx")
    assert result == {"ok": True, "data": [(1, 2, 3), (4, 5, 6)]}

@patch('skill_office_com_excel.lazy_import')
def test_write_rows_openpyxl_missing(mock_lazy_import):
    mock_lazy_import.return_value = None
    result = execute("write_rows", file_path="test.xlsx", sheet_name="Sheet1", rows=[[1, 2, 3]])
    assert result == {"ok": False, "error": "Missing package openpyxl"}

@patch('skill_office_com_excel.lazy_import')
def test_write_rows_success(mock_lazy_import):
    mock_openpyxl = MagicMock()
    mock_workbook = MagicMock()
    mock_sheet = MagicMock()
    mock_openpyxl.load_workbook.return_value = mock_workbook
    mock_workbook.create_sheet.return_value = mock_sheet
    mock_lazy_import.return_value = mock_openpyxl
    
    result = execute("write_rows", file_path="test.xlsx", sheet_name="Sheet1", rows=[[1, 2, 3]])
    assert result == {"ok": True}

@patch('skill_office_com_excel.lazy_import')
def test_attach_live_excel_win32com_missing(mock_lazy_import):
    mock_lazy_import.return_value = None
    result = execute("attach_live_excel")
    assert result == {"ok": False, "error": "Missing package win32com.client"}

@patch('skill_office_com_excel.lazy_import')
def test_attach_live_excel_success(mock_lazy_import):
    mock_win32com_client = MagicMock()
    mock_excel = MagicMock()
    mock_win32com_client.Dispatch.return_value = mock_excel
    mock_lazy_import.return_value = mock_win32com_client
    
    result = execute("attach_live_excel")
    assert result == {"ok": True, "excel": mock_excel}

def test_execute_invalid_action():
    result = execute("invalid_action")
    assert result == {"ok": False, "error": "Invalid action"}
