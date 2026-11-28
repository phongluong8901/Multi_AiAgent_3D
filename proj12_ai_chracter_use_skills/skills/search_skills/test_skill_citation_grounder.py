import pytest
from unittest.mock import patch
from skill_citation_grounder import CitationGrounder

def test_build_context_happy_path():
    grounder = CitationGrounder()
    chunks = [
        {'text': 'First chunk', 'source': {'url': 'http://example.com/1', 'title': 'Example 1'}},
        {'text': 'Second chunk', 'source': {'url': 'http://example.com/2', 'title': 'Example 2'}}
    ]
    context, sources = grounder.build_context(chunks)
    assert context == 'First chunk [1] Second chunk [2]'
    assert len(sources) == 2

def test_build_context_duplicate_sources():
    grounder = CitationGrounder()
    chunks = [
        {'text': 'First chunk', 'source': {'url': 'http://example.com/1', 'title': 'Example 1'}},
        {'text': 'Second chunk', 'source': {'url': 'http://example.com/1', 'title': 'Example 1'}}
    ]
    context, sources = grounder.build_context(chunks)
    assert context == 'First chunk [1] Second chunk [1]'
    assert len(sources) == 1

def test_build_context_empty_chunks():
    grounder = CitationGrounder()
    chunks = []
    context, sources = grounder.build_context(chunks)
    assert context == ''
    assert len(sources) == 0

def test_format_references_happy_path():
    grounder = CitationGrounder()
    sources = [
        {'url': 'http://example.com/1', 'title': 'Example 1'},
        {'url': 'http://example.com/2', 'title': 'Example 2'}
    ]
    formatted = grounder.format_references(sources)
    assert formatted == '[1] Example 1. http://example.com/1\n[2] Example 2. http://example.com/2'

def test_format_references_missing_title_url():
    grounder = CitationGrounder()
    sources = [
        {'url': 'http://example.com/1'},
        {'title': 'Example 2'}
    ]
    formatted = grounder.format_references(sources)
    assert formatted == '[1] No Title. http://example.com/1\n[2] Example 2. No URL'

def test_detect_conflicts_happy_path():
    grounder = CitationGrounder()
    claims = [
        {'number': '1', 'date': '2023-01-01'},
        {'number': '2', 'date': '2023-01-02'},
        {'number': '1', 'date': '2023-01-03'}
    ]
    conflicts = grounder.detect_conflicts(claims)
    assert len(conflicts) == 1
    assert conflicts[0]['type'] == 'number'
    assert conflicts[0]['value'] == '1'

def test_detect_conflicts_numeric_date_mismatch():
    grounder = CitationGrounder()
    claims = [
        {'number': '1', 'date': '2023-01-01'},
        {'number': '1', 'date': '2023-01-02'}
    ]
    conflicts = grounder.detect_conflicts(claims)
    assert len(conflicts) == 1
    assert conflicts[0]['type'] == 'number'
    assert conflicts[0]['value'] == '1'
    assert conflicts[0]['claims'][0]['date'] == '2023-01-01'
    assert conflicts[0]['claims'][1]['date'] == '2023-01-02'
