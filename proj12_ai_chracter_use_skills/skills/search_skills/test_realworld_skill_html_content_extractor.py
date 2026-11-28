import pytest
from skill_html_content_extractor import HTMLContentExtractor
from urllib.parse import urljoin

def test_extract_links_filters_invalid():
    html = """
    <a href="#">Skip</a>
    <a href="javascript:alert('hi')">Click me</a>
    <a href="mailto:contact@example.com">Email</a>
    <a href="/about">About</a>
    <a href="tel:+1234567890">Call</a>
    """
    extractor = HTMLContentExtractor(html)
    assert extractor.extract_links() == ["/about"]

def test_extract_links_with_base_url():
    html = """
    <a href="/about">About</a>
    <a href="/about">Another About</a>
    <a href="/contact">Contact</a>
    """
    base_url = "https://example.com"
    expected = [
        urljoin(base_url, "/about"),
        urljoin(base_url, "/contact")
    ]
    extractor = HTMLContentExtractor(html)
    assert extractor.extract_links(base_url=base_url) == expected

def test_extract_text_excludes_script_and_style():
    html = """
    <p>Main content</p>
    <script>var x = 1;</script>
    <div>Some text</div>
    <style>body { background: white; }</style>
    <div>More text</div>
    """
    extractor = HTMLContentExtractor(html)
    expected_text = "Main content\nSome text\nMore text"
    assert extractor.extract_text() == expected_text

def test_extract_links_with_absolute_url():
    html = '<a href="https://example.com/page">External</a>'
    base_url = "https://base.com"
    extractor = HTMLContentExtractor(html)
    assert extractor.extract_links(base_url=base_url) == ["https://example.com/page"]

def test_extract_links_with_whitespace():
    html = '<a href="   "></a><a href="  # "></a>'
    extractor = HTMLContentExtractor(html)
    assert extractor.extract_links() == []

def test_extract_links_duplicate_order():
    html = """
    <a href="/a">A</a>
    <a href="/b">B</a>
    <a href="/a">A again</a>
    """
    base_url = "https://example.com"
    expected = [
        urljoin(base_url, "/a"),
        urljoin(base_url, "/b")
    ]
    extractor = HTMLContentExtractor(html)
    assert extractor.extract_links(base_url=base_url) == expected