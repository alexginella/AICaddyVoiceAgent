/**
 * Local dev server for the token API.
 * Run from frontend/: node api-server.js
 * Loads .env from project root.
 */
import { createServer } from 'http';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';
import { AccessToken } from 'livekit-server-sdk';
import { RoomConfiguration, RoomAgentDispatch } from '@livekit/protocol';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '..', '.env') });

const PORT = 3001;

const handler = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.url?.startsWith('/api/nearby-courses') && req.method === 'GET') {
    const url = new URL(req.url, `http://localhost`);
    const latParam = url.searchParams.get('lat');
    const lngParam = url.searchParams.get('lng');
    const location = url.searchParams.get('location');
    let searchLat, searchLng;
    if (latParam != null && lngParam != null) {
      searchLat = parseFloat(latParam);
      searchLng = parseFloat(lngParam);
      if (isNaN(searchLat) || isNaN(searchLng)) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid lat/lng' }));
        return;
      }
    } else if (location && location.trim()) {
      try {
        const geoRes = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(location.trim())}&format=json&limit=1`,
          { headers: { 'User-Agent': 'AICaddyVoiceAgent/1.0' } }
        );
        const geoText = await geoRes.text();
        if (!geoRes.ok) {
          throw new Error('Geocoding service temporarily unavailable');
        }
        if (geoText.trimStart().startsWith('<')) {
          throw new Error('Geocoding service temporarily unavailable');
        }
        const geoData = JSON.parse(geoText);
        if (!geoData?.length) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Location not found' }));
          return;
        }
        searchLat = parseFloat(geoData[0].lat);
        searchLng = parseFloat(geoData[0].lon);
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e?.message || 'Unknown error' }));
        return;
      }
    } else {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Provide lat and lng, or location (city/zip)' }));
      return;
    }
    try {
      const radius = 50000;
      const query = `[out:json][timeout:25];
( node(around:${radius},${searchLat},${searchLng})["leisure"="golf_course"];
  way(around:${radius},${searchLat},${searchLng})["leisure"="golf_course"]; );
out body;>;out skel qt;`;
      let elements = [];
      for (let attempt = 0; attempt < 2; attempt++) {
        const overpassRes = await fetch('https://overpass-api.de/api/interpreter', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: `data=${encodeURIComponent(query)}`,
        });
        const opText = await overpassRes.text();
        if (!overpassRes.ok) {
          throw new Error(`Overpass request failed: ${overpassRes.status}`);
        }
        if (opText.trimStart().startsWith('<')) {
          if (attempt === 0) {
            await new Promise((r) => setTimeout(r, 2000));
            continue;
          }
          throw new Error('Course lookup service temporarily unavailable. Please try again.');
        }
        const opData = JSON.parse(opText);
        elements = opData.elements ?? [];
        break;
      }
      const seen = new Set();
      const results = [];
      const haversine = (lat1, lon1, lat2, lon2) => {
        const R = 6371;
        const dLat = ((lat2 - lat1) * Math.PI) / 180;
        const dLon = ((lon2 - lon1) * Math.PI) / 180;
        const a =
          Math.sin(dLat / 2) ** 2 +
          Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      };
      for (const el of elements) {
        const name = el.tags?.name?.trim();
        if (!name || seen.has(name.toLowerCase())) continue;
        seen.add(name.toLowerCase());
        let elLat = el.lat ?? el.center?.lat;
        let elLon = el.lon ?? el.center?.lon;
        const distanceStr =
          elLat != null && elLon != null
            ? (() => {
                const km = haversine(elLat, elLon, searchLat, searchLng);
                return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
              })()
            : undefined;
        results.push({ name, distance: distanceStr });
      }
      results.sort((a, b) => {
        const parseD = (d) => {
          if (!d) return Infinity;
          const m = d.match(/([\d.]+)\s*(km|m)/i);
          return !m ? Infinity : m[2].toLowerCase() === 'km' ? parseFloat(m[1]) : parseFloat(m[1]) / 1000;
        };
        return parseD(a.distance) - parseD(b.distance);
      });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ courses: results.slice(0, 5) }));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e?.message || 'Unknown error' }));
    }
    return;
  }

  if (req.url === '/api/ensure-guide' && req.method === 'POST') {
    try {
      const guideUrl = process.env.GUIDE_SERVICE_URL || 'http://127.0.0.1:8765';
      const body = await new Promise((resolve, reject) => {
        let data = '';
        req.on('data', (c) => (data += c));
        req.on('end', () => {
          try {
            resolve(JSON.parse(data || '{}'));
          } catch {
            resolve({});
          }
        });
        req.on('error', reject);
      });
      const r = await fetch(`${guideUrl.replace(/\/$/, '')}/ensure-guide`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const text = await r.text();
      res.writeHead(r.status, { 'Content-Type': 'application/json' });
      res.end(text);
    } catch (e) {
      console.error(e);
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          error:
            e?.message ||
            'Course guide service unavailable. Start it: cd agent && uv run uvicorn guide_service_app:app --app-dir src --host 127.0.0.1 --port 8765',
        }),
      );
    }
    return;
  }

  if (req.url === '/api/token' && req.method === 'POST') {
    try {
      const url = process.env.LIVEKIT_URL;
      const apiKey = process.env.LIVEKIT_API_KEY;
      const apiSecret = process.env.LIVEKIT_API_SECRET;

      if (!url || !apiKey || !apiSecret) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Set LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET' }));
        return;
      }

      const body = await new Promise((resolve, reject) => {
        let data = '';
        req.on('data', (c) => (data += c));
        req.on('end', () => {
          try {
            resolve(JSON.parse(data || '{}'));
          } catch {
            resolve({});
          }
        });
        req.on('error', reject);
      });

      const { roomName, identity, name, userProfile, selectedCourse } = body;
      const rn = roomName ?? `caddy-${Date.now()}`;
      const id = identity ?? `user-${Date.now()}`;
      const displayName = name ?? 'Golfer';

      const metadata = JSON.stringify({
        userProfile: userProfile ?? {},
        selectedCourse: selectedCourse ?? { name: '' },
      });

      const at = new AccessToken(apiKey, apiSecret, {
        identity: id,
        name: displayName,
        ttl: '1h',
        metadata,
      });

      at.addGrant({
        roomJoin: true,
        room: rn,
        canPublish: true,
        canSubscribe: true,
      });

      at.roomConfig = new RoomConfiguration({
        agents: [
          new RoomAgentDispatch({
            agentName: 'my-agent',
            metadata,
          }),
        ],
      });

      const token = await at.toJwt();

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ accessToken: token, roomName: rn }));
    } catch (e) {
      console.error(e);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e?.message || 'Unknown error' }));
    }
    return;
  }

  res.writeHead(404);
  res.end('Not found');
};

createServer(handler).listen(PORT, () => {
  console.log(`Token API at http://localhost:${PORT}`);
});
