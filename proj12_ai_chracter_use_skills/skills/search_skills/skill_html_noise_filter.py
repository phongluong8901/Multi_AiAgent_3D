from bs4 import BeautifulSoup

class HTMLNoiseFilter:
    def __init__(self):
        """Initialize HTML noise filter"""
        pass

    def filter_noise(self, html_content: str) -> str:
        """Remove navigation bars, headers, footers, and scripts from HTML

        Args:
            html_content (str): Raw HTML string

        Returns:
            str: Cleaned HTML content without noise elements
        """
        soup = BeautifulSoup(html_content, 'html.parser')
        # Remove specific tags
        for tag in ['nav', 'header', 'footer', 'script']:
            for element in soup.find_all(tag):
                element.decompose()
        return soup.prettify()