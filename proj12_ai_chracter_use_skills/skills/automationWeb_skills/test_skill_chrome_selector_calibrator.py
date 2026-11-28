import pytest
import skill_chrome_selector_calibrator as mod
from unittest.mock import patch

def test_tool_schema():
    assert mod.TOOL_SCHEMA['name'] == 'skill_chrome_selector_calibrator'
    assert 'description' in mod.TOOL_SCHEMA
    assert mod.TOOL_SCHEMA['risk_level'] == 'safe'
    assert 'parameters' in mod.TOOL_SCHEMA

def test_unknown_action():
    result = mod.execute(action="unknown_action")
    assert result == {"ok": False, "error": "Unknown action: unknown_action"}

def test_load_selector_profile(tmp_path):
    config_path = tmp_path / "web_selectors.json"
    config_path.write_text('{"zalo": {"button": ".zalo-button"}}')
    result = mod.execute(action="load_selector_profile", app_name="zalo", config_path=str(config_path))
    assert result == {"ok": True, "selectors": {"button": ".zalo-button"}}

def test_save_selector_profile(tmp_path):
    config_path = tmp_path / "web_selectors.json"
    result = mod.execute(action="save_selector_profile", app_name="zalo", selectors={"button": ".zalo-button"}, config_path=str(config_path))
    assert result == {"ok": True}
    expected_content = '''{
    "zalo": {
        "button": ".zalo-button"
    }
}'''
    assert config_path.read_text() == expected_content

def test_calibrate_from_dom():
    html = '<div data-testid="send" aria-label="Send message" role="button">Send</div>'
    result = mod.execute(action="calibrate_from_dom", app_name="zalo", html=html, target_slots=["send", "compose"])
    assert result == {"ok": True, "discovered_selectors": {"send": "[data-testid='send']"}}

def test_calibrate_from_dom_missing_beautifulsoup():
    with patch.dict('sys.modules', {'bs4': None}):
        result = mod.execute(action="calibrate_from_dom", app_name="zalo", html="", target_slots=[])
        assert result == {"ok": False, "error": "Missing package BeautifulSoup4"}
