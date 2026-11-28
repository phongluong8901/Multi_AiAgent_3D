import pytest
from lxml import etree
from skill_sitemap_parser import SitemapParser, ParseError

def test_parse_sitemap_content_happy_path():
    content = """
    <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
        <url>
            <loc>http://example.com/page1</loc>
        </url>
        <url>
            <loc>http://example.com/page2</loc>
        </url>
    </urlset>
    """
    parser = SitemapParser()
    urls = parser.parse_sitemap_content(content)
    assert urls == ["http://example.com/page1", "http://example.com/page2"]

def test_parse_sitemap_content_no_loc_elements():
    content = """
    <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
        <url>
            <lastmod>2023-10-01</lastmod>
        </url>
    </urlset>
    """
    parser = SitemapParser()
    urls = parser.parse_sitemap_content(content)
    assert urls == []

def test_parse_sitemap_content_malformed_xml():
    content = """
    <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
        <url>
            <loc>http://example.com/page1</loc>
        <url>
    </urlset>
    """
    parser = SitemapParser()
    with pytest.raises(ParseError):
        parser.parse_sitemap_content(content)

def test_parse_sitemap_content_whitespace_urls():
    content = """
    <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
        <url>
            <loc>  http://example.com/page1  </loc>
        </url>
        <url>
            <loc>http://example.com/page2</loc>
        </url>
    </urlset>
    """
    parser = SitemapParser()
    urls = parser.parse_sitemap_content(content)
    assert urls == ["http://example.com/page1", "http://example.com/page2"]

def test_parse_sitemap_content_sitemap_index():
    content = """
    <sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
        <sitemap>
            <loc>http://example.com/sitemap1.xml</loc>
        </sitemap>
        <sitemap>
            <loc>http://example.com/sitemap2.xml</loc>
        </sitemap>
    </sitemapindex>
    """
    parser = SitemapParser()
    urls = parser.parse_sitemap_content(content)
    assert urls == ["http://example.com/sitemap1.xml", "http://example.com/sitemap2.xml"]

def test_parse_sitemap_content_empty_loc():
    content = """
    <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
        <url>
            <loc></loc>
        </url>
        <url>
            <loc>http://example.com/page2</loc>
        </url>
    </urlset>
    """
    parser = SitemapParser()
    urls = parser.parse_sitemap_content(content)
    assert urls == ["http://example.com/page2"]

def test_parse_sitemap_content_invalid_url():
    content = """
    <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
        <url>
            <loc>invalid-url</loc>
        </url>
        <url>
            <loc>http://example.com/page2</loc>
        </url>
    </urlset>
    """
    parser = SitemapParser()
    urls = parser.parse_sitemap_content(content)
    assert urls == ["invalid-url", "http://example.com/page2"]

def test_parse_sitemap_content_multiple_namespaces():
    content = """
    <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
        <url>
            <loc>http://example.com/page1</loc>
        </url>
        <url>
            <loc>http://example.com/page2</loc>
        </url>
    </urlset>
    """
    parser = SitemapParser()
    urls = parser.parse_sitemap_content(content)
    assert urls == ["http://example.com/page1", "http://example.com/page2"]
