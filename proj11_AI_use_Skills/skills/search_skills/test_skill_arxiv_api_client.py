import pytest
from unittest.mock import patch, MagicMock
from skill_arxiv_api_client import ArXivApiClient

@pytest.fixture
def api_client():
    return ArXivApiClient()

@patch("httpx.get")
def test_search_papers_happy_path(mock_get, api_client):
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.content = b'''<feed xmlns="http://www.w3.org/2005/Atom">
        <entry>
            <title>Test Paper</title>
            <id>123</id>
            <summary>Test summary</summary>
        </entry>
    </feed>'''
    mock_get.return_value = mock_response
    results = api_client.search_papers("test")
    assert len(results) == 1
    # Sửa từ "in" thành kiểm tra thuộc tính trực tiếp
    assert hasattr(results[0], 'id')
    assert hasattr(results[0], 'title')
    assert hasattr(results[0], 'summary')
    assert results[0].id == "123"
    assert results[0].title == "Test Paper"
    assert results[0].summary == "Test summary"

@patch("httpx.get")
def test_search_papers_http_error(mock_get, api_client):
    mock_response = MagicMock()
    mock_response.status_code = 404
    mock_get.return_value = mock_response
    with pytest.raises(RuntimeError):
        api_client.search_papers("test")

@patch("httpx.get")
def test_search_papers_empty_data(mock_get, api_client):
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.content = b'''<feed xmlns="http://www.w3.org/2005/Atom"></feed>'''
    mock_get.return_value = mock_response
    results = api_client.search_papers("test")
    assert len(results) == 0