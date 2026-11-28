import pytest
from skill_chrome_dom_selector_finder import execute, TOOL_SCHEMA

def test_tool_schema():
    assert TOOL_SCHEMA["name"] == "skill_chrome_dom_selector_finder"
    assert TOOL_SCHEMA["description"] == "Parse HTML snippets or DOM dumps to rank and generate stable CSS selectors for interactive elements matching a human query."
    assert TOOL_SCHEMA["risk_level"] == "safe"
    assert TOOL_SCHEMA["parameters"] == {
        "action": "extract_interactive_elements, find_best_selector, build_css_selector",
        "html": "HTML snippet or DOM dump as a string",
        "query": "Human query to match interactive elements",
        "tag_filter": "Optional tag filter for find_best_selector"
    }

def test_unknown_action():
    result = execute(action="unknown_action")
    assert result == {"ok": False, "error": "Unknown action"}

def test_extract_interactive_elements(tmp_path):
    html_content = """
    <html>
        <body>
            <button id="submit-btn" data-testid="submit">Submit</button>
            <input type="text" name="username" placeholder="Enter username">
            <a href="/logout">Logout</a>
        </body>
    </html>
    """
    result = execute(action="extract_interactive_elements", html=html_content)
    assert result["ok"] is True
    assert len(result["elements"]) == 3
    assert result["elements"][0] == {"tag": "button", "attrs": {"id": "submit-btn", "data-testid": "submit"}, "text": "Submit"}
    assert result["elements"][1] == {"tag": "input", "attrs": {"type": "text", "name": "username", "placeholder": "Enter username"}, "text": ""}
    assert result["elements"][2] == {"tag": "a", "attrs": {"href": "/logout"}, "text": "Logout"}

def test_find_best_selector(tmp_path):
    html_content = """
    <html>
        <body>
            <button id="submit-btn" data-testid="submit">Submit</button>
            <input type="text" name="username" placeholder="Enter username">
            <a href="/logout">Logout</a>
        </body>
    </html>
    """
    result = execute(action="find_best_selector", html=html_content, query="Submit")
    assert result["ok"] is True
    assert result["best_selector"] == "button[id='submit-btn']"

def test_build_css_selector(monkeypatch):
    def mock_build_css_selector(attrs, tag):
        return {"ok": True, "selector": f"{tag}[id='mock-id']"}
    
    monkeypatch.setattr("skill_chrome_dom_selector_finder.build_css_selector", mock_build_css_selector)
    result = execute(action="build_css_selector", attrs={"id": "mock-id"}, tag="button")
    assert result["ok"] is True
    assert result["selector"] == "button[id='mock-id']"
