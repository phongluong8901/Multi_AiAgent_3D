import pytest
import skill_web_link_seo_auditor as mod
from unittest.mock import MagicMock

@pytest.fixture
def sample_html():
    return """
    <html>
        <head>
            <title>Sample Page</title>
            <meta name="description" content="This is a sample page">
            <link rel="canonical" href="https://example.com">
            <meta property="og:title" content="Sample Page">
            <meta property="og:description" content="This is a sample page">
        </head>
        <body>
            <h1>Main Heading</h1>
            <h2>Sub Heading 1</h2>
            <h2>Sub Heading 2</h2>
            <a href="/about">About</a>
            <img src="image.jpg">
        </body>
    </html>
    """

def test_tool_schema():
    assert mod.TOOL_SCHEMA['name'] == 'skill_web_link_seo_auditor'
    assert 'description' in mod.TOOL_SCHEMA
    assert mod.TOOL_SCHEMA['risk_level'] == 'safe'
    assert 'parameters' in mod.TOOL_SCHEMA

def test_unknown_action():
    result = mod.execute(action="unknown_action")
    assert not result["ok"]
    assert "Unknown action" in result["error"]

def test_audit_html_seo(sample_html):
    result = mod.audit_html_seo(sample_html, base_url="https://example.com")
    assert result["ok"]
    assert result["data"]["title"] == "Sample Page"
    assert result["data"]["meta_description"] == "This is a sample page"
    assert result["data"]["canonical"] == "https://example.com"
    assert result["data"]["og_tags"]["og:title"] == "Sample Page"
    assert result["data"]["h1_count"] == 1
    assert result["data"]["h2_count"] == 2
    assert result["data"]["h3_count"] == 0
    assert result["data"]["missing_alt_tags"] == ["image.jpg"]

def test_extract_all_links(sample_html):
    result = mod.extract_all_links(sample_html, base_url="https://example.com")
    assert result["ok"]
    assert result["data"] == ["https://example.com/about"]

def test_check_links_status(monkeypatch):
    mock_fetch_raw = MagicMock(side_effect=[200, 404])
    monkeypatch.setattr(mod, "_fetch_raw", mock_fetch_raw)
    result = mod.check_links_status(["https://example.com", "https://broken.com"])
    assert result["ok"]
    assert result["data"] == {"https://example.com": 200, "https://broken.com": 404}
