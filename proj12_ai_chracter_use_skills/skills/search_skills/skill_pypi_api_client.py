import httpx

class PyPIApiClient:
    def get_package_info(self, package_name: str) -> dict:
        '''Trả về JSON từ PyPI API cho package_name'''
        url = f"https://pypi.org/pypi/{package_name}/json"
        response = httpx.get(url, timeout=15.0, follow_redirects=True, headers={"User-Agent": "AutoEvolveBot/1.0 (https://example.org)"})
        if response.status_code != 200:
            raise RuntimeError(f"Failed to fetch package info for {package_name}: Status code {response.status_code}, Response: {response.text}")
        try:
            data = response.json()
            if not data or "info" not in data:
                raise RuntimeError(f"Invalid or missing JSON response for {package_name}: {data}")
            return data
        except ValueError as e:
            raise RuntimeError(f"Invalid JSON response for {package_name}: {str(e)}")