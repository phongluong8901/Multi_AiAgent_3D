import skill_dev_rss_digest_builder as mod
import pytest
from pathlib import Path

RSS_XML = """<rss version="2.0">
<channel>
    <title>Example RSS Feed</title>
    <link>http://www.example.com</link>
    <description>This is an example RSS feed</description>
    <item>
        <title>News Item 1</title>
        <link>http://www.example.com/news1</link>
        <description>Description of news item 1</description>
    </item>
    <item>
        <title>News Item 2</title>
        <link>http://www.example.com/news2</link>
        <description>Description of news item 2</description>
    </item>
</channel>
</rss>"""

ATOM_XML = """<feed xmlns="http://www.w3.org/2005/Atom">
<title>Example Atom Feed</title>
<link href="http://www.example.com"/>
<id>urn:uuid:60a76c80-d399-11d9-b93C-0003939e0af6</id>
<updated>2003-12-13T18:30:02Z</updated>
<entry>
    <title>Atom Entry 1</title>
    <link href="http://www.example.com/entry1"/>
    <id>urn:uuid:1225c695-cfb8-4ebb-aaaa-80da344efa6a</id>
    <updated>2003-12-13T18:30:02Z</updated>
    <summary>Summary of Atom entry 1</summary>
</entry>
<entry>
    <title>Atom Entry 2</title>
    <link href="http://www.example.com/entry2"/>
    <id>urn:uuid:1225c695-cfb8-4ebb-aaaa-80da344efa6b</id>
    <updated>2003-12-13T18:30:02Z</updated>
    <summary>Summary of Atom entry 2</summary>
</entry>
</feed>"""

def test_tool_schema_actions():
    actions = mod.TOOL_SCHEMA["parameters"]["properties"]["action"]["enum"]
    assert "parse_rss_atom_xml" in actions
    assert "render_daily_digest" in actions
    assert "generate_digest_app" in actions

def test_unknown_action():
    result = mod.execute("unknown_action")
    assert not result["ok"]
    assert "Unknown action" in result["error"]

def test_parse_rss_atom_xml(tmp_path, monkeypatch):
    def mock_run_cmd(cmd, cwd=None):
        return RSS_XML if "rss" in cmd else ATOM_XML

    monkeypatch.setattr(mod, "_run_cmd", mock_run_cmd)
    result = mod.execute("parse_rss_atom_xml", xml_text=RSS_XML)
    assert result["ok"]
    assert len(result["result"]) == 2

    result = mod.execute("parse_rss_atom_xml", xml_text=ATOM_XML)
    assert result["ok"]
    assert len(result["result"]) == 2

def test_render_daily_digest(tmp_path):
    sections = [
        {
            "title": "RSS Feed",
            "items": [
                {"title": "News Item 1", "link": "http://www.example.com/news1", "description": "Description of news item 1"},
                {"title": "News Item 2", "link": "http://www.example.com/news2", "description": "Description of news item 2"},
            ],
        },
        {
            "title": "Atom Feed",
            "items": [
                {"title": "Atom Entry 1", "link": "http://www.example.com/entry1", "description": "Summary of Atom entry 1"},
                {"title": "Atom Entry 2", "link": "http://www.example.com/entry2", "description": "Summary of Atom entry 2"},
            ],
        },
    ]
    result = mod.execute("render_daily_digest", title="Daily Digest", sections=sections, fmt="markdown")
    assert result["ok"]
    assert "# Daily Digest" in result["result"]
    assert "## RSS Feed" in result["result"]
    assert "## Atom Feed" in result["result"]

    result = mod.execute("render_daily_digest", title="Daily Digest", sections=sections, fmt="html")
    assert result["ok"]
    assert "<h1>Daily Digest</h1>" in result["result"]
    assert "<h2>RSS Feed</h2>" in result["result"]
    assert "<h2>Atom Feed</h2>" in result["result"]

def test_generate_digest_app(tmp_path):
    feeds = [RSS_XML, ATOM_XML]
    result = mod.execute("generate_digest_app", feeds=feeds, output_dir=str(tmp_path), dry_run=True)
    assert result["ok"]
    assert "Digest app generated" in result["result"]

    result = mod.execute("generate_digest_app", feeds=feeds, output_dir=str(tmp_path), dry_run=False)
    assert result["ok"]
    assert "Digest app generated" in result["result"]
    assert (tmp_path / "daily_digest.md").exists()
