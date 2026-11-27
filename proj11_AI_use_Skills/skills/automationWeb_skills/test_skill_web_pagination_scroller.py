import pytest
import skill_web_pagination_scroller as mod

def test_tool_schema():
    assert mod.TOOL_SCHEMA['name'] == 'skill_web_pagination_scroller'
    assert mod.TOOL_SCHEMA['risk_level'] == 'safe'
    assert 'template_url' in mod.TOOL_SCHEMA['parameters']

def test_unknown_action():
    result = mod.execute(action="unknown_action")
    assert not result["ok"]
    assert "Unknown action" in result["error"]

def test_build_paginated_urls(tmp_path):
    result = mod.execute(action="build_paginated_urls", template_url="http://example.com/page={page}", start_page=1, end_page=3)
    assert result["ok"]
    assert result["urls"] == ["http://example.com/page=1", "http://example.com/page=2", "http://example.com/page=3"]

def test_find_next_page_url(tmp_path):
    html_content = '<a href="/next-page" class="next">Next</a>'
    result = mod.execute(action="find_next_page_url", html=html_content, current_url="http://example.com")
    assert result["ok"]
    assert result["next_url"] == "http://example.com/next-page"

def test_deduplicate_records(tmp_path):
    records = [{"url": "http://example.com/1"}, {"url": "http://example.com/2"}, {"url": "http://example.com/1"}]
    result = mod.execute(action="deduplicate_records", records=records, key_field="url")
    assert result["ok"]
    assert len(result["deduplicated_records"]) == 2
    assert result["deduplicated_records"] == [{"url": "http://example.com/1"}, {"url": "http://example.com/2"}]

def test_scroll_collect_plan(monkeypatch):
    def mock_scroll(*args, **kwargs):
        return {"ok": True, "message": "Mocked scroll"}

    monkeypatch.setattr(mod, "scroll_collect_plan", mock_scroll)
    result = mod.execute(action="scroll_collect_plan", max_scrolls=3, delay_ms=500, dry_run=False)
    assert result["ok"]
    assert result["message"] == "Mocked scroll"
