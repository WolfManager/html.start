import json
import urllib.error
import urllib.request
from typing import Any


def _fetch_json(url: str) -> dict[str, Any]:
    request = urllib.request.Request(url, headers={"User-Agent": "magneto-django"})
    with urllib.request.urlopen(request, timeout=6) as response:
        payload = response.read().decode("utf-8", errors="replace")
    data = json.loads(payload)
    if not isinstance(data, dict):
        raise ValueError("Invalid location payload")
    return data


def resolve_approx_location() -> dict[str, Any]:
    providers: list[tuple[str, str]] = [
        ("https://ipwho.is/", "ipwho.is"),
        ("https://ipapi.co/json/", "ipapi.co"),
    ]

    for url, source in providers:
        try:
            data = _fetch_json(url)
            if source == "ipwho.is" and data.get("success") is False:
                continue
            if source == "ipapi.co" and data.get("error"):
                continue

            latitude = float(data.get("latitude"))
            longitude = float(data.get("longitude"))
            return {
                "latitude": latitude,
                "longitude": longitude,
                "city": str(data.get("city") or ""),
                "country": str(data.get("country") or data.get("country_name") or ""),
                "source": source,
            }
        except (ValueError, TypeError, urllib.error.URLError, urllib.error.HTTPError, TimeoutError, json.JSONDecodeError):
            continue

    raise RuntimeError("All IP location providers failed.")
