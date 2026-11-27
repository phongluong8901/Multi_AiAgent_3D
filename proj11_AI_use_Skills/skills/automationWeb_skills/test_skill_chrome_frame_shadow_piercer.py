import pytest
import skill_chrome_frame_shadow_piercer as mod

def test_tool_schema():
    assert mod.TOOL_SCHEMA['name'] == 'skill_chrome_frame_shadow_piercer'
    assert mod.TOOL_SCHEMA['description'] == "xuyên iframe và Shadow DOM trên Chrome CDP, tìm phần tử bên trong iframe lồng nhau, đọc và bấm nút trong shadowRoot web hiện đại"
    assert mod.TOOL_SCHEMA['risk_level'] == "confirm"
    assert 'parameters' in mod.TOOL_SCHEMA

def test_unknown_action():
    result = mod.execute(action="unknown_action")
    assert result == {"ok": False, "error": "Unknown action"}

def test_build_shadow_pierce_js():
    js = mod.build_shadow_pierce_js(["#id", "shadowRoot", ".class"], action="click")
    assert "element.click();" in js

def test_parse_frame_tree():
    frames = [
        {"url": "http://example.com/frame1", "childFrames": [{"url": "http://example.com/frame2"}]},
        {"url": "http://example.com/frame3"}
    ]
    filtered_frames = mod.parse_frame_tree(frames, url_filter="frame2")
    assert len(filtered_frames) == 1
    assert filtered_frames[0]['url'] == "http://example.com/frame2"

def test_query_in_frame(monkeypatch):
    def mock_fetch_raw(url, data=None):
        if "json/protocol" in url:
            return {"result": {"value": "Sample Text"}}
        return [{"url": "http://example.com/frame1", "webSocketDebuggerUrl": "ws://example.com"}]
    
    monkeypatch.setattr(mod, "_fetch_raw", mock_fetch_raw)
    result = mod.query_in_frame(frame_url_contains="frame1", selector="#id>>shadowRoot>>.class", action="extract_text", dry_run=False)
    assert result == {"ok": True, "value": "Sample Text"}
