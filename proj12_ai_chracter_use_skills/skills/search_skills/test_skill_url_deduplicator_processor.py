import pytest
from unittest.mock import MagicMock
from skill_url_deduplicator_processor import URLDeduplicatorProcessor

@pytest.fixture
def url_deduplicator():
    allowed_domains = ["example.com", "test.com"]
    return URLDeduplicatorProcessor(allowed_domains)

def test_process_happy_path(url_deduplicator):
    urls = [
        "http://example.com/path?query=1&query=2",
        "http://example.com/path?query=2&query=1",
        "http://test.com/path",
        "http://example.com/path"
    ]
    expected_output = [
        "http://example.com/path?query=1&query=2",
        "http://test.com/path",
        "http://example.com/path"
    ]
    assert url_deduplicator.process(urls) == expected_output

def test_process_with_invalid_urls(url_deduplicator):
    urls = [
        "http://example.com/path",
        "invalid-url",
        "ftp://example.com/path",
        "http://example.com/path"
    ]
    expected_output = [
        "http://example.com/path",
        "ftp://example.com/path"
    ]
    assert url_deduplicator.process(urls) == expected_output

def test_process_with_no_urls(url_deduplicator):
    urls = []
    expected_output = []
    assert url_deduplicator.process(urls) == expected_output

def test_process_with_all_invalid_urls(url_deduplicator):
    urls = [
        "invalid-url",
        "ftp://example.com/path",
        "http://notallowed.com/path"
    ]
    expected_output = [
        "ftp://example.com/path"
    ]
    assert url_deduplicator.process(urls) == expected_output

def test_process_with_duplicate_urls(url_deduplicator):
    urls = [
        "http://example.com/path",
        "http://example.com/path",
        "http://example.com/path"
    ]
    expected_output = [
        "http://example.com/path"
    ]
    assert url_deduplicator.process(urls) == expected_output