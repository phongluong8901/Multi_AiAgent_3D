import httpx


class FrankfurterForexClient:
    """Fetch latest forex exchange rates via Frankfurter (ECB) with open.er-api fallback (supports VND, etc.)."""

    def get_exchange_rate(self, from_currency: str, to_currency: str) -> float:
        base = (from_currency or "").strip().upper()
        target = (to_currency or "").strip().upper()
        headers = {"User-Agent": "AutoEvolveBot/1.0 (https://example.org)"}

        # 1. Primary: Frankfurter (ECB reference rates)
        url = f"https://api.frankfurter.app/latest?from={base}&to={target}"
        response = httpx.get(url, timeout=15.0, follow_redirects=True, headers=headers)
        if response.status_code == 200:
            data = response.json()
            rates = data.get("rates", {})
            exchange_rate = rates.get(target)
            if exchange_rate is not None:
                return float(exchange_rate)

        # 2. Fallback: open.er-api.com (zero-key, supports 160+ currencies including VND)
        fallback_url = f"https://open.er-api.com/v6/latest/{base}"
        fb_resp = httpx.get(fallback_url, timeout=15.0, follow_redirects=True, headers=headers)
        if fb_resp.status_code == 200:
            fb_data = fb_resp.json()
            if fb_data.get("result") == "success":
                fb_rate = (fb_data.get("rates") or {}).get(target)
                if fb_rate is not None:
                    return float(fb_rate)

        raise RuntimeError(
            f"Failed to fetch exchange rate for {base}->{target}. "
            f"Frankfurter HTTP {response.status_code}, fallback HTTP {fb_resp.status_code}"
        )