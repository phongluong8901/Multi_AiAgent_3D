import pytest
from unittest.mock import patch
from skill_weather_api_client import WeatherAPIClient

@pytest.fixture
def weather_api_client():
    return WeatherAPIClient()

@patch('skill_weather_api_client.WeatherAPIClient.get_current_weather')
def test_get_current_weather_success(mock_get_current_weather, weather_api_client):
    mock_get_current_weather.return_value = {
        'city': 'London',
        'temperature': 15,
        'condition': 'Sunny'
    }
    result = weather_api_client.get_current_weather('London')
    assert result == {
        'city': 'London',
        'temperature': 15,
        'condition': 'Sunny'
    }

@patch('skill_weather_api_client.WeatherAPIClient.get_current_weather')
def test_get_current_weather_city_not_found(mock_get_current_weather, weather_api_client):
    mock_get_current_weather.return_value = {
        'error': 'City not found'
    }
    result = weather_api_client.get_current_weather('NonExistentCity')
    assert result == {
        'error': 'City not found'
    }

@patch('skill_weather_api_client.WeatherAPIClient.get_current_weather')
def test_get_current_weather_api_error(mock_get_current_weather, weather_api_client):
    mock_get_current_weather.return_value = {
        'error': 'API Error'
    }
    result = weather_api_client.get_current_weather('London')
    assert result == {
        'error': 'API Error'
    }

@patch('skill_weather_api_client.WeatherAPIClient.get_current_weather')
def test_get_current_weather_empty_response(mock_get_current_weather, weather_api_client):
    mock_get_current_weather.return_value = {}
    result = weather_api_client.get_current_weather('London')
    assert result == {}

@patch('skill_weather_api_client.WeatherAPIClient.get_current_weather')
def test_get_current_weather_unexpected_response(mock_get_current_weather, weather_api_client):
    mock_get_current_weather.return_value = {
        'unexpected_key': 'unexpected_value'
    }
    result = weather_api_client.get_current_weather('London')
    assert result == {
        'unexpected_key': 'unexpected_value'
    }