import pytest
from unittest.mock import patch, MagicMock
from skill_frankfurter_forex_client import FrankfurterForexClient

@pytest.fixture
def client() -> FrankfurterForexClient:
    return FrankfurterForexClient()

@patch("httpx.Client")
def test_get_exchange_rate_success(mock_client_cls, client: FrankfurterForexClient) -> None:
    mock_instance = mock_client_cls.return_value.__enter__.return_value
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {"rates": {"EUR": 0.92}}
    mock_instance.get.return_value = mock_response

    rate = client.get_exchange_rate("USD", "EUR")
    assert rate == 0.92

@patch("httpx.Client")
def test_get_exchange_rate_same_currency(mock_client_cls, client: FrankfurterForexClient) -> None:
    rate = client.get_exchange_rate("USD", "USD")
    assert rate == 1.0
    mock_client_cls.assert_not_called()

@patch("httpx.Client")
def test_get_exchange_rate_unsupported_currency(mock_client_cls, client: FrankfurterForexClient) -> None:
    mock_instance = mock_client_cls.return_value.__enter__.return_value
    mock_response = MagicMock()
    mock_response.status_code = 422
    mock_response.text = "Unprocessable Entity"
    mock_instance.get.return_value = mock_response

    with pytest.raises(RuntimeError, match="Unsupported currency code"):
        client.get_exchange_rate("USD", "VND")

@patch("httpx.Client")
def test_get_exchange_rate_not_found_in_rates(mock_client_cls, client: FrankfurterForexClient) -> None:
    mock_instance = mock_client_cls.return_value.__enter__.return_value
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {"rates": {}}
    mock_instance.get.return_value = mock_response

    with pytest.raises(RuntimeError, match="Exchange rate not found"):
        client.get_exchange_rate("USD", "GBP")

@patch("httpx.Client")
def test_get_exchange_rate_network_error(mock_client_cls, client: FrankfurterForexClient) -> None:
    mock_client_cls.side_effect = Exception("Connection refused")

    with pytest.raises(RuntimeError, match="Network error"):
        client.get_exchange_rate("USD", "EUR")
