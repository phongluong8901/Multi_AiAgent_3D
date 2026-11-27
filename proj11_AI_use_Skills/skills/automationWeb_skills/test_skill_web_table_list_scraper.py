import pytest
from skill_web_table_list_scraper import execute, TOOL_SCHEMA, extract_tables_from_html, export_table_csv

def test_tool_schema():
    assert TOOL_SCHEMA["name"] == "skill_web_table_list_scraper"
    assert TOOL_SCHEMA["description"] == "Parse HTML tables (<table>) into clean structured list-of-dicts records using standard html.parser (no mandatory external deps), filter/normalize cells, and optionally export scraped tables to CSV/JSON."
    assert TOOL_SCHEMA["risk_level"] == "safe"
    assert "action" in TOOL_SCHEMA["parameters"]
    assert "html" in TOOL_SCHEMA["parameters"]
    assert "output_csv" in TOOL_SCHEMA["parameters"]
    assert "base_url" in TOOL_SCHEMA["parameters"]

def test_unknown_action():
    result = execute(action="unknown_action")
    assert result["ok"] is False
    assert "Unknown action" in result["error"]

def test_extract_tables_from_html(tmp_path):
    html_content = """
    <table>
        <tr><td>Name</td><td>Age</td></tr>
        <tr><td>Alice</td><td>30</td></tr>
        <tr><td>Bob</td><td>25</td></tr>
    </table>
    """
    result = execute(action="extract_tables_from_html", html=html_content)
    assert result["ok"] is True
    assert len(result["tables"]) == 1
    assert result["tables"][0] == [['Name', 'Age'], ['Alice', '30'], ['Bob', '25']]

def test_export_table_csv(tmp_path):
    records = [
        {"Name": "Alice", "Age": "30"},
        {"Name": "Bob", "Age": "25"}
    ]
    output_csv = tmp_path / "output.csv"
    result = execute(action="export_table_csv", records=records, output_csv=str(output_csv))
    assert result["ok"] is True
    with open(output_csv, 'r', encoding='utf-8') as csvfile:
        content = csvfile.read()
        assert "Name,Age\nAlice,30\nBob,25\n" in content

def test_extract_links_and_items(monkeypatch):
    def mock_extract_links_and_items(html, base_url):
        return [{"link": "http://example.com/item1", "name": "Item 1"}]
    
    monkeypatch.setattr("skill_web_table_list_scraper.extract_links_and_items", mock_extract_links_and_items)
    html_content = "<a href='/item1'>Item 1</a>"
    result = execute(action="extract_links_and_items", html=html_content, base_url="http://example.com")
    assert result["ok"] is True
    assert result["items"] == [{"link": "http://example.com/item1", "name": "Item 1"}]
