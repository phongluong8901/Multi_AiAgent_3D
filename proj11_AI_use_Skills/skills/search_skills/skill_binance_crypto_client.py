import httpx

class BinanceCryptoClient:
    def get_crypto_price(self, symbol: str) -> float:
        # Ensure the symbol is in uppercase and does not contain slashes
        symbol = symbol.replace('/', '').upper()
        url = f"https://api.binance.com/api/v3/ticker/price?symbol={symbol}"
        response = httpx.get(url, timeout=15.0, follow_redirects=True, headers={"User-Agent": "AutoEvolveBot/1.0 (https://example.org)"})
        
        if response.status_code != 200:
            raise RuntimeError(f"Failed to fetch price for {symbol}: {response.status_code} - {response.text}")
        
        data = response.json()
        if 'price' not in data:
            raise RuntimeError(f"Unexpected response format for {symbol}: {response.text}")
        
        return float(data['price'])