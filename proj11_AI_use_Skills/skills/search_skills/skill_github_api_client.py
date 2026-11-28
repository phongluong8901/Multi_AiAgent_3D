import httpx

class GitHubApiClient:
    def search_repositories(self, q: str, sort: str = 'stars', order: str = 'desc', per_page: int = 10) -> dict:
        url = f"https://api.github.com/search/repositories"
        params = {
            'q': q,
            'sort': sort,
            'order': order,
            'per_page': per_page
        }
        headers = {"User-Agent": "AutoEvolveBot/1.0 (https://example.org)"}
        
        response = httpx.get(url, params=params, timeout=15.0, follow_redirects=True, headers=headers)
        
        if response.status_code != 200:
            raise RuntimeError(f"GitHub API request failed with status code {response.status_code}: {response.text}")
        
        try:
            data = response.json()
        except ValueError as e:
            raise RuntimeError(f"Failed to decode JSON response: {e}")
        
        return data