import pytest
from unittest.mock import patch
from skill_url_normalizer_filter_pipeline import URLNormalizerFilterPipeline

# Mocking the URLNormalizer and URLFilter classes
class MockURLNormalizer:
    def normalize(self, url: str) -> str:
        if "invalid" in url:
            raise ValueError("Invalid URL")
        return url.rstrip('/')

class MockURLFilter:
    def __init__(self, allowed_domains: list[str]):
        self.allowed_domains = set(allowed_domains)

    def filter_urls(self, urls: list[str]) -> list[str]:
        return [url for url in urls if any(domain in url for domain in self.allowed_domains)]

@pytest.fixture
def pipeline():
    with patch('skill_url_normalizer_filter_pipeline.URLNormalizer', new=MockURLNormalizer):
        with patch('skill_url_normalizer_filter_pipeline.URLFilter', new=MockURLFilter):
            return URLNormalizerFilterPipeline(allowed_domains=['example.com', 'test.com'])

def test_process_happy_path(pipeline):
    urls = ['http://example.com/path/', 'https://test.com/path?query=1']
    expected = ['http://example.com/path', 'https://test.com/path?query=1']
    assert pipeline.process(urls) == expected

def test_process_invalid_url(pipeline):
    urls = ['http://invalid-url', 'https://example.com/path']
    expected = ['https://example.com/path']
    assert pipeline.process(urls) == expected

def test_process_no_urls(pipeline):
    urls = []
    expected = []
    assert pipeline.process(urls) == expected

def test_process_all_invalid_urls(pipeline):
    urls = ['http://invalid-url1', 'http://invalid-url2']
    expected = []
    assert pipeline.process(urls) == expected

def test_process_non_string_input(pipeline):
    urls = ['http://example.com/path', 123, 'https://test.com/path']
    with pytest.raises(ValueError):
        pipeline.process(urls)

def test_process_edge_case_with_port(pipeline):
    urls = ['http://example.com:8080/path/', 'https://test.com:8443/path?query=1']
    expected = ['http://example.com:8080/path', 'https://test.com:8443/path?query=1']
    assert pipeline.process(urls) == expected