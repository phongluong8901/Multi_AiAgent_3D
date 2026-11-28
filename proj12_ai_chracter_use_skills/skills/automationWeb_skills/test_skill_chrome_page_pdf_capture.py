import pytest
from unittest.mock import MagicMock
from skill_chrome_page_pdf_capture import execute, TOOL_SCHEMA

def test_tool_schema():
    assert isinstance(TOOL_SCHEMA, dict)
    assert TOOL_SCHEMA["name"] == "skill_chrome_page_pdf_capture"
    assert "export_page_pdf" in TOOL_SCHEMA["parameters"]
    assert "capture_full_page" in TOOL_SCHEMA["parameters"]

def test_unknown_action():
    result = execute(action="unknown_action")
    assert not result["ok"]
    assert "Unknown action" in result["error"]

def test_export_page_pdf_dry_run(tmp_path, monkeypatch):
    output_path = tmp_path / "page.pdf"
    monkeypatch.setattr("skill_chrome_page_pdf_capture._lazy_import_playwright", MagicMock(return_value=None))
    result = execute(action="export_page_pdf", output_path=str(output_path), dry_run=True)
    assert result["ok"]
    assert "Dry run" in result["message"]

def test_capture_full_page_dry_run(tmp_path, monkeypatch):
    output_path = tmp_path / "fullpage.png"
    monkeypatch.setattr("skill_chrome_page_pdf_capture._lazy_import_playwright", MagicMock(return_value=None))
    result = execute(action="capture_full_page", output_path=str(output_path), dry_run=True)
    assert result["ok"]
    assert "Dry run" in result["message"]

def test_invalid_output_path():
    result = execute(action="export_page_pdf", output_path="/nonexistent/path/page.pdf")
    assert not result["ok"]
    assert "Directory /nonexistent/path does not exist" in result["error"]
