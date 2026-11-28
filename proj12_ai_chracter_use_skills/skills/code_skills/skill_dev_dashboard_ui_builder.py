import os
import json
from pathlib import Path

TOOL_SCHEMA = {
    "name": "skill_dev_dashboard_ui_builder",
    "description": "Generate clean, self-contained HTML/CSS/JS dashboard UIs: a Skills Explorer page listing catalog items with live search and Run buttons wired to /api/run, an auto-refreshing monitor cards page, and a sortable data table page. Tạo giao diện web hiển thị toàn bộ skills có ô tìm kiếm và nút bấm chạy thử, tạo trang thẻ giám sát thời tiết giá cả sức khỏe máy",
    "risk_level": "safe",
    "parameters": {
        "type": "object",
        "properties": {
            "action": {"type": "string", "enum": ["build_skills_explorer_html", "build_monitor_cards_html", "build_table_chart_page"]},
        },
        "required": ["action"],
    },
}

def _run_cmd(cmd: list[str], cwd: str=None) -> str:
    import subprocess
    result = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True, check=True)
    return result.stdout

def _http_get(url: str, timeout: float=3.0) -> str:
    import urllib.request
    with urllib.request.urlopen(url, timeout=timeout) as response:
        return response.read()

def build_skills_explorer_html(catalog: list[dict], api_base: str='http://127.0.0.1:8765', dry_run: bool=True, output_path: str="skills_explorer.html") -> str:
    rows_html = "".join(
        f"<tr><td>{skill['skill_name']}</td><td>{skill['category']}</td>"
        f"<td><button onclick=\"runSkill('{skill['skill_name']}')\">Run</button></td></tr>"
        for skill in catalog
    )
    html_content = f"""
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Skills Explorer</title>
        <style>
            body {{ font-family: Arial, sans-serif; }}
            #search {{ margin-bottom: 10px; }}
            table {{ width: 100%; border-collapse: collapse; }}
            th, td {{ border: 1px solid #ddd; padding: 8px; }}
            th {{ background-color: #f2f2f2; }}
        </style>
    </head>
    <body>
        <input type="text" id="search" onkeyup="searchSkills()" placeholder="Search for skills...">
        <table id="skillsTable">
            <thead>
                <tr>
                    <th>Skill Name</th>
                    <th>Category</th>
                    <th>Action</th>
                </tr>
            </thead>
            <tbody>
                {rows_html}
            </tbody>
        </table>
        <script>
            function searchSkills() {{
                const input = document.getElementById('search').value.toLowerCase();
                const table = document.getElementById('skillsTable');
                const rows = table.getElementsByTagName('tr');
                for (let i = 1; i < rows.length; i++) {{
                    const cells = rows[i].getElementsByTagName('td');
                    let match = false;
                    for (let j = 0; j < cells.length; j++) {{
                        if (cells[j]) {{
                            const txtValue = cells[j].textContent || cells[j].innerText;
                            if (txtValue.toLowerCase().indexOf(input) > -1) {{
                                match = true;
                                break;
                            }}
                        }}
                    }}
                    rows[i].style.display = match ? '' : 'none';
                }}
            }}
            function runSkill(skillName) {{
                fetch('{api_base}/api/run?skill=' + encodeURIComponent(skillName), {{ method: 'POST' }})
                    .then(response => response.text())
                    .then(data => alert(data))
                    .catch(error => alert('Error: ' + error));
            }}
        </script>
    </body>
    </html>
    """
    if not dry_run:
        with open(output_path, "w") as f:
            f.write(html_content)
    return html_content

