import pytest
from unittest.mock import patch
from skill_github_api_client import GitHubApiClient

@patch("httpx.get")
def test_search_repositories_happy_path(mock_get):
    mock_get.return_value.status_code = 200
    mock_get.return_value.json.return_value = {"items": [{"name": "repo1"}, {"name": "repo2"}]}
    client = GitHubApiClient()
    result = client.search_repositories("test")
    assert result == {"items": [{"name": "repo1"}, {"name": "repo2"}]}

@patch("httpx.get")
def test_search_repositories_http_error(mock_get):
    mock_get.return_value.status_code = 404
    client = GitHubApiClient()
    with pytest.raises(Exception):
        client.search_repositories("test")

@patch("httpx.get")
def test_search_repositories_empty_data(mock_get):
    mock_get.return_value.status_code = 200
    mock_get.return_value.json.return_value = {"items": []}
    client = GitHubApiClient()
    result = client.search_repositories("test")
    assert result == {"items": []}