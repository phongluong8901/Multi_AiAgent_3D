import skill_dev_design_system_kit as mod
import pytest

def test_tool_schema_actions():
    actions = mod.TOOL_SCHEMA["parameters"]["properties"]["action"]["enum"]
    assert set(actions) == {"build_bento_dashboard_html", "build_chart_panel_html", "build_sidebar_shell_html"}

def test_unknown_action():
    result = mod.execute("unknown_action")
    assert result == {"ok": False, "error": "Unknown action: unknown_action"}

def test_build_bento_dashboard_html(tmp_path):
    title = "Dashboard Title"
    cards = [{"title": "Card 1", "content": "Content 1"}, {"title": "Card 2", "content": "Content 2"}]
    result = mod.execute("build_bento_dashboard_html", title=title, cards=cards, theme="dark")
    assert result["ok"]
    assert title in result["html"]
    assert "Card 1" in result["html"]
    assert "Content 1" in result["html"]
    assert "Card 2" in result["html"]
    assert "Content 2" in result["html"]

def test_build_chart_panel_html(tmp_path):
    chart_id = "chart1"
    title = "Chart Title"
    result = mod.execute("build_chart_panel_html", chart_id=chart_id, title=title, chart_type="bar", data_endpoint="/api/data")
    assert result["ok"]
    assert chart_id in result["html"]
    assert title in result["html"]
    assert "bar" in result["html"]
    assert "/api/data" in result["html"]

def test_build_sidebar_shell_html(tmp_path):
    app_name = "My App"
    nav_items = [{"label": "Home", "url": "/"}, {"label": "About", "url": "/about"}]
    content_html = "<p>Welcome to My App</p>"
    result = mod.execute("build_sidebar_shell_html", app_name=app_name, nav_items=nav_items, content_html=content_html)
    assert result["ok"]
    assert app_name in result["html"]
    assert "Home" in result["html"]
    assert "/" in result["html"]
    assert "About" in result["html"]
    assert "/about" in result["html"]
    assert content_html in result["html"]
