import pytest
from unittest.mock import patch
from skill_local_crawl_cache import LocalCrawlCache

@pytest.fixture
def cache():
    return LocalCrawlCache(db_path=':memory:')

def test_set_and_get(cache):
    url = 'http://example.com'
    content = 'Example content'
    cache.set(url, content)
    result = cache.get(url)
    assert result['content'] == content
    assert result['status_code'] == 200

def test_expired_entry_returns_none(cache):
    url = 'http://example.com'
    content = 'Example content'
    cache.set(url, content, ttl=-1)
    assert cache.get(url) is None

def test_in_memory_db(cache):
    url = 'http://example.com'
    content = 'Example content'
    cache.set(url, content)
    result = cache.get(url)
    assert result['content'] == content

def test_overwrite_existing_url(cache):
    url = 'http://example.com'
    content1 = 'Example content 1'
    content2 = 'Example content 2'
    cache.set(url, content1)
    cache.set(url, content2)
    result = cache.get(url)
    assert result['content'] == content2

def test_zero_ttl(cache):
    url = 'http://example.com'
    content = 'Example content'
    cache.set(url, content, ttl=0)
    assert cache.get(url) is None

def test_negative_ttl(cache):
    url = 'http://example.com'
    content = 'Example content'
    cache.set(url, content, ttl=-1)
    assert cache.get(url) is None

def test_purge_expired(cache):
    url1 = 'http://example.com/1'
    url2 = 'http://example.com/2'
    content1 = 'Example content 1'
    content2 = 'Example content 2'
    cache.set(url1, content1, ttl=-1)
    cache.set(url2, content2)
    purged_count = cache.purge_expired()
    assert purged_count == 1
    assert cache.get(url1) is None
    assert cache.get(url2) is not None

def test_stats(cache):
    url1 = 'http://example.com/1'
    url2 = 'http://example.com/2'
    content1 = 'Example content 1'
    content2 = 'Example content 2'
    cache.set(url1, content1, ttl=-1)
    cache.set(url2, content2)
    stats = cache.stats()
    assert stats['total_entries'] == 2
    assert stats['expired_entries'] == 1
    cache.purge_expired()
    stats = cache.stats()
    assert stats['total_entries'] == 1
    assert stats['expired_entries'] == 0
