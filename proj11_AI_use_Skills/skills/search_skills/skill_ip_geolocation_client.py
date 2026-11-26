import httpx

class IPGeolocationClient:
    def get_geolocation(self, ip_address) -> dict:
        url = f"http://ip-api.com/json/{ip_address}"
        response = httpx.get(url, timeout=15.0, follow_redirects=True, headers={"User-Agent": "AutoEvolveBot/1.0 (https://example.org)"})
        
        if response.status_code != 200:
            raise RuntimeError(f"Failed to fetch geolocation data. Status code: {response.status_code}, Response: {response.text}")
        
        data = response.json()
        if data.get("status") != "success":
            raise RuntimeError(f"Geolocation API returned an error. Status: {data.get('status')}, Message: {data.get('message', 'No message provided')}")
        
        return data