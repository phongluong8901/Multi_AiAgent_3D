import pytest
from unittest.mock import patch
from skill_pypi_api_client import PyPIApiClient

@pytest.fixture
def client():
    return PyPIApiClient()

@patch("httpx.get")
def test_get_package_info_happy_path(mock_get, client):
    mock_get.return_value.status_code = 200
    mock_get.return_value.json.return_value = {"info": {"name": "example", "version": "1.0.0"}}
    result = client.get_package_info("example")
    assert isinstance(result, dict)
    assert "info" in result

@patch("httpx.get")
def test_get_package_info_http_error(mock_get, client):
    mock_get.return_value.status_code = 404
    with pytest.raises(Exception):
        client.get_package_info("nonexistent")

@patch("httpx.get")
def test_get_package_info_empty_data(mock_get, client):
    mock_get.return_value.status_code = 200
    mock_get.return_value.json.return_value = {}
    with pytest.raises(Exception):
        client.get_package_info("empty")