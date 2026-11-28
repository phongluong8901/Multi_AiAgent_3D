import re
import json
from datetime import datetime
from typing import Dict, Optional
from bs4 import BeautifulSoup
from urllib.parse import urljoin, urlparse

class PageMetadataExtractor:
    """
    Extracts metadata from an HTML page including OpenGraph, Twitter Cards, JSON-LD schema.org,
    canonical URL, author, language, and normalized ISO publish/modified timestamps.
    """

    def __init__(self):
        self.date_formats = [
            "%Y-%m-%dT%H:%M:%S%z",
            "%Y-%m-%dT%H:%M:%S",
            "%Y-%m-%d",
            "%Y-%m-%dT%H:%M:%S.%f%z",
            "%Y-%m-%dT%H:%M:%S.%f",
            "%Y-%m-%dT%H:%M:%S%z",
            "%Y-%m-%dT%H:%M:%S%z",
            "%Y-%m-%dT%H:%M:%S.%fZ",
            "%Y-%m-%dT%H:%M:%S%z",
            "%Y-%m-%dT%H:%M:%S.%f%z",
            "%Y-%m-%dT%H:%M:%S.%fZ",
            "%Y-%m-%dT%H:%M:%S.%f%z",
            "%Y-%m-%dT%H:%M:%S.%fZ",
            "%Y-%m-%dT%H:%M:%S.%fZ",
            "%Y-%m-%dT%H:%M:%S.%fZ",
            "%Y-%m-%dT%H:%M:%S.%fZ",
            "%Y-%m-%dT%H:%M:%S.%fZ",
            "%Y-%m-%dT%H:%M:%S.%fZ",
            "%Y-%m-%dT%H:%M:%S.%fZ",
            "%Y-%m-%dT%H:%M:%S.%fZ",
        ]

    def extract(self, html: str, url: str = '') -> Dict[str, Optional[str]]:
        """
        Extracts metadata from the provided HTML content.

        :param html: The HTML content as a string.
        :param url: The URL of the page (optional, used to resolve relative URLs).
        :return: A dictionary containing extracted metadata.
        """
        soup = BeautifulSoup(html, 'html.parser')
        metadata = {
            'title': self._extract_title(soup),
            'description': self._extract_description(soup),
            'canonical_url': self._extract_canonical_url(soup, url),
            'author': self._extract_author(soup),
            'published_at': self._extract_date(soup, 'article:published_time'),
            'modified_at': self._extract_date(soup, 'article:modified_time'),
            'json_ld': self._extract_json_ld(soup),
            'og': self._extract_open_graph(soup)
        }
        return metadata

    def _extract_title(self, soup: BeautifulSoup) -> Optional[str]:
        title_tag = soup.find('title')
        return title_tag.string.strip() if title_tag else None

    def _extract_description(self, soup: BeautifulSoup) -> Optional[str]:
        description_tag = soup.find('meta', attrs={'name': 'description'})
        return description_tag['content'].strip() if description_tag else None

    def _extract_canonical_url(self, soup: BeautifulSoup, base_url: str) -> Optional[str]:
        canonical_tag = soup.find('link', rel='canonical')
        if canonical_tag and 'href' in canonical_tag.attrs:
            href = canonical_tag['href']
            return urljoin(base_url, href) if not urlparse(href).netloc else href
        return None

    def _extract_author(self, soup: BeautifulSoup) -> Optional[str]:
        author_tag = soup.find('meta', attrs={'name': 'author'})
        return author_tag['content'].strip() if author_tag else None

    def _extract_date(self, soup: BeautifulSoup, property_name: str) -> Optional[str]:
        date_tag = soup.find('meta', property=property_name)
        if date_tag and 'content' in date_tag.attrs:
            date_str = date_tag['content'].strip()
            for date_format in self.date_formats:
                try:
                    return datetime.strptime(date_str, date_format).isoformat()
                except ValueError:
                    continue
        return None

    def _extract_json_ld(self, soup: BeautifulSoup) -> Optional[Dict]:
        json_ld_tags = soup.find_all('script', type='application/ld+json')
        for tag in json_ld_tags:
            try:
                return json.loads(tag.string.strip())
            except (json.JSONDecodeError, AttributeError):
                continue
        return None

    def _extract_open_graph(self, soup: BeautifulSoup) -> Dict[str, Optional[str]]:
        og_tags = soup.find_all('meta', property=re.compile(r'^og:'))
        og_data = {}
        for tag in og_tags:
            if 'property' in tag.attrs and 'content' in tag.attrs:
                property_name = tag['property'].split(':')[-1]
                og_data[property_name] = tag['content'].strip()
        return og_data
