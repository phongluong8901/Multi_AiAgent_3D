import pytest
from unittest.mock import patch
from skill_ip_geolocation_client import IPGeolocationClient

@pytest.fixture
def client():
    return IPGeolocationClient()

@patch("httpx.get")
def test_get_geolocation_happy_path(mock_get, client):
    # Add "status": "success" to match API response expectation
    mock_get.return_value.status_code = 200
    mock_get.return_value.json.return_value = {
        "status": "success",
        "ip": "8.8.8.8",
        "country": "US"
    }
    result = client.get_geolocation("8.8.8.8")
    assert isinstance(result, dict)
    assert "ip" in result
    assert "country" in result

@patch("httpx.get")
def test_get_geolocation_http_error(mock_get, client):
    mock_get.return_value.status_code = 404
    with pytest.raises(RuntimeError):  # Specific exception type
        client.get_geolocation("8.8.8.8")

@patch("httpx.get")
def test_get_geolocation_api_error(mock_get, client):
    mock_get.return_value.status_code = 200
    mock_get.return_value.json.return_value = {"status": "fail", "message": "Invalid query"}
    with pytest.raises(RuntimeError):
        client.get_geolocation("8.8.8.8")