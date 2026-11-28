import httpx

class HuggingFaceApiClient:
    def search_models(self, filter_task: str, sort: str, direction: str, limit: int) -> list:
        base_url = "https://huggingface.co/api/models"
        params = {
            "filter": filter_task,
            "sort": sort,
            "direction": direction,
            "limit": limit
        }
        headers = {"User-Agent": "AutoEvolveBot/1.0 (https://example.org)"}
        
        response = httpx.get(base_url, params=params, timeout=15.0, follow_redirects=True, headers=headers)
        
        if response.status_code != 200:
            raise RuntimeError(f"HTTP error {response.status_code}: {response.text}")
        
        try:
            data = response.json()
        except ValueError as e:
            raise RuntimeError(f"JSON decode error: {e}")
        
        if 'models' not in data:
            raise RuntimeError("Response does not contain 'models' key")
        
        return data['models']