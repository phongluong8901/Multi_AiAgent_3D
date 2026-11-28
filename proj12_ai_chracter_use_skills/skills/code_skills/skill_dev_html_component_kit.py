import html
import string
import json

TOOL_SCHEMA = {
    "name": "skill_dev_html_component_kit",
    "description": "Generate zero-build HTML/CSS/JS UI components for local AutoEvolve web dashboards: dynamic parameter form HTML derived from a TOOL_SCHEMA dict, a live log viewer panel, and a KPI summary grid. Sinh giao diện HTML CSS JS nâng cao, tự tạo form nhập tham số từ TOOL_SCHEMA, khung xem log realtime kiểu terminal và thẻ KPI biểu đồ.",
    "risk_level": "safe",
    "parameters": {
        "type": "object",
        "properties": {
            "action": {"type": "string", "enum": ["build_schema_form_html", "build_log_viewer_html", "build_kpi_cards_html"]},
        },
        "required": ["action"],
    },
}

def _run_cmd(cmd: list[str], cwd: str = None):
    import subprocess
    return subprocess.run(cmd, cwd=cwd, capture_output=True, text=True)

def _http_get(url: str, timeout: float = 3.0):
    import urllib.request
    with urllib.request.urlopen(url, timeout=timeout) as response:
        return response.read()

def build_schema_form_html(tool_schema: dict, submit_url: str = '/api/run') -> str:
    form_template = string.Template("""
    <form action="$submit_url" method="post">
        $fields
        <button type="submit">Submit</button>
    </form>
    """)
    fields = []
    for name, prop in tool_schema.get("properties", {}).items():
        field_template = string.Template('<label for="$name">$name:</label><input type="text" id="$name" name="$name"><br>')
        fields.append(field_template.substitute(name=name))
    return form_template.substitute(submit_url=html.escape(submit_url), fields='\n'.join(fields))

def build_log_viewer_html(title: str = 'Live Logs', poll_url: str = '/api/logs', interval_ms: int = 2000) -> str:
    log_viewer_template = string.Template("""
    <div>
        <h2>$title</h2>
        <pre id="log-content"></pre>
        <script>
            function fetchLogs() {
                fetch('$poll_url')
                    .then(response => response.text())
                    .then(data => {
                        document.getElementById('log-content').textContent = data;
                    });
            }
            setInterval(fetchLogs, $interval_ms);
            fetchLogs();
        </script>
    </div>
    """)
    return log_viewer_template.substitute(title=html.escape(title), poll_url=html.escape(poll_url), interval_ms=interval_ms)

def build_kpi_cards_html(cards: list[dict]) -> str:
    card_template = string.Template("""
    <div class="kpi-card">
        <h3>$title</h3>
        <p>$value</p>
    </div>
    """)
    cards_html = '\n'.join(card_template.substitute(title=html.escape(card.get('title', '')), value=html.escape(card.get('value', ''))) for card in cards)
    return f'<div class="kpi-grid">{cards_html}</div>'

def execute(action: str, **kwargs) -> dict:
    if action not in TOOL_SCHEMA["parameters"]["properties"]["action"]["enum"]:
        return {"ok": False, "error": f"Unknown action: {action}"}
    
    if action == "build_schema_form_html":
        tool_schema = kwargs.get("tool_schema", {})
        submit_url = kwargs.get("submit_url", "/api/run")
        return {"ok": True, "html": build_schema_form_html(tool_schema, submit_url)}
    
    if action == "build_log_viewer_html":
        title = kwargs.get("title", "Live Logs")
        poll_url = kwargs.get("poll_url", "/api/logs")
        interval_ms = kwargs.get("interval_ms", 2000)
        return {"ok": True, "html": build_log_viewer_html(title, poll_url, interval_ms)}
    
    if action == "build_kpi_cards_html":
        cards = kwargs.get("cards", [])
        return {"ok": True, "html": build_kpi_cards_html(cards)}
    
    return {"ok": False, "error": "Invalid action parameters"}
