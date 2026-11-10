import datetime
import html
import json
import re
import urllib.parse
import urllib.request
from typing import Dict, Any, List, Optional, Tuple
from .base_tool import BaseTool

# Tọa độ sẵn của các tỉnh/thành phố lớn tại Việt Nam để tra cứu thời tiết tức thì
VN_CITY_COORDS: Dict[str, Tuple[float, float, str]] = {
    "hà nội": (21.0285, 105.8542, "Hà Nội"),
    "ha noi": (21.0285, 105.8542, "Hà Nội"),
    "hanoi": (21.0285, 105.8542, "Hà Nội"),
    "hồ chí minh": (10.8231, 106.6297, "TP. Hồ Chí Minh"),
    "ho chi minh": (10.8231, 106.6297, "TP. Hồ Chí Minh"),
    "tphcm": (10.8231, 106.6297, "TP. Hồ Chí Minh"),
    "sài gòn": (10.8231, 106.6297, "TP. Hồ Chí Minh"),
    "saigon": (10.8231, 106.6297, "TP. Hồ Chí Minh"),
    "đà nẵng": (16.0544, 108.2022, "Đà Nẵng"),
    "da nang": (16.0544, 108.2022, "Đà Nẵng"),
    "hải phòng": (20.8449, 106.6881, "Hải Phòng"),
    "hai phong": (20.8449, 106.6881, "Hải Phòng"),
    "cần thơ": (10.0452, 105.7469, "Cần Thơ"),
    "can tho": (10.0452, 105.7469, "Cần Thơ"),
    "huế": (16.4637, 107.5909, "Huế"),
    "hue": (16.4637, 107.5909, "Huế"),
    "nha trang": (12.2388, 109.1967, "Nha Trang"),
    "đà lạt": (11.9404, 108.4583, "Đà Lạt"),
    "da lat": (11.9404, 108.4583, "Đà Lạt"),
    "vũng tàu": (10.3460, 107.0843, "Vũng Tàu"),
    "vung tau": (10.3460, 107.0843, "Vũng Tàu"),
    "hạ long": (20.9599, 107.0425, "Hạ Long, Quảng Ninh"),
    "quảng ninh": (20.9599, 107.0425, "Quảng Ninh"),
    "vinh": (18.6796, 105.6813, "TP. Vinh, Nghệ An"),
    "quy nhơn": (13.7830, 109.2197, "Quy Nhơn"),
    "thanh hóa": (19.8067, 105.7852, "Thanh Hóa"),
    "bắc ninh": (21.1861, 106.0763, "Bắc Ninh"),
    "hải dương": (20.9373, 106.3146, "Hải Dương"),
    "nam định": (20.4388, 106.1621, "Nam Định"),
    "thái nguyên": (21.5942, 105.8482, "Thái Nguyên"),
    "phú quốc": (10.2270, 103.9632, "Phú Quốc"),
    "sapa": (22.3364, 103.8438, "Sa Pa, Lào Cai"),
    "sa pa": (22.3364, 103.8438, "Sa Pa, Lào Cai"),
}

WMO_WEATHER_CODES: Dict[int, str] = {
    0: "Trời quang đãng, nắng đẹp",
    1: "Trời ít mây, nắng nhẹ",
    2: "Có mây rải rác",
    3: "Trời nhiều mây, âm u",
    45: "Có sương mù nhẹ",
    48: "Sương mù dày",
    51: "Mưa phùn nhẹ",
    53: "Mưa phùn vừa",
    55: "Mưa phùn dày hạt",
    61: "Mưa rào nhẹ",
    63: "Mưa vừa",
    65: "Mưa to",
    71: "Tuyết rơi nhẹ",
    80: "Mưa rào rải rác",
    81: "Mưa rào vừa đến lớn",
    82: "Mưa rào rất to",
    95: "Có dông sét",
    96: "Dông kèm mưa lớn",
    99: "Mưa dông dữ dội",
}


