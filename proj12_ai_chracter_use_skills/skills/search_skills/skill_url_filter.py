import urllib.parse

class URLFilter:
    def __init__(self, allowed_domains: list[str]):
        """
        Khởi tạo bộ lọc URL với danh sách các tên miền được phép.
        :param allowed_domains: Danh sách các tên miền được phép.
        """
        self.allowed_domains = set(allowed_domains)

    def is_allowed(self, url: str) -> bool:
        """
        Kiểm tra xem URL có được phép truy cập hay không.
        :param url: URL cần kiểm tra.
        :return: True nếu URL được phép, False nếu không.
        """
        try:
            parsed_url = urllib.parse.urlparse(url)
            domain = parsed_url.netloc.split(':')[0]  # Remove port if present
            return domain in self.allowed_domains
        except Exception:
            return False

    def filter_urls(self, urls: list[str]) -> list[str]:
        """
        Lọc danh sách các URL dựa trên danh sách tên miền được phép.
        :param urls: Danh sách các URL cần lọc.
        :return: Danh sách các URL sau khi được lọc.
        """
        return [url for url in urls if self.is_allowed(url)]