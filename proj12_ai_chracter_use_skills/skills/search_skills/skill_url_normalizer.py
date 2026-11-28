import urllib.parse

class URLNormalizer:
    def __init__(self):
        """
        Initialize the URLNormalizer with necessary settings.
        """
        pass

    def normalize(self, url: str) -> str:
        """
        Normalize the given URL string.

        Args:
            url (str): The URL string to normalize.

        Returns:
            str: The normalized URL string.

        Raises:
            ValueError: If the URL is invalid.
        """
        try:
            parsed_url = urllib.parse.urlparse(url)
            if not parsed_url.scheme or not parsed_url.netloc:
                raise ValueError("Invalid URL")
            
            # Normalize scheme and netloc
            scheme = parsed_url.scheme.lower()
            netloc = parsed_url.netloc.lower()
            
            # Remove default ports
            if (scheme == 'http' and netloc.endswith(':80')) or (scheme == 'https' and netloc.endswith(':443')):
                netloc = netloc.rsplit(':', 1)[0]
            
            # Build normalized URL without fragment
            path = parsed_url.path.rstrip('/')
            normalized_url = f"{scheme}://{netloc}{path}"
            
            # Sort query parameters if present
            if parsed_url.query:
                query_params = sorted(parsed_url.query.split('&'))
                normalized_url += '?' + '&'.join(query_params)
            
            # Include fragment if present
            if parsed_url.fragment:
                normalized_url += '#' + parsed_url.fragment
            
            return normalized_url
        except Exception as e:
            raise ValueError("Invalid URL") from e