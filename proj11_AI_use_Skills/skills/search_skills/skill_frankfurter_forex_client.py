import httpx

class FrankfurterForexClient:
    def get_exchange_rate(self, from_currency: str, to_currency: str) -> float:
        url = f"https://api.frankfurter.app/latest?from={from_currency}&to={to_currency}"
        headers = {"User-Agent": "AutoEvolveBot/1.0 (https://example.org)"}
        response = httpx.get(url, timeout=15.0, follow_redirects=True, headers=headers)
        
        if response.status_code != 200:
            raise RuntimeError(f"Failed to fetch exchange rate: {response.status_code} - {response.text}")
        
        data = response.json()
        rates = data.get('rates', {})
        exchange_rate = rates.get(to_currency)
        
        if exchange_rate is None:
            raise RuntimeError(f"Exchange rate not found for {from_currency} to {to_currency}")
        
        return exchange_rate