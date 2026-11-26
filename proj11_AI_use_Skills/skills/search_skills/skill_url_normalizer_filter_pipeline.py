import urllib.parse

class URLNormalizer:
    def __init__(self):
        pass

    def normalize(self, url: str) -> str:
        try:
            parsed_url = urllib.parse.urlparse(url)
            if not parsed_url.scheme or not parsed_url.netloc:
                raise ValueError("Invalid URL")
            normalized_url = parsed_url.scheme + "://" + parsed_url.netloc + parsed_url.path.rstrip('/')
            if parsed_url.query:
                normalized_url += "?" + "&".join(sorted(parsed_url.query.split("&")))
            if parsed_url.fragment:
                normalized_url += "#" + parsed_url.fragment
            return normalized_url
        except Exception as e:
            raise ValueError("Invalid URL") from e

class URLFilter:
    def __init__(self, allowed_domains: list[str]):
        self.allowed_domains = set(allowed_domains)

    def filter_urls(self, urls: list[str]) -> list[str]:
        return [url for url in urls if self.is_allowed(url)]

    def is_allowed(self, url: str) -> bool:
        try:
            parsed_url = urllib.parse.urlparse(url)
            domain = parsed_url.netloc.split(':')[0]
            return domain in self.allowed_domains
        except Exception:
            return False

class URLNormalizerFilterPipeline:
    def __init__(self, allowed_domains: list[str]):
        self.normalizer = URLNormalizer()
        self.filter = URLFilter(allowed_domains)

    def process(self, urls: list[str]) -> list[str]:
        if not isinstance(urls, list) or not all(isinstance(url, str) for url in urls):
            raise ValueError("Input must be a list of strings.")
        
        normalized_urls = []
        for url in urls:
            try:
                normalized_url = self.normalizer.normalize(url)
                normalized_urls.append(normalized_url)
            except ValueError:
                continue
        
        filtered_urls = self.filter.filter_urls(normalized_urls)
        return filtered_urls