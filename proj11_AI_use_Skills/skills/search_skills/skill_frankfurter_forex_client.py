import httpx

class FrankfurterForexClient:
    """Client for fetching foreign exchange rates using the Frankfurter API."""

    def __init__(self) -> None:
        pass

    def get_exchange_rate(self, from_currency: str, to_currency: str) -> float:
        """Get the exchange rate between two currencies using the Frankfurter API.
        
        Args:
            from_currency: The base currency code (e.g., 'USD', 'EUR').
            to_currency: The target currency code (e.g., 'EUR', 'VND').
            
        Returns:
            float: The exchange rate value.
            
        Note:
            Frankfurter API does not support all currencies natively (such as VND).
            If a currency is unsupported or unavailable, a fallback or informative error is raised.
        """
        from_currency = from_currency.upper()
        to_currency = to_currency.upper()

        if from_currency == to_currency:
            return 1.0

        url = f"https://api.frankfurter.app/latest?from={from_currency}&to={to_currency}"
        headers = {"User-Agent": "AutoEvolveBot/1.0 (https://example.org)"}
        
        try:
            with httpx.Client(timeout=15.0, follow_redirects=True) as client:
                response = client.get(url, headers=headers)
        except Exception as e:
            raise RuntimeError(f"Network error while connecting to Frankfurter API: {str(e)}")
        
        if response.status_code != 200:
            if response.status_code == 422:
                raise RuntimeError(
                    f"Unsupported currency code provided (from: {from_currency}, to: {to_currency}). "
                    f"Frankfurter API may not support currencies like VND."
                )
            raise RuntimeError(f"Failed to fetch exchange rate: {response.status_code} - {response.text}")
        
        data = response.json()
        rates = data.get('rates', {})
        
        exchange_rate = rates.get(to_currency)
        
        if exchange_rate is None:
            raise RuntimeError(f"Exchange rate not found for {from_currency} to {to_currency}")
        
        return float(exchange_rate)
