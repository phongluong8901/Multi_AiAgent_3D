from skill_url_normalizer_filter_pipeline import URLNormalizerFilterPipeline

class URLDeduplicatorProcessor:
    def __init__(self, allowed_domains: list[str]):
        """Initialize with allowed domains for URL processing"""
        self.pipeline = URLNormalizerFilterPipeline(allowed_domains)

    def process(self, urls: list[str]) -> list[str]:
        """Process URLs through normalization/filtering and deduplicate results"""
        normalized_urls = self.pipeline.process(urls)
        seen = set()
        return [u for u in normalized_urls if not (u in seen or seen.add(u))]

        # Ensure the order of expected_output matches the order of normalized_urls
        return list(dict.fromkeys(normalized_urls))