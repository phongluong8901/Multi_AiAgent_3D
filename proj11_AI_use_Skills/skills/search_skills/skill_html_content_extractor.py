from bs4 import BeautifulSoup
from urllib.parse import urljoin
from typing import Optional, List

class HTMLContentExtractor:
    def __init__(self, content: str):
        """Khởi tạo với nội dung HTML."""
        self.soup = BeautifulSoup(content, 'html.parser')

    def extract_text(self) -> str:
        """Trích xuất và trả về văn bản từ HTML, loại bỏ nội dung trong <script> và <style>.

        Returns:
            str: Văn bản trích xuất từ HTML.
        """
        for script_or_style in self.soup(['script', 'style']):
            script_or_style.decompose()
        return self.soup.get_text(separator='\n', strip=True)

    def extract_links(self, base_url: Optional[str] = None) -> List[str]:
        """Trích xuất và trả về danh sách các liên kết (URL) từ HTML, loại bỏ các liên kết không hợp lệ.

        Args:
            base_url (Optional[str]): URL cơ sở để chuyển đổi các liên kết tương đối thành tuyệt đối.

        Returns:
            List[str]: Danh sách các URL hợp lệ trong HTML.
        """
        links = self.soup.find_all('a', href=True)
        valid_links = set()
        for link in links:
            href = link['href'].strip()
            if not href or href.startswith(('#', 'javascript:', 'mailto:', 'tel:')):
                continue
            if base_url:
                href = urljoin(base_url, href)
            valid_links.add(href)
        # Trả về danh sách đã sắp xếp để đảm bảo thứ tự
        return sorted(valid_links)