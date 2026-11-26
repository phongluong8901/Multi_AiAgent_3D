import httpx

class OpenStreetMapApiClient:
    def get_coordinates(self, query: str) -> dict:
        base_url = "https://nominatim.openstreetmap.org/search"
        params = {
            "q": query,
            "format": "json",
            "limit": 1
        }
        headers = {"User-Agent": "AutoEvolveBot/1.0 (https://example.org)"}
        
        response = httpx.get(base_url, params=params, timeout=15.0, follow_redirects=True, headers=headers)
        
        if response.status_code != 200:
            raise RuntimeError(f"HTTP error {response.status_code}: {response.text}")
        
        data = response.json()
        
        if not data:
            raise RuntimeError("No data found for the query.")
        
        if 'lat' not in data[0] or 'lon' not in data[0]:
            raise RuntimeError("Latitude or longitude not found in the response.")
        
        return {
            "latitude": float(data[0]['lat']),
            "longitude": float(data[0]['lon'])
        }