import httpx
from typing import List
from lxml import etree
from urllib.parse import urlparse

class SitemapParser:
    def __init__(self):
        self.session = httpx.Client()

    def parse_sitemap(self, sitemap_url: str) -> List[str]:
        try:
            response = self.session.get(sitemap_url)
            response.raise_for_status()
            return self.parse_sitemap_content(response.text)
        except httpx.RequestError as e:
            raise Exception(f"Error fetching sitemap: {e}")
        except httpx.HTTPStatusError as e:
            raise Exception(f"HTTP error fetching sitemap: {e}")

    def parse_sitemap_content(self, content: str) -> List[str]:
        try:
            root = etree.fromstring(content)
            namespaces = {'sm': 'http://www.sitemaps.org/schemas/sitemap/0.9'}
            urls = []
            # Check if it's a sitemapindex
            if root.tag == '{http://www.sitemaps.org/schemas/sitemap/0.9}sitemapindex':
                for loc in root.xpath('//sm:sitemap/sm:loc/text()', namespaces=namespaces):
                    url = loc.strip()
                    if url:
                        urls.append(url)
            # Otherwise, it's a urlset
            else:
                for loc in root.xpath('//sm:url/sm:loc/text()', namespaces=namespaces):
                    url = loc.strip()
                    if url:
                        urls.append(url)
            return urls
        except etree.XMLSyntaxError as e:
            raise ParseError(f"Malformed XML: {e}")

class ParseError(Exception):
    pass
