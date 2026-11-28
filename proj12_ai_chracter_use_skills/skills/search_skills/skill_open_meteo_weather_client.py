import httpx

class OpenMeteoWeatherClient:
    def get_current_weather(self, city):
        geocoding_url = "https://geocoding-api.open-meteo.com/v1/search"
        forecast_url = "https://api.open-meteo.com/v1/forecast"
        headers = {"User-Agent": "AutoEvolveBot/1.0"}
        timeout = 15.0

        try:
            # Get geocoding data
            geocoding_params = {"name": city, "count": 1, "format": "json"}
            response = httpx.get(geocoding_url, params=geocoding_params, headers=headers, timeout=timeout)
            response.raise_for_status()
            geocoding_data = response.json()

            if not geocoding_data.get("results"):
                return {"error": f"City '{city}' not found."}

            # Extract latitude and longitude
            latitude = geocoding_data["results"][0]["latitude"]
            longitude = geocoding_data["results"][0]["longitude"]

            # Get weather forecast
            forecast_params = {
                "latitude": latitude,
                "longitude": longitude,
                "current_weather": "true",
                "format": "json"
            }
            response = httpx.get(forecast_url, params=forecast_params, headers=headers, timeout=timeout)
            response.raise_for_status()
            weather_data = response.json()

            if not weather_data.get("current_weather"):
                return {"error": "Invalid response"}

            return weather_data["current_weather"]

        except httpx.HTTPStatusError as e:
            return {"error": f"HTTP error occurred: {e}"}
        except Exception as e:
            return {"error": str(e)}