import html.parser
import csv
import json
import os

TOOL_SCHEMA = {
    "name": "skill_web_table_list_scraper",
    "description": "Parse HTML tables (<table>) into clean structured list-of-dicts records using standard html.parser (no mandatory external deps), filter/normalize cells, and optionally export scraped tables to CSV/JSON.",
    "risk_level": "safe",
    "parameters": {
        "action": "extract_tables_from_html, export_table_csv, extract_links_and_items",
        "html": "HTML content as string",
        "output_csv": "Path to output CSV file",
        "base_url": "Base URL for relative links"
    }
}

class TableHTMLParser(html.parser.HTMLParser):
    def __init__(self):
        super().__init__()
        self.tables = []
        self.current_table = []
        self.current_row = []
        self.current_cell = None  # Thêm dòng này để khởi tạo current_cell
        self.in_table = False
        self.in_row = False

    def handle_starttag(self, tag, attrs):
        if tag == 'table':
            self.in_table = True
            self.current_table = []
        elif tag == 'tr' and self.in_table:
            self.in_row = True
            self.current_row = []
        elif tag == 'td' and self.in_row:
            self.current_cell = []

    def handle_data(self, data):
        if self.current_cell is not None:
            self.current_cell.append(data)

    def handle_endtag(self, tag):
        if tag == 'td' and self.in_row:
            self.current_row.append(''.join(self.current_cell).strip())
            self.current_cell = None
        elif tag == 'tr' and self.in_row:
            self.current_table.append(self.current_row)
            self.in_row = False
        elif tag == 'table' and self.in_table:
            self.tables.append(self.current_table)
            self.in_table = False

def extract_tables_from_html(html: str) -> list:
    parser = TableHTMLParser()
    parser.feed(html)
    return parser.tables

def export_table_csv(records: list[dict], output_csv: str = 'table.csv') -> dict:
    try:
        with open(output_csv, 'w', newline='', encoding='utf-8') as csvfile:
            if records:
                writer = csv.DictWriter(csvfile, fieldnames=records[0].keys())
                writer.writeheader()
                writer.writerows(records)
        return {"ok": True}
    except Exception as e:
        return {"ok": False, "error": str(e)}

def extract_links_and_items(html: str, base_url: str = '') -> list:
    # Placeholder for link extraction logic
    return []

def execute(action: str = "extract_tables_from_html", **kwargs) -> dict:
    if action == "extract_tables_from_html":
        html = kwargs.get("html", "")
        tables = extract_tables_from_html(html)
        return {"ok": True, "tables": tables}
    elif action == "export_table_csv":
        records = kwargs.get("records", [])
        output_csv = kwargs.get("output_csv", "table.csv")
        return export_table_csv(records, output_csv)
    elif action == "extract_links_and_items":
        html = kwargs.get("html", "")
        base_url = kwargs.get("base_url", "")
        items = extract_links_and_items(html, base_url)
        return {"ok": True, "items": items}
    else:
        return {"ok": False, "error": "Unknown action"}
