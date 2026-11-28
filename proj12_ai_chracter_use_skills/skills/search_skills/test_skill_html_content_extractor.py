import pytest
from skill_html_content_extractor import HTMLContentExtractor

# Test cases for HTMLContentExtractor class

def test_extract_text_happy_path():
    html_content = "<html><body><p>Hello, World!</p></body></html>"
    extractor = HTMLContentExtractor(html_content)
    assert extractor.extract_text() == "Hello, World!"

def test_extract_text_no_text():
    html_content = "<html><body></body></html>"
    extractor = HTMLContentExtractor(html_content)
    assert extractor.extract_text() == ""

def test_extract_text_with_tags():
    html_content = "<html><body><p>Line 1</p><p>Line 2</p></body></html>"
    extractor = HTMLContentExtractor(html_content)
    assert extractor.extract_text() == "Line 1\nLine 2"

def test_extract_links_happy_path():
    html_content = "<html><body><a href='http://example.com'>Example</a><a href='http://test.com'>Test</a></body></html>"
    extractor = HTMLContentExtractor(html_content)
    assert extractor.extract_links() == ['http://example.com', 'http://test.com']

def test_extract_links_no_links():
    html_content = "<html><body><p>No links here</p></body></html>"
    extractor = HTMLContentExtractor(html_content)
    assert extractor.extract_links() == []

def test_extract_links_with_relative_urls():
    html_content = "<html><body><a href='/about'>About</a><a href='/contact'>Contact</a></body></html>"
    extractor = HTMLContentExtractor(html_content)
    assert extractor.extract_links() == ['/about', '/contact']