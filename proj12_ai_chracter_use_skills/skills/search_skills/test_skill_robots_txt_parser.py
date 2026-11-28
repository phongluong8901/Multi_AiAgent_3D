import pytest
from unittest.mock import patch
from skill_robots_txt_parser import RobotsTxtChecker
import re
import httpx

@pytest.fixture
def robots_txt_checker():
    return RobotsTxtChecker(user_agent='MyBot')

def test_fetch_robots_txt_success(robots_txt_checker):
    with patch('httpx.get') as mock_get:
        mock_get.return_value.status_code = 200
        mock_get.return_value.text = "User-agent: *\nDisallow: /private/\nCrawl-delay: 10"
        content = robots_txt_checker.fetch_robots_txt('http://example.com')
        assert content == "User-agent: *\nDisallow: /private/\nCrawl-delay: 10"

def test_fetch_robots_txt_failure(robots_txt_checker):
    with patch('httpx.get') as mock_get:
        mock_get.side_effect = httpx.RequestError("Failed to connect")
        content = robots_txt_checker.fetch_robots_txt('http://example.com')
        assert content == ""

def test_parse_robots_txt(robots_txt_checker):
    content = "User-agent: *\nDisallow: /private/\nCrawl-delay: 10"
    robots_txt_checker.parse_robots_txt(content)
    assert robots_txt_checker.rules['*'] == [(re.compile('/private/'), False)]
    assert robots_txt_checker.crawl_delay == 10

def test_is_allowed_explicitly_disallowed(robots_txt_checker):
    content = "User-agent: MyBot\nDisallow: /private/\nCrawl-delay: 10"
    robots_txt_checker.parse_robots_txt(content)
    assert not robots_txt_checker.is_allowed('http://example.com/private/file.txt')

def test_is_allowed_explicitly_allowed(robots_txt_checker):
    content = "User-agent: MyBot\nDisallow: /private/\nAllow: /private/allowed/\nCrawl-delay: 10"
    robots_txt_checker.parse_robots_txt(content)
    assert robots_txt_checker.is_allowed('http://example.com/private/allowed/file.txt')

def test_is_allowed_generic_rule(robots_txt_checker):
    content = "User-agent: *\nDisallow: /private/\nCrawl-delay: 10"
    robots_txt_checker.parse_robots_txt(content)
    assert not robots_txt_checker.is_allowed('http://example.com/private/file.txt')

def test_get_crawl_delay(robots_txt_checker):
    content = "User-agent: MyBot\nDisallow: /private/\nCrawl-delay: 10"
    robots_txt_checker.parse_robots_txt(content)
    assert robots_txt_checker.get_crawl_delay() == 10

def test_get_crawl_delay_not_specified(robots_txt_checker):
    content = "User-agent: MyBot\nDisallow: /private/"
    robots_txt_checker.parse_robots_txt(content)
    assert robots_txt_checker.get_crawl_delay() is None
