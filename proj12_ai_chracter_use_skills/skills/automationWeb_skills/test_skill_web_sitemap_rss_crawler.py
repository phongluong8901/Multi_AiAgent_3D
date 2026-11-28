import pytest
from skill_web_sitemap_rss_crawler import execute, TOOL_SCHEMA

def test_tool_schema():
    assert TOOL_SCHEMA["name"] == "skill_web_sitemap_rss_crawler"
    assert TOOL_SCHEMA["risk_level"] == "safe"
    assert "parse_robots_txt" in TOOL_SCHEMA["parameters"]["action"]

def test_unknown_action():
    result = execute(action="unknown_action")
    assert not result["ok"]
    assert "Unknown action" in result["error"]

def test_parse_robots_txt(tmp_path):
    robots_txt_content = "User-agent: *\nDisallow: /admin/\nAllow: /"
    file_path = tmp_path / "robots.txt"
    file_path.write_text(robots_txt_content)
    with open(file_path, 'r') as file:
        result = execute(action="parse_robots_txt", content=file.read())
    assert result["ok"]
    assert result["rules"] == {"/admin/": False, "/": True}

def test_parse_sitemap_xml(tmp_path):
    sitemap_xml_content = """<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
        <url><loc>http://example.com/page1</loc></url>
        <url><loc>http://example.com/page2</loc></url>
    </urlset>"""
    file_path = tmp_path / "sitemap.xml"
    file_path.write_text(sitemap_xml_content)
    with open(file_path, 'r') as file:
        result = execute(action="parse_sitemap_xml", xml_text=file.read(), keyword="page1")
    assert result["ok"]
    assert result["urls"] == ["http://example.com/page1"]

def test_parse_rss_atom(tmp_path):
    rss_atom_content = """<feed xmlns="http://www.w3.org/2005/Atom">
        <entry><title>News Article 1</title></entry>
        <entry><title>News Article 2</title></entry>
    </feed>"""
    file_path = tmp_path / "rss.xml"
    file_path.write_text(rss_atom_content)
    with open(file_path, 'r') as file:
        result = execute(action="parse_rss_atom", xml_text=file.read(), keyword="Article 1")
    assert result["ok"]
    assert result["articles"] == ["News Article 1"]
