import httpx
import xml.etree.ElementTree as ET

class ArXivApiClient:
    def search_papers(self, query, max_results=3):
        base_url = "https://export.arxiv.org/api/query"
        params = {
            'search_query': query,
            'max_results': str(max_results)  # Ensure max_results is passed as a string
        }
        headers = {
            "User-Agent": "AutoEvolveBot/1.0 (https://example.org)"
        }
        
        response = httpx.get(base_url, params=params, timeout=15.0, follow_redirects=True, headers=headers)
        
        if response.status_code != 200:
            raise RuntimeError(f"HTTP error {response.status_code}: {response.text}")
        
        if not response.content:
            raise RuntimeError("No content returned from the API")
        
        root = ET.fromstring(response.content)
        papers = []
        
        for entry in root.findall('{http://www.w3.org/2005/Atom}entry'):
            title = entry.find('{http://www.w3.org/2005/Atom}title').text
            summary = entry.find('{http://www.w3.org/2005/Atom}summary').text
            paper_id = entry.find('{http://www.w3.org/2005/Atom}id').text.split('/')[-1]
            paper = type('Paper', (object,), {
                'title': title,
                'summary': summary,
                'id': paper_id
            })()
            papers.append(paper)
        
        return papers