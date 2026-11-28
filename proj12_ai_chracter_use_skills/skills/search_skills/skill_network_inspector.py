import httpx

class NetworkInspectorClient:
    def inspect_url(self, url):
        """Trả về dict chứa status_code, headers, response_time_ms"""
        headers = {"User-Agent": "AutoEvolveBot/1.0 (https://example.org)"}
        try:
            response = httpx.get(url, timeout=15.0, follow_redirects=True, headers=headers)
            response.raise_for_status()
        except httpx.RequestError as exc:
            raise RuntimeError(f"Request failed: {exc}") from exc
        except httpx.HTTPStatusError as exc:
            raise RuntimeError(f"HTTP error occurred: {exc.response.status_code} {exc.response.text}") from exc
        
        if response.status_code != 200:
            raise RuntimeError(f"Unexpected status code: {response.status_code}")
        
        if not response.content:
            raise RuntimeError("Response content is empty")
        
        return {
            'status_code': response.status_code,
            'headers': dict(response.headers),
            'response_time_ms': response.elapsed.total_seconds() * 1000
        }