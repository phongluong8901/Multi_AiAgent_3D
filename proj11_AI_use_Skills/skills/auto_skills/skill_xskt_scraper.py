import httpx
import xml.etree.ElementTree as ET
from bs4 import BeautifulSoup

class XSKTScraperClient:
    """Client cho phep lay ket qua xo so thong qua RSS feed chinh thuc tu xskt.com.vn."""

    def __init__(self, timeout: float = 10.0) -> None:
        self.timeout = timeout
        self.headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }

    def get_xskt_results(self, region: str, date: str = "") -> dict:
        """
        Lay ket qua xo so 3 mien (mien_bac, mien_trung, mien_nam) tu RSS feed cua xskt.com.vn va parse bang xml.etree.ElementTree.
        
        Args:
            region: Vung mien can lay ("mien_bac", "mien_trung", "mien_nam").
            date: Ngay can lay dinh dang DD-MM-YYYY hoac YYYY-MM-DD (de trong neu lay moi nhat hoac gan nhat).
            
        Returns:
            dict: Thong tin tieu de, ngay mo thuong va danh sach cac giai thuong trich xuat duoc.
        """
        region_clean = region.strip().lower()
        if region_clean not in ["mien_bac", "mien_trung", "mien_nam"]:
            raise ValueError("Region phai la mot trong cac gia tri: mien_bac, mien_trung, mien_nam")

        formatted_date = date.strip()
        if formatted_date and "-" in formatted_date:
            parts = formatted_date.split("-")
            if len(parts) == 3:
                if len(parts[0]) == 4:
                    # YYYY-MM-DD sang DD-MM-YYYY
                    formatted_date = f"{parts[2]}-{parts[1]}-{parts[0]}"

        rss_urls = {
            "mien_bac": "https://xskt.com.vn/rss-feed/mien-bac-xsmb.rss",
            "mien_trung": "https://xskt.com.vn/rss-feed/mien-trung-xsmt.rss",
            "mien_nam": "https://xskt.com.vn/rss-feed/mien-nam-xsmn.rss"
        }

        url = rss_urls[region_clean]

        try:
            with httpx.Client(timeout=self.timeout, headers=self.headers, follow_redirects=True) as client:
                response = client.get(url)
                response.raise_for_status()
        except httpx.HTTPError as e:
            raise RuntimeError(f"Khong the ket noi den RSS feed cua xskt.com.vn: {str(e)}")

        try:
            root = ET.fromstring(response.text)
        except ET.ParseError as e:
            raise RuntimeError(f"Loi parse du lieu XML tu RSS feed: {str(e)}")

        channel = root.find("channel")
        if channel is None:
            raise RuntimeError("RSS feed khong hop le: thieu the channel")

        items = channel.findall("item")
        if not items:
            raise RuntimeError("Khong tim thay ban tin ket qua nao trong RSS feed.")

        selected_item = None
        if formatted_date:
            for item in items:
                title_elem = item.find("title")
                pubdate_elem = item.find("pubDate")
                item_text = (title_elem.text if title_elem is not None else "") + " " + (pubdate_elem.text if pubdate_elem is not None else "")
                if formatted_date in item_text:
                    selected_item = item
                    break
            
            if selected_item is None:
                selected_item = items[0]
        else:
            selected_item = items[0]

        title_str = ""
        pub_date_str = ""
        description_str = ""

        title_node = selected_item.find("title")
        if title_node is not None and title_node.text:
            title_str = title_node.text.strip()

        pubdate_node = selected_item.find("pubDate")
        if pubdate_node is not None and pubdate_node.text:
            pub_date_str = pubdate_node.text.strip()

        desc_node = selected_item.find("description")
        if desc_node is not None and desc_node.text:
            description_str = desc_node.text.strip()

        prizes = self._parse_rss_description(description_str)

        return {
            "region": region_clean,
            "title": title_str,
            "pub_date": pub_date_str,
            "date": formatted_date if formatted_date else pub_date_str,
            "prizes": prizes
        }

    def _parse_rss_description(self, html_content: str) -> dict:
        prizes = {}
        if not html_content:
            return prizes

        soup = BeautifulSoup(html_content, "html.parser")
        
        tables = soup.find_all("table")
        for table in tables:
            rows = table.find_all("tr")
            current_prize = "Giai Khac"
            for row in rows:
                cols = row.find_all(["td", "th"])
                if not cols:
                    continue
                if len(cols) >= 2:
                    p_name = cols[0].get_text(strip=True)
                    p_val = cols[1].get_text(strip=True)
                    if p_name:
                        current_prize = p_name
                        if current_prize not in prizes:
                            prizes[current_prize] = []
                    if p_val:
                        numbers = [n.strip() for n in p_val.replace("-", " ").split() if n.strip()]
                        if numbers:
                            prizes.setdefault(current_prize, []).extend(numbers)
                elif len(cols) == 1:
                    val = cols[0].get_text(strip=True)
                    if val:
                        if any(kw in val.lower() for kw in ["giai", "dac biet", "db"]):
                            current_prize = val
                            if current_prize not in prizes:
                                prizes[current_prize] = []
                        else:
                            prizes.setdefault(current_prize, []).append(val)

        if not prizes:
            text_clean = soup.get_text(separator="\n")
            lines = [line.strip() for line in text_clean.split("\n") if line.strip()]
            curr = "Giai Khac"
            for line in lines:
                if ":" in line:
                    parts = line.split(":", 1)
                    curr = parts[0].strip()
                    nums = [n.strip() for n in parts[1].replace("-", " ").split() if n.strip()]
                    prizes[curr] = nums
                else:
                    prizes.setdefault(curr, []).append(line)

        return prizes
