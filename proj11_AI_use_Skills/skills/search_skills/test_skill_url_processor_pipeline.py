import pytest
from unittest.mock import patch
from skill_url_processor_pipeline import URLProcessorPipeline

@pytest.fixture
def url_processor():
    allowed_domains = ["example.com", "test.com"]
    return URLProcessorPipeline(allowed_domains)

def test_process_happy_path(url_processor):
    urls = [
        "http://example.com/path?query=1&another=2#fragment",
        "https://test.com/another-path"
    ]
    expected_output = [
        "http://example.com/path?another=2&query=1#fragment",
        "https://test.com/another-path"
    ]
    assert url_processor.process(urls) == expected_output

def test_process_normalize(url_processor):
    urls = [
        "HTTP://example.com/path?query=1&another=2#fragment",
        "https://test.com/another-path/"
    ]
    expected_output = [
        "http://example.com/path?another=2&query=1#fragment",
        "https://test.com/another-path"
    ]
    assert url_processor.process(urls) == expected_output

def test_process_filter(url_processor):
    urls = [
        "http://example.com/path",
        "https://notallowed.com/path",
        "https://test.com/another-path"
    ]
    expected_output = [
        "http://example.com/path",
        "https://test.com/another-path"
    ]
    assert url_processor.process(urls) == expected_output

def test_process_invalid_url(url_processor):
    urls = [
        "http://example.com/path",
        "invalid-url",
        "https://test.com/another-path"
    ]
    expected_output = [
        "http://example.com/path",
        "https://test.com/another-path"
    ]
    assert url_processor.process(urls) == expected_output

def test_process_empty_list(url_processor):
    urls = []
    expected_output = []
    assert url_processor.process(urls) == expected_output