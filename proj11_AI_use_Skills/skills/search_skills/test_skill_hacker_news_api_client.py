import pytest
from unittest.mock import patch
from typing import List
from skill_hacker_news_api_client import HackerNewsApiClient

@pytest.fixture
def client():
    return HackerNewsApiClient()

@patch("httpx.get")
def test_get_top_stories_happy_path(mock_get, client):
    mock_get.return_value.status_code = 200
    mock_get.return_value.json.return_value = [1, 2, 3]
    result = client.get_top_stories()
    assert isinstance(result, list)
    assert result == [1, 2, 3]

@patch("httpx.get")
def test_get_top_stories_http_error(mock_get, client):
    mock_get.return_value.status_code = 404
    with pytest.raises(Exception):
        client.get_top_stories()

@patch("httpx.get")
def test_get_top_stories_empty_response(mock_get, client):
    mock_get.return_value.status_code = 200
    mock_get.return_value.json.return_value = []
    result = client.get_top_stories()
    assert isinstance(result, list)
    assert result == []

@patch("httpx.get")
def test_get_story_happy_path(mock_get, client):
    mock_get.return_value.status_code = 200
    mock_get.return_value.json.return_value = {"id": 1, "title": "Test Story"}
    result = client.get_story(1)
    assert isinstance(result, dict)
    assert result == {"id": 1, "title": "Test Story"}

@patch("httpx.get")
def test_get_story_http_error(mock_get, client):
    mock_get.return_value.status_code = 500
    with pytest.raises(Exception):
        client.get_story(1)

@patch("httpx.get")
def test_get_story_empty_response(mock_get, client):
    mock_get.return_value.status_code = 200
    mock_get.return_value.json.return_value = {}
    result = client.get_story(1)
    assert isinstance(result, dict)
    assert result == {}