import pytest
from unittest.mock import patch
from skill_page_metadata_extractor import PageMetadataExtractor

@pytest.fixture
def extractor():
    return PageMetadataExtractor()

def test_extract_title(extractor):
    html = "<html><head><title>Test Title</title></head></html>"
    assert extractor.extract(html)['title'] == "Test Title"

def test_extract_description(extractor):
    html = "<html><head><meta name='description' content='Test Description'></head></html>"
    assert extractor.extract(html)['description'] == "Test Description"

def test_extract_canonical_url_absolute(extractor):
    html = "<html><head><link rel='canonical' href='https://example.com/page'></head></html>"
    assert extractor.extract(html)['canonical_url'] == "https://example.com/page"

def test_extract_canonical_url_relative(extractor):
    html = "<html><head><link rel='canonical' href='/page'></head></html>"
    assert extractor.extract(html, 'https://example.com')['canonical_url'] == "https://example.com/page"

def test_extract_author(extractor):
    html = "<html><head><meta name='author' content='John Doe'></head></html>"
    assert extractor.extract(html)['author'] == "John Doe"

def test_extract_published_at(extractor):
    html = "<html><head><meta property='article:published_time' content='2023-10-01T12:00:00Z'></head></html>"
    assert extractor.extract(html)['published_at'] == "2023-10-01T12:00:00+00:00"

def test_extract_modified_at(extractor):
    html = "<html><head><meta property='article:modified_time' content='2023-10-02T12:00:00Z'></head></html>"
    assert extractor.extract(html)['modified_at'] == "2023-10-02T12:00:00+00:00"

def test_extract_json_ld_valid(extractor):
    html = "<html><head><script type='application/ld+json'>{\"@context\": \"http://schema.org\", \"@type\": \"Article\"}</script></head></html>"
    assert extractor.extract(html)['json_ld'] == {"@context": "http://schema.org", "@type": "Article"}

def test_extract_json_ld_invalid(extractor):
    html = "<html><head><script type='application/ld+json'>{invalid json}</script></head></html>"
    assert extractor.extract(html)['json_ld'] is None

def test_extract_open_graph(extractor):
    html = "<html><head><meta property='og:title' content='Test OG Title'><meta property='og:description' content='Test OG Description'></head></html>"
    assert extractor.extract(html)['og'] == {"title": "Test OG Title", "description": "Test OG Description"}
