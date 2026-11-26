import pytest
from unittest.mock import patch
from skill_frankfurter_forex_client import FrankfurterForexClient

@pytest.fixture
def client():
    return FrankfurterForexClient()

@patch("httpx.get")
def test_get_exchange_rate_success(mock_get, client):
    mock_response = mock_get.return_value
    mock_response.json.return_value = {"rates": {"EUR": 1.1}}
    mock_response.status_code = 200
    rate = client.get_exchange_rate("USD", "EUR")
    assert rate == 1.1

@patch("httpx.get")
def test_get_exchange_rate_same_currency(mock_get, client):
    mock_response = mock_get.return_value
    mock_response.json.return_value = {"rates": {"USD": 1.0}}
    mock_response.status_code = 200
    rate = client.get_exchange_rate("USD", "USD")
    assert rate == 1.0

@patch("httpx.get")
def test_get_exchange_rate_not_found(mock_get, client):
    mock_response = mock_get.return_value
    mock_response.json.return_value = {"rates": {}}
    mock_response.status_code = 200
    with pytest.raises(RuntimeError):
        client.get_exchange_rate("USD", "EUR")

@patch("httpx.get")
def test_get_exchange_rate_network_error(mock_get, client):
    mock_get.side_effect = Exception("Network Error")
    with pytest.raises(Exception):
        client.get_exchange_rate("USD", "EUR")