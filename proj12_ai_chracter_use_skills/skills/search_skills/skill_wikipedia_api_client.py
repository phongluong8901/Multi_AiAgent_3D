import httpx

class WikipediaApiClient:
    def __init__(self, language='vi'):
        self.base_url = f'https://{language}.wikipedia.org/w/api.php'
        self.headers = {"User-Agent": "AutoEvolveBot/1.0 (https://example.org)"}

    def get_summary(self, topic: str) -> dict:
        # First, search for the topic to get the correct page title
        search_params = {
            'action': 'query',
            'format': 'json',
            'list': 'search',
            'srsearch': topic,
            'srlimit': 1
        }
        
        try:
            search_response = httpx.get(self.base_url, headers=self.headers, params=search_params, timeout=15.0, follow_redirects=True)
            search_response.raise_for_status()
        except httpx.HTTPStatusError as e:
            raise RuntimeError(f"HTTP error occurred: {e.response.status_code} - {e.response.text}")
        
        search_data = search_response.json()
        search_results = search_data.get('query', {}).get('search', [])
        
        if not search_results:
            raise RuntimeError(f"No search results found for topic: {topic}")
        
        correct_title = search_results[0].get('title', '')
        
        # Now, get the summary for the correct page title
        params = {
            'action': 'query',
            'format': 'json',
            'prop': 'extracts',
            'exintro': 1,
            'explaintext': 1,
            'redirects': 1,
            'titles': correct_title
        }
        
        try:
            response = httpx.get(self.base_url, headers=self.headers, params=params, timeout=15.0, follow_redirects=True)
            response.raise_for_status()
        except httpx.HTTPStatusError as e:
            raise RuntimeError(f"HTTP error occurred: {e.response.status_code} - {e.response.text}")
        
        data = response.json()
        pages = data.get('query', {}).get('pages', {})
        
        # Extract the page ID, which is the first key in the pages dictionary
        page_id = next(iter(pages), None)
        if page_id and page_id != '-1':  # '-1' indicates the page was not found
            summary = pages[page_id].get('extract', 'N/A')
            return {'summary': summary}
        
        raise RuntimeError(f"Page not found for title: {correct_title}")