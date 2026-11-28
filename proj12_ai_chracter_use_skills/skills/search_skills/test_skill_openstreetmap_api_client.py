import pytest
from unittest.mock import patch
from skill_openstreetmap_api_client import OpenStreetMapApiClient

def test_get_coordinates_happy_path():
    mock_response = [{
        "lat": "37.7749",
        "lon": "-122.4194"
    }]
    with patch("httpx.get") as mock_get:
        mock_instance = mock_get.return_value
        mock_instance.status_code = 200
        mock_instance.json.return_value = mock_response
        client = OpenStreetMapApiClient()
        result = client.get_coordinates("San Francisco")
        expected = {
            "latitude": 37.7749,
            "longitude": -122.4194
        }
        assert result == expected

def test_get_coordinates_http_error():
    with patch("httpx.get") as mock_get:
        mock_instance = mock_get.return_value
        mock_instance.status_code = 404
        client = OpenStreetMapApiClient()
        with pytest.raises(RuntimeError, match="HTTP error 404"):
            client.get_coordinates("Invalid Location")

def test_get_coordinates_empty_data():
    mock_response = []
    with patch("httpx.get") as mock_get:
        mock_instance = mock_get.return_value
        mock_instance.status_code = 200
        mock_instance.json.return_value = mock_response
        client = OpenStreetMapApiClient()
        with pytest.raises(RuntimeError, match="No data found"):
            client.get_coordinates("Empty Location")