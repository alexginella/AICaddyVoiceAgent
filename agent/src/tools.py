"""
Tools for the AI Caddy - get_nearby_golf_courses (and update_my_yardages logic).
"""


async def get_nearby_golf_courses(location: str) -> str:
    """
    Find nearby golf courses for the given location.
    Uses mock data for demo; can be wired to Overpass API in production.
    """
    # Mock data for demo - in production, use Overpass/OpenStreetMap or golf course API
    mock_courses = [
        {"name": "Pebble Beach Golf Links", "distance": "2 mi"},
        {"name": "Spyglass Hill Golf Course", "distance": "3 mi"},
        {"name": "The Links at Spanish Bay", "distance": "4 mi"},
    ]
    results = [f"- {c['name']} ({c['distance']})" for c in mock_courses]
    return f"Golf courses near {location}:\n" + "\n".join(results)