class DuckDuckGoSearchTool(BaseTool):
    name = "duckduckgo_search"
    description = (
        "[Không cần API Key] Tìm kiếm Internet miễn phí qua DuckDuckGo, tra cứu thời tiết trực tiếp (Open-Meteo) và Wikipedia."
    )

    @staticmethod
    def _is_weather_query(query: str) -> bool:
        q_lower = query.lower()
        keywords = [
            "thời tiết",
            "thoi tiet",
            "nhiệt độ",
            "nhiet do",
            "weather",
            "dự báo thời tiết",
            "trời mưa",
            "mưa không",
        ]
        return any(k in q_lower for k in keywords)

    @staticmethod
    def _fetch_live_weather(query: str) -> Optional[Dict[str, str]]:
        q_lower = query.lower()
        lat, lon, city_label = None, None, None

        for key, (c_lat, c_lon, c_name) in VN_CITY_COORDS.items():
            if key in q_lower:
                lat, lon, city_label = c_lat, c_lon, c_name
                break

        if lat is None:
            cleaned = re.sub(
                r"(thời tiết|thoi tiet|nhiệt độ|nhiet do|hôm nay|hom nay|ngày mai|hiện tại|ở|tại|như thế nào|ra sao|weather|in|today|\?)",
                " ",
                q_lower,
                flags=re.IGNORECASE,
            ).strip()
            cleaned = re.sub(r"\s+", " ", cleaned)
            if cleaned:
                try:
                    geo_url = f"https://geocoding-api.open-meteo.com/v1/search?name={urllib.parse.quote(cleaned)}&count=1&language=vi&format=json"
                    req = urllib.request.Request(geo_url, headers={"User-Agent": "MultiAgentSystem/2.0"})
                    with urllib.request.urlopen(req, timeout=4) as resp:
                        geo_data = json.loads(resp.read().decode("utf-8"))
                        items = geo_data.get("results") or []
                        if items:
                            lat = items[0].get("latitude")
                            lon = items[0].get("longitude")
                            city_label = f"{items[0].get('name')}, {items[0].get('country', '')}".strip(", ")
                except Exception:
                    pass

        if lat is None or lon is None:
            lat, lon, city_label = 21.0285, 105.8542, "Hà Nội"

        try:
            weather_url = (
                f"https://api.open-meteo.com/v1/forecast?"
                f"latitude={lat}&longitude={lon}"
                f"&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m"
                f"&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,uv_index_max"
                f"&timezone=Asia%2FBangkok&forecast_days=3"
            )
            req = urllib.request.Request(weather_url, headers={"User-Agent": "MultiAgentSystem/2.0"})
            with urllib.request.urlopen(req, timeout=5) as resp:
                w_data = json.loads(resp.read().decode("utf-8"))

            current = w_data.get("current") or {}
            daily = w_data.get("daily") or {}

            temp = current.get("temperature_2m")
            feels_like = current.get("apparent_temperature")
            humidity = current.get("relative_humidity_2m")
            wind = current.get("wind_speed_10m")
            precip = current.get("precipitation", 0)
            w_code = int(current.get("weather_code", 0))
            condition_str = WMO_WEATHER_CODES.get(w_code, "Thời tiết ổn định")

            max_temps = daily.get("temperature_2m_max") or []
            min_temps = daily.get("temperature_2m_min") or []
            rain_probs = daily.get("precipitation_probability_max") or []
            uv_max = daily.get("uv_index_max") or []

            t_max = max_temps[0] if max_temps else temp
            t_min = min_temps[0] if min_temps else temp
            rain_prob = rain_probs[0] if rain_probs else 0
            uv_val = uv_max[0] if uv_max else "N/A"

            today_str = datetime.datetime.now().strftime("%d/%m/%Y %H:%M")
            snippet = (
                f"[Cập nhật thời gian thực {today_str}] Thời tiết tại {city_label}: "
                f"Trạng thái: {condition_str}. "
                f"Nhiệt độ hiện tại: {temp}°C (Cảm giác thực tế như: {feels_like}°C). "
                f"Biên độ nhiệt trong ngày hôm nay: Thấp nhất {t_min}°C - Cao nhất {t_max}°C. "
                f"Độ ẩm không khí: {humidity}%. Tốc độ gió: {wind} km/h. "
                f"Lượng mưa hiện tại: {precip} mm (Xác suất có mưa hôm nay: {rain_prob}%). Chỉ số UV tối đa: {uv_val}."
            )
            if len(max_temps) > 1 and len(min_temps) > 1:
                tomorrow_code = int((daily.get("weather_code") or [w_code, w_code])[1])
                tomorrow_cond = WMO_WEATHER_CODES.get(tomorrow_code, "Ổn định")
                snippet += (
                    f" Dự báo ngày mai tại {city_label}: {tomorrow_cond}, "
                    f"nhiệt độ từ {min_temps[1]}°C đến {max_temps[1]}°C."
                )

            return {
                "title": f"Thời tiết trực tiếp tại {city_label} hôm nay ({today_str})",
                "snippet": snippet,
                "url": "https://open-meteo.com/",
            }
        except Exception:
            return None

    def execute(self, arguments: Dict[str, Any]) -> str:
        try:
            if isinstance(arguments, str):
                query = arguments
            elif isinstance(arguments, dict):
                query = (
                    arguments.get("query")
                    or arguments.get("q")
                    or arguments.get("input")
                    or ""
                )
            else:
                query = str(arguments or "")

            query = query.strip()
            if not query:
                return json.dumps(
                    {"success": False, "error": "Từ khóa tìm kiếm không được để trống."},
                    ensure_ascii=False,
                )

            results: List[Dict[str, str]] = []

            # 0. Nếu câu hỏi liên quan đến thời tiết, lấy dữ liệu khí tượng thời gian thực ngay lập tức
            if self._is_weather_query(query):
                weather_item = self._fetch_live_weather(query)
                if weather_item:
                    results.append(weather_item)

            # 1. Thử dùng thư viện duckduckgo_search (DDGS) nếu có
            try:
                from duckduckgo_search import DDGS

                with DDGS() as ddgs:
                    for r in ddgs.text(query, max_results=5):
                        results.append(
                            {
                                "title": r.get("title", ""),
                                "snippet": r.get("body", ""),
                                "url": r.get("href", ""),
                            }
                        )
            except Exception:
                pass

            # 2. Fallback: cào nhẹ trang DuckDuckGo HTML (không cần API key, hỗ trợ tiếng Việt tốt)
            if len(results) < 2:
                try:
                    ddg_html_url = f"https://html.duckduckgo.com/html/?q={urllib.parse.quote(query)}"
                    req = urllib.request.Request(
                        ddg_html_url,
                        headers={
                            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
                            "Accept-Language": "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7",
                        },
                    )
                    with urllib.request.urlopen(req, timeout=6) as resp:
                        raw_html = resp.read().decode("utf-8", errors="ignore")
                        blocks = re.findall(
                            r'<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>(.*?)</a>.*?<a[^>]*class="result__snippet"[^>]*>(.*?)</a>',
                            raw_html,
                            flags=re.DOTALL,
                        )
                        for href, raw_title, raw_snippet in blocks[:4]:
                            clean_title = html.unescape(re.sub(r"<[^>]+>", "", raw_title)).strip()
                            clean_snippet = html.unescape(re.sub(r"<[^>]+>", "", raw_snippet)).strip()
                            if clean_title and clean_snippet:
                                results.append(
                                    {
                                        "title": clean_title,
                                        "snippet": clean_snippet,
                                        "url": href,
                                    }
                                )
                except Exception:
                    pass

            # 3. Fallback gọi DuckDuckGo Instant Answer API
            if not results:
                try:
                    encoded = urllib.parse.quote(query)
                    url = f"https://api.duckduckgo.com/?q={encoded}&format=json&no_html=1&skip_disambig=1"
                    req = urllib.request.Request(
                        url, headers={"User-Agent": "MultiAgentSystem/2.0"}
                    )
                    with urllib.request.urlopen(req, timeout=5) as resp:
                        data = json.loads(resp.read().decode("utf-8"))
                        if data.get("AbstractText"):
                            results.append(
                                {
                                    "title": data.get("Heading") or query,
                                    "snippet": data.get("AbstractText"),
                                    "url": data.get("AbstractURL") or "https://duckduckgo.com",
                                }
                            )
                        for topic in (data.get("RelatedTopics") or [])[:4]:
                            if isinstance(topic, dict) and topic.get("Text"):
                                results.append(
                                    {
                                        "title": topic.get("Text", "")[:80],
                                        "snippet": topic.get("Text", ""),
                                        "url": topic.get("FirstURL", ""),
                                    }
                                )
                except Exception:
                    pass

            # 4. Fallback Wikipedia Tiếng Việt & Tiếng Anh nếu vẫn chưa có kết quả
            if not results:
                for lang in ("vi", "en"):
                    try:
                        wiki_url = (
                            f"https://{lang}.wikipedia.org/w/api.php?"
                            f"action=query&list=search&srsearch={urllib.parse.quote(query)}&utf8=&format=json&srlimit=3"
                        )
                        req = urllib.request.Request(
                            wiki_url, headers={"User-Agent": "MultiAgentSystem/2.0"}
                        )
                        with urllib.request.urlopen(req, timeout=5) as resp:
                            w_data = json.loads(resp.read().decode("utf-8"))
                            search_items = (w_data.get("query") or {}).get("search") or []
                            for item in search_items:
                                title = item.get("title", "")
                                snippet = html.unescape(re.sub(r"<[^>]+>", "", item.get("snippet", ""))).strip()
                                if title and snippet:
                                    results.append(
                                        {
                                            "title": f"{title} (Wikipedia)",
                                            "snippet": snippet,
                                            "url": f"https://{lang}.wikipedia.org/wiki/{urllib.parse.quote(title.replace(' ', '_'))}",
                                        }
                                    )
                        if results:
                            break
                    except Exception:
                        pass

            return json.dumps(
                {
                    "success": True,
                    "provider": "duckduckgo_free",
                    "query": query,
                    "total_results": len(results),
                    "results": results,
                },
                ensure_ascii=False,
            )
        except Exception as e:
            return json.dumps({"success": False, "error": str(e)}, ensure_ascii=False)


# Alias tương thích ngược
WebSearchTool = DuckDuckGoSearchTool
