import httpx
from typing import Dict

class WeatherAPIClient:
    def get_current_weather(self, city: str) -> Dict:
        base_url = "https://api.open-meteo.com/v1/forecast"
        params = {
            "latitude": self.get_latitude(city),
            "longitude": self.get_longitude(city),
            "current_weather": "true"
        }
        
        try:
            response = httpx.get(base_url, params=params)
            response.raise_for_status()
            try:
                data = response.json()
            except ValueError as json_err:
                raise Exception(f"JSON decode error: {json_err}")
            if 'current_weather' not in data:
                raise ValueError("Weather data not found in response")
            return data['current_weather']
        except httpx.HTTPStatusError as http_err:
            raise Exception(f"HTTP error occurred: {http_err}")
        except Exception as err:
            raise Exception(f"An error occurred: {err}")

    def get_latitude(self, city: str) -> float:
        # Đây chỉ là một ví dụ, bạn cần triển khai hàm này để lấy tọa độ latitude của thành phố
        if city.lower() == "hanoi":
            return 21.028511
        raise ValueError(f"City {city} not found")

    def get_longitude(self, city: str) -> float:
        # Đây chỉ là một ví dụ, bạn cần triển khai hàm này để lấy tọa độ longitude của thành phố
        if city.lower() == "hanoi":
            return 105.854167
        raise ValueError(f"City {city} not found")