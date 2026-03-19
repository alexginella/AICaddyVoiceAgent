"""
Tools for the AI Caddy - get_nearby_golf_courses (uses Overpass/OpenStreetMap).
"""
import math
from urllib.parse import quote

import httpx

OVERPASS_URL = "https://overpass-api.de/api/interpreter"
NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
RADIUS_M = 50000


def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _parse_dist_km(d: str | None) -> float:
    if not d:
        return float("inf")
    m = d.replace(" km", "").replace(" m", "")
    try:
        val = float(m.split()[0])
        return val if "km" in (d or "") else val / 1000
    except (ValueError, IndexError):
        return float("inf")


async def _geocode(location: str) -> tuple[float, float] | None:
    async with httpx.AsyncClient() as client:
        r = await client.get(
            f"{NOMINATIM_URL}?q={location}&format=json&limit=1",
            headers={"User-Agent": "AICaddyVoiceAgent/1.0"},
            timeout=10,
        )
    if r.status_code != 200:
        return None
    data = r.json()
    if not data:
        return None
    return float(data[0]["lat"]), float(data[0]["lon"])


async def get_nearby_golf_courses(location: str) -> str:
    """
    Find nearby golf courses for the given location.
    Uses Nominatim for geocoding and Overpass (OpenStreetMap) for golf courses.
    """
    coords = await _geocode(location.strip())
    if not coords:
        return f"Could not find location '{location}'. Try a city name or zip code."
    lat, lng = coords
    query = f"""
[out:json][timeout:25];
( node(around:{RADIUS_M},{lat},{lng})["leisure"="golf_course"];
  way(around:{RADIUS_M},{lat},{lng})["leisure"="golf_course"]; );
out body;>;out skel qt;
    """.strip()
    try:
        async with httpx.AsyncClient() as client:
            r = await client.post(
                OVERPASS_URL,
                content=f"data={quote(query)}",
                headers={"Content-Type": "application/x-www-form-urlencoded"},
                timeout=30,
            )
        r.raise_for_status()
        data = r.json()
    except Exception:
        return f"Golf courses near {location}: (search temporarily unavailable)"

    seen = set()
    results = []
    for el in data.get("elements", []):
        name = (el.get("tags") or {}).get("name", "").strip()
        if not name or name.lower() in seen:
            continue
        seen.add(name.lower())
        el_lat = el.get("lat") or (el.get("center") or {}).get("lat")
        el_lon = el.get("lon") or (el.get("center") or {}).get("lon")
        dist = None
        if el_lat is not None and el_lon is not None:
            km = _haversine_km(el_lat, el_lon, lat, lng)
            dist = f"{km:.1f} km" if km >= 1 else f"{int(km * 1000)} m"
        results.append((name, dist))

    results.sort(key=lambda x: _parse_dist_km(x[1]))
    lines = [f"- {n}" + (f" ({d})" if d else "") for n, d in results[:5]]
    return f"Golf courses near {location}:\n" + "\n".join(lines) if lines else f"No golf courses found near {location}."
