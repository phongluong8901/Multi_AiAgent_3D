from skill_url_normalizer import URLNormalizer
from skill_url_filter import URLFilter

class URLProcessorPipeline:
    def __init__(self, allowed_domains):
        """Initialize with allowed domains for filtering"""
        self.normalizer = URLNormalizer()
        self.url_filter = URLFilter(allowed_domains)

    def process(self, urls):
        """Normalize URLs and filter by allowed domains"""
        normalized_urls = []
        for url in urls:
            try:
                normalized_url = self.normalizer.normalize(url)
                normalized_urls.append(normalized_url)
            except ValueError:
                # Skip invalid URLs
                continue
        return self.url_filter.filter_urls(normalized_urls)