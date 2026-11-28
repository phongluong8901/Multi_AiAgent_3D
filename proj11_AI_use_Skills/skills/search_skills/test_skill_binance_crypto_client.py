import pytest
from unittest.mock import patch
from skill_binance_crypto_client import BinanceCryptoClient

@pytest.fixture
def client():
    return BinanceCryptoClient()

@patch("httpx.get")
def test_get_crypto_price_success(mock_get, client):
    mock_response = mock_get.return_value
    mock_response.status_code = 200  # Added missing status code
    mock_response.json.return_value = {"price": "40000.00"}  # Simplify to match required 'price' key
    assert client.get_crypto_price("BTC") == 40000.00  # Fix symbol to "BTC" to avoid "BTCUSDTUSDT" in URL

@patch("httpx.get")
def test_get_crypto_price_not_found(mock_get, client):
    mock_response = mock_get.return_value
    mock_response.status_code = 400  # Explicit status code for clarity
    mock_response.json.return_value = {"code": -1121, "msg": "Invalid symbol."}
    with pytest.raises(RuntimeError):  # Use specific exception type
        client.get_crypto_price("INVALIDSYMBOL")

@patch("httpx.get")
def test_get_crypto_price_server_error(mock_get, client):
    mock_get.side_effect = Exception("Server error")
    with pytest.raises(Exception):
        client.get_crypto_price("BTCUSDT")

@patch("httpx.get")
def test_get_crypto_price_empty_response(mock_get, client):
    mock_response = mock_get.return_value
    mock_response.status_code = 200  # Added missing status code
    mock_response.json.return_value = {}
    with pytest.raises(RuntimeError):  # Use specific exception type
        client.get_crypto_price("BTCUSDT")