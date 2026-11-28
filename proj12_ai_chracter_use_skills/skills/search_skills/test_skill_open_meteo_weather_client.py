import pytest
from unittest.mock import patch, MagicMock
from skill_open_meteo_weather_client import OpenMeteoWeatherClient

@pytest.fixture
def client():
    return OpenMeteoWeatherClient()

@patch("httpx.get")
def test_get_current_weather_happy_path(mock_get, client):
    # First mock geocoding response, then forecast response
    mock_geocoding = MagicMock()
    mock_geocoding.json.return_value = {
        "results": [
            {"latitude": 51.5072, "longitude": 0.1276}
        ]
    }
    mock_forecast = MagicMock()
    mock_forecast.json.return_value = {
        "current_weather": {"temperature": 20, "condition": "Sunny"}
    }
    mock_get.side_effect = [mock_geocoding, mock_forecast]

    result = client.get_current_weather("London")
    assert result == {"temperature": 20, "condition": "Sunny"}

@patch("httpx.get")
def test_get_current_weather_city_not_found(mock_get, client):
    mock_geocoding = MagicMock()
    mock_geocoding.json.return_value = {"results": []}
    mock_get.return_value = mock_geocoding

    result = client.get_current_weather("NonExistentCity")
    assert result == {"error": f"City 'NonExistentCity' not found."}

@patch("httpx.get")
def test_get_current_weather_network_error(mock_get, client):
    mock_get.side_effect = Exception("Network error")
    result = client.get_current_weather("London")
    assert result == {"error": "Network error"}

@patch("httpx.get")
def test_get_current_weather_invalid_response(mock_get, client):
    # First mock geocoding success, then invalid forecast response
    mock_geocoding = MagicMock()
    mock_geocoding.json.return_value = {
        "results": [{"latitude": 51.5072, "longitude": 0.1276}]
    }
    mock_forecast = MagicMock()
    mock_forecast.json.return_value = {}
    mock_get.side_effect = [mock_geocoding, mock_forecast]

    result = client.get_current_weather("London")
    assert result == {"error": "Invalid response"}