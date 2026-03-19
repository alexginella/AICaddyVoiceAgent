/**
 * Nearby golf courses API.
 * Uses Overpass (OpenStreetMap) for location search.
 * Vercel serverless: GET /api/nearby-courses?lat=37.77&lng=-122.42
 *                    GET /api/nearby-courses?location=San+Francisco
 */
import type { VercelRequest, VercelResponse } from './vercel-types';

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const RADIUS_M = 50000; // 50km

interface OverpassElement {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: { name?: string; leisure?: string; [k: string]: string | undefined };
}

interface GeocodeResult {
  lat: string;
  lon: string;
  display_name: string;
}

async function geocodeLocation(location: string): Promise<{ lat: number; lng: number } | null> {
  const res = await fetch(
    `${NOMINATIM_URL}?q=${encodeURIComponent(location)}&format=json&limit=1`,
    { headers: { 'User-Agent': 'AICaddyVoiceAgent/1.0' } }
  );
  const text = await res.text();
  if (!res.ok) return null;
  if (text.trimStart().startsWith('<')) {
    throw new Error('Geocoding service temporarily unavailable');
  }
  const data = JSON.parse(text) as GeocodeResult[];
  if (!data?.length) return null;
  return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
}

async function fetchGolfCourses(lat: number, lng: number): Promise<Array<{ name: string; distance?: string }>> {
  const query = `
[out:json][timeout:25];
(
  node(around:${RADIUS_M},${lat},${lng})["leisure"="golf_course"];
  way(around:${RADIUS_M},${lat},${lng})["leisure"="golf_course"];
);
out body;
>;
out skel qt;
  `.trim();

  let elements: OverpassElement[] = [];
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fetch(OVERPASS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `data=${encodeURIComponent(query)}`,
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`Overpass request failed: ${res.status}`);
    if (text.trimStart().startsWith('<')) {
      if (attempt === 0) {
        await new Promise((r) => setTimeout(r, 2000));
        continue;
      }
      throw new Error('Course lookup service temporarily unavailable. Please try again.');
    }
    const data = JSON.parse(text) as { elements?: OverpassElement[] };
    elements = data.elements ?? [];
    break;
  }

  const seen = new Set<string>();
  const results: Array<{ name: string; distance?: string }> = [];
  for (const el of elements) {
    const name = el.tags?.name?.trim();
    if (!name || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());

    let elLat = el.lat;
    let elLon = el.lon;
    if (el.center) {
      elLat = el.center.lat;
      elLon = el.center.lon;
    }
    let distanceStr: string | undefined;
    if (elLat != null && elLon != null) {
      const km = haversine(elLat, elLon, lat, lng);
      distanceStr = km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
    }
    results.push({ name, distance: distanceStr });
  }
  results.sort((a, b) => {
    const dA = parseDistance(a.distance);
    const dB = parseDistance(b.distance);
    return dA - dB;
  });
  return results.slice(0, 5);
}

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function parseDistance(d?: string): number {
  if (!d) return Infinity;
  const m = d.match(/([\d.]+)\s*(km|m)/i);
  if (!m) return Infinity;
  const n = parseFloat(m[1]);
  return m[2].toLowerCase() === 'km' ? n : n / 1000;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { lat, lng, location } = req.query as { lat?: string; lng?: string; location?: string };
  let searchLat: number;
  let searchLng: number;

  if (lat != null && lng != null) {
    searchLat = parseFloat(lat);
    searchLng = parseFloat(lng);
    if (isNaN(searchLat) || isNaN(searchLng)) {
      return res.status(400).json({ error: 'Invalid lat/lng' });
    }
  } else if (location && typeof location === 'string' && location.trim()) {
    try {
      const coords = await geocodeLocation(location.trim());
      if (!coords) {
        return res.status(404).json({ error: 'Location not found' });
      }
      searchLat = coords.lat;
      searchLng = coords.lng;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error';
      return res.status(500).json({ error: msg });
    }
  } else {
    return res.status(400).json({ error: 'Provide lat and lng, or location (city/zip)' });
  }

  try {
    const courses = await fetchGolfCourses(searchLat, searchLng);
    return res.status(200).json({ courses });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return res.status(500).json({ error: msg });
  }
}
