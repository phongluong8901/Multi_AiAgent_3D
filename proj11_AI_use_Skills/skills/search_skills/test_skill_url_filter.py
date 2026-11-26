import pytest
from unittest.mock import patch
from skill_url_filter import URLFilter
from skill_url_normalizer import URLNormalizer

@pytest.fixture
def url_filter():
    allowed_domains = ["example.com", "test.com"]
    return URLFilter(allowed_domains)

def test_is_allowed_happy_path(url_filter):
    assert url_filter.is_allowed("http://example.com/path") is True

def test_is_allowed_edge_case_subdomain(url_filter):
    assert url_filter.is_allowed("http://sub.example.com/path") is False

def test_is_allowed_edge_case_https(url_filter):
    assert url_filter.is_allowed("https://test.com/path") is True

def test_is_allowed_exception_invalid_url(url_filter):
    with patch.object(URLNormalizer, 'normalize', side_effect=ValueError("Invalid URL")):
        assert url_filter.is_allowed("invalid-url") is False

def test_filter_urls_happy_path(url_filter):
    urls = ["http://example.com/path1", "http://test.com/path2", "http://notallowed.com/path3"]
    assert url_filter.filter_urls(urls) == ["http://example.com/path1", "http://test.com/path2"]

def test_filter_urls_edge_case_empty_list(url_filter):
    assert url_filter.filter_urls([]) == []