import httpx
from xml.etree import ElementTree as ET
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime


def _parse_rss_datetime(val):
    if not val:
        return None
    if isinstance(val, datetime):
        dt = val if val.tzinfo else val.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc).strftime("%Y-%m-%d %H:%M:%S %z")
    s = str(val).strip()
    try:
        dt = parsedate_to_datetime(s)
        dt = dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc).strftime("%Y-%m-%d %H:%M:%S %z")
    except Exception:
        pass
    for fmt in (
        "%a, %d %b %Y %H:%M:%S %z",
        "%a, %d %b %Y %H:%M:%S %Z",
        "%a, %d %b %Y %H:%M:%S",
        "%Y-%m-%dT%H:%M:%S%z",
        "%Y-%m-%dT%H:%M:%SZ",
        "%Y-%m-%d %H:%M:%S",
    ):
        try:
            dt = datetime.strptime(s, fmt)
            dt = dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
            return dt.astimezone(timezone.utc).strftime("%Y-%m-%d %H:%M:%S %z")
        except Exception:
            continue
    return s


class RSSFeedReaderClient:
    def __init__(self, base_url):
        self.base_url = base_url

    def get_latest_articles(self, limit=5):
        response = httpx.get(
            self.base_url,
            timeout=15.0,
            follow_redirects=True,
            headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.36"},
        )
        if response.status_code != 200:
            if response.headers.get('Content-Type', '').startswith('text/html'):
                raise RuntimeError(f"Failed to fetch RSS feed: HTTP {response.status_code}, HTML response received")
            raise RuntimeError(f"Failed to fetch RSS feed: HTTP {response.status_code}, {response.text}")

        try:
            root = ET.fromstring(response.content)
            articles = []
            for item in root.findall(".//item")[:limit]:
                title_el = item.find("title")
                link_el = item.find("link")
                author_el = item.find("author")
                pub_el = item.find("pubDate")

                title = title_el.text if title_el is not None else None
                link = link_el.text if link_el is not None else None
                author = author_el.text if author_el is not None else None
                published_time = pub_el.text if pub_el is not None else None
                if published_time:
                    published_time = _parse_rss_datetime(published_time)

                articles.append({
                    "title": title,
                    "link": link,
                    "author": author,
                    "published_time": published_time,
                })
            return articles
        except ET.ParseError as e:
            raise RuntimeError(f"Failed to parse RSS feed: {str(e)}")
        except Exception as e:
            raise RuntimeError(f"An unexpected error occurred: {str(e)}")
