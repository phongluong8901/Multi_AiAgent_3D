import httpx
from typing import List

class HackerNewsApiClient:
    BASE_URL = "https://hacker-news.firebaseio.com/v0"

    def get_top_stories(self) -> List[int]:
        response = httpx.get(f"{self.BASE_URL}/topstories.json", timeout=15.0, follow_redirects=True, headers={"User-Agent": "AutoEvolveBot/1.0 (https://example.org)"})
        if response.status_code != 200:
            raise RuntimeError(f"Failed to fetch top stories: {response.status_code} - {response.text}")
        try:
            return response.json()
        except ValueError as e:
            raise RuntimeError(f"Invalid JSON response: {e}")

    def get_story(self, story_id: int) -> dict:
        response = httpx.get(f"{self.BASE_URL}/item/{story_id}.json", timeout=15.0, follow_redirects=True, headers={"User-Agent": "AutoEvolveBot/1.0 (https://example.org)"})
        if response.status_code != 200:
            raise RuntimeError(f"Failed to fetch story {story_id}: {response.status_code} - {response.text}")
        try:
            return response.json()
        except ValueError as e:
            raise RuntimeError(f"Invalid JSON response: {e}")