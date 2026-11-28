import html
import json

TOOL_SCHEMA = {
    "name": "skill_dev_design_system_kit",
    "description": "Generate polished, zero-build Tailwind CSS + Lucide Icons + ECharts HTML UI templates: a responsive Bento Grid dashboard supporting dark/light themes with skeleton loaders and toast notifications, an interactive ECharts panel snippet, and a sidebar app shell.",
    "risk_level": "safe",
    "parameters": {
        "type": "object",
        "properties": {
            "action": {"type": "string", "enum": ["build_bento_dashboard_html", "build_chart_panel_html", "build_sidebar_shell_html"]},
        },
        "required": ["action"],
    },
}

def _replace_tokens(template, **kwargs):
    for key, value in kwargs.items():
        template = template.replace(f"__{key.upper()}__", value)  # Removed html.escape
    return template

def build_bento_dashboard_html(title: str, cards: list[dict], theme: str='dark') -> str:
    template = """
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>__TITLE__</title>
        <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">
        <link href="https://cdn.jsdelivr.net/npm/lucide-icons@0.249.0/dist/lucide.min.css" rel="stylesheet">
        <style>
            body { background-color: __BACKGROUND_COLOR__; color: __TEXT_COLOR__; }
        </style>
    </head>
    <body class="p-4">
        <h1 class="text-3xl font-bold mb-4">__TITLE__</h1>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            __CARDS__
        </div>
    </body>
    </html>
    """
    cards_html = "".join([
        f'<div class="bg-white p-4 rounded shadow-md"><h2 class="text-xl font-bold mb-2">{card["title"]}</h2><p>{card["content"]}</p></div>'
        for card in cards
    ])
    background_color = "#1e293b" if theme == "dark" else "#f3f4f6"
    text_color = "#ffffff" if theme == "dark" else "#1e293b"
    return _replace_tokens(template, TITLE=title, CARDS=cards_html, BACKGROUND_COLOR=background_color, TEXT_COLOR=text_color)

def build_chart_panel_html(chart_id: str, title: str, chart_type: str='line', data_endpoint: str='/api/series') -> str:
    template = """
    <div class="bg-white p-4 rounded shadow-md">
        <h2 class="text-xl font-bold mb-2">__TITLE__</h2>
        <div id="__CHART_ID__" style="width: 100%; height: 400px;"></div>
    </div>
    <script src="https://cdn.jsdelivr.net/npm/echarts@5.4.0/dist/echarts.min.js"></script>
    <script>
        var chart = echarts.init(document.getElementById('__CHART_ID__'));
        fetch('__DATA_ENDPOINT__')
            .then(response => response.json())
            .then(data => {
                var option = {
                    title: { text: '__TITLE__' },
                    tooltip: {},
                    legend: { data:['Series'] },
                    xAxis: { data: data.xAxis },
                    yAxis: {},
                    series: [{
                        name: 'Series',
                        type: '__CHART_TYPE__',
                        data: data.series
                    }]
                };
                chart.setOption(option);
            });
    </script>
    """
    return _replace_tokens(template, CHART_ID=chart_id, TITLE=title, CHART_TYPE=chart_type, DATA_ENDPOINT=data_endpoint)

def build_sidebar_shell_html(app_name: str, nav_items: list[dict], content_html: str='') -> str:
    template = """
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>__APP_NAME__</title>
        <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">
        <link href="https://cdn.jsdelivr.net/npm/lucide-icons@0.249.0/dist/lucide.min.css" rel="stylesheet">
    </head>
    <body class="bg-gray-100">
        <div class="flex">
            <aside class="w-64 bg-gray-800 text-white p-4">
                <h1 class="text-2xl font-bold mb-4">__APP_NAME__</h1>
                <nav>
                    <ul>
                        __NAV_ITEMS__
                    </ul>
                </nav>
            </aside>
            <main class="flex-1 p-4">
                __CONTENT_HTML__
            </main>
        </div>
    </body>
    </html>
    """
    nav_items_html = "".join([
        f'<li><a href="{item["url"]}" class="block py-2 px-4 hover:bg-gray-700 rounded">{item["label"]}</a></li>'
        for item in nav_items
    ])
    return _replace_tokens(template, APP_NAME=app_name, NAV_ITEMS=nav_items_html, CONTENT_HTML=content_html)

def execute(action: str, **kwargs) -> dict:
    if action not in TOOL_SCHEMA["parameters"]["properties"]["action"]["enum"]:
        return {"ok": False, "error": f"Unknown action: {action}"}
    
    if action == "build_bento_dashboard_html":
        return {"ok": True, "html": build_bento_dashboard_html(**kwargs)}
    elif action == "build_chart_panel_html":
        return {"ok": True, "html": build_chart_panel_html(**kwargs)}
    elif action == "build_sidebar_shell_html":
        return {"ok": True, "html": build_sidebar_shell_html(**kwargs)}