def build_monitor_cards_html(title: str, metrics_endpoint: str='/api/metrics', refresh_sec: int=10, dry_run: bool=True, output_path: str="monitor_cards.html") -> str:
    html_content = f"""
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>{title}</title>
        <style>
            body {{ font-family: Arial, sans-serif; }}
            .card {{ width: 300px; border: 1px solid #ddd; border-radius: 5px; padding: 16px; margin: 10px; display: inline-block; vertical-align: top; }}
            .card h3 {{ margin-top: 0; }}
        </style>
    </head>
    <body>
        <h1>{title}</h1>
        <div id="cards"></div>
        <script>
            function updateCards() {{
                fetch('{metrics_endpoint}')
                    .then(response => response.json())
                    .then(data => {{
                        const cardsDiv = document.getElementById('cards');
                        cardsDiv.innerHTML = '';
                        data.forEach(metric => {{
                            const card = document.createElement('div');
                            card.className = 'card';
                            card.innerHTML = `<h3>${{metric.name}}</h3><p>${{metric.value}}</p>`;
                            cardsDiv.appendChild(card);
                        }});
                    }})
                    .catch(error => console.error('Error fetching metrics:', error));
            }}
            setInterval(updateCards, {refresh_sec * 1000});
            updateCards();  // Initial call
        </script>
    </body>
    </html>
    """
    if not dry_run:
        with open(output_path, "w") as f:
            f.write(html_content)
    return html_content

def build_table_chart_page(title: str, columns: list[str], data_endpoint: str='/api/items', dry_run: bool=True, output_path: str="table_chart.html") -> str:
    headers_html = "".join(
        f'<th onclick="sortTable({i})">{col}</th>' for i, col in enumerate(columns)
    )
    cells_js = "".join(f"row.insertCell().textContent = item['{col}'];" for col in columns)
    html_content = f"""
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>{title}</title>
        <style>
            body {{ font-family: Arial, sans-serif; }}
            table {{ width: 100%; border-collapse: collapse; }}
            th, td {{ border: 1px solid #ddd; padding: 8px; }}
            th {{ background-color: #f2f2f2; cursor: pointer; }}
        </style>
    </head>
    <body>
        <h1>{title}</h1>
        <table id="dataTable">
            <thead>
                <tr>
                    {headers_html}
                </tr>
            </thead>
            <tbody>
                <!-- Data rows will be populated here -->
            </tbody>
        </table>
        <script>
            function sortTable(columnIndex) {{
                const table = document.getElementById('dataTable');
                const rows = Array.from(table.rows).slice(1);
                const isAscending = table.rows[0].cells[columnIndex].getAttribute('data-order') === 'asc';
                rows.sort((a, b) => {{
                    const aText = a.cells[columnIndex].textContent.trim();
                    const bText = b.cells[columnIndex].textContent.trim();
                    return isAscending ? aText.localeCompare(bText) : bText.localeCompare(aText);
                }});
                rows.forEach(row => table.tBodies[0].appendChild(row));
                table.rows[0].cells[columnIndex].setAttribute('data-order', isAscending ? 'desc' : 'asc');
            }}
            function updateTable() {{
                fetch('{data_endpoint}')
                    .then(response => response.json())
                    .then(data => {{
                        const tableBody = document.getElementById('dataTable').tBodies[0];
                        tableBody.innerHTML = '';
                        data.forEach(item => {{
                            const row = tableBody.insertRow();
                            {cells_js}
                        }});
                    }})
                    .catch(error => console.error('Error fetching data:', error));
            }}
            updateTable();  // Initial call
        </script>
    </body>
    </html>
    """
    if not dry_run:
        with open(output_path, "w") as f:
            f.write(html_content)
    return html_content

def execute(action: str, **kwargs) -> dict:
    if action not in TOOL_SCHEMA["parameters"]["properties"]["action"]["enum"]:
        return {"ok": False, "error": f"Unknown action: {action}"}
    
    if action == "build_skills_explorer_html":
        output_path = kwargs.pop("output_path", "skills_explorer.html")
        return {"ok": True, "html": build_skills_explorer_html(output_path=output_path, **kwargs)}
    elif action == "build_monitor_cards_html":
        output_path = kwargs.pop("output_path", "monitor_cards.html")
        return {"ok": True, "html": build_monitor_cards_html(output_path=output_path, **kwargs)}
    elif action == "build_table_chart_page":
        output_path = kwargs.pop("output_path", "table_chart.html")
        return {"ok": True, "html": build_table_chart_page(output_path=output_path, **kwargs)}
