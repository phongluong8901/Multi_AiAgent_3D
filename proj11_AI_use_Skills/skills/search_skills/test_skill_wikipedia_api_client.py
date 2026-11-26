import pytest
import httpx  # Added this line
from unittest.mock import patch, MagicMock
from skill_wikipedia_api_client import WikipediaApiClient

@pytest.fixture
def api_client():
    return WikipediaApiClient()

@patch("httpx.get")
def test_get_summary_happy_path(mock_get, api_client):
    # Mock search response (first API call)
    search_response = MagicMock()
    search_response.status_code = 200
    search_response.json.return_value = {
        "query": {
            "search": [{"title": "Correct Title"}]
        }
    }
    
    # Mock summary response (second API call)
    summary_response = MagicMock()
    summary_response.status_code = 200
    summary_response.json.return_value = {
        "query": {
            "pages": {"1": {"extract": "Summary of the topic"}}
        }
    }
    
    mock_get.side_effect = [search_response, summary_response]
    
    result = api_client.get_summary("topic")
    assert isinstance(result, dict)
    assert result["summary"] == "Summary of the topic"

@patch("httpx.get")
def test_get_summary_not_found(mock_get, api_client):
    # Mock search response (valid title found)
    search_response = MagicMock()
    search_response.status_code = 200
    search_response.json.return_value = {
        "query": {
            "search": [{"title": "Non Existent Title"}]
        }
    }
    
    # Mock summary response (page not found)
    summary_response = MagicMock()
    summary_response.status_code = 200
    summary_response.json.return_value = {
        "query": {
            "pages": {"-1": {"extract": "N/A"}}
        }
    }
    
    mock_get.side_effect = [search_response, summary_response]
    
    with pytest.raises(RuntimeError, match="Page not found for title: Non Existent Title"):
        api_client.get_summary("non_existent_topic")

@patch("httpx.get")
def test_get_summary_server_error(mock_get, api_client):
    # Mock search response (valid)
    search_response = MagicMock()
    search_response.status_code = 200
    search_response.json.return_value = {
        "query": {
            "search": [{"title": "Error Topic"}]
        }
    }
    
    # Mock summary response (server error)
    summary_response = MagicMock()
    summary_response.status_code = 500
    summary_response.raise_for_status.side_effect = httpx.HTTPStatusError(
        "500 Server Error", request=None, response=summary_response
    )
    
    mock_get.side_effect = [search_response, summary_response]
    
    with pytest.raises(RuntimeError, match="HTTP error occurred: 500"):
        api_client.get_summary("topic")

@patch("httpx.get")
def test_get_summary_empty_response(mock_get, api_client):
    # Mock search response (no results)
    search_response = MagicMock()
    search_response.status_code = 200
    search_response.json.return_value = {}
    
    mock_get.return_value = search_response
    
    with pytest.raises(RuntimeError, match="No search results found for topic: topic"):
        api_client.get_summary("topic")