import pytest
from unittest.mock import patch
from skill_network_inspector import NetworkInspectorClient

@pytest.fixture
def client():
    return NetworkInspectorClient()

@patch("httpx.get")
def test_inspect_url_happy_path(mock_get, client):
    mock_get.return_value.status_code = 200
    mock_get.return_value.headers = {"Content-Type": "application/json"}
    mock_get.return_value.elapsed.total_seconds.return_value = 0.1
    result = client.inspect_url("http://example.com")
    assert result['status_code'] == 200
    assert result['headers'] == {"Content-Type": "application/json"}
    assert result['response_time_ms'] == 100.0

@patch("httpx.get")
def test_inspect_url_non_200_status(mock_get, client):
    mock_get.return_value.status_code = 404
    mock_get.return_value.headers = {}
    mock_get.return_value.elapsed.total_seconds.return_value = 0.1
    with pytest.raises(Exception):
        client.inspect_url("http://example.com")

@patch("httpx.get")
def test_inspect_url_empty_data(mock_get, client):
    mock_get.return_value.status_code = 200
    mock_get.return_value.headers = {}
    mock_get.return_value.elapsed.total_seconds.return_value = 0.1
    mock_get.return_value.content = b""
    with pytest.raises(Exception):
        client.inspect_url("http://example.com")