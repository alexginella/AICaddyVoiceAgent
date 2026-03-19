/**
 * Local dev server for the token API.
 * Run: node api-server.js
 * Requires: LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET
 */
import { createServer } from 'http';
import { AccessToken } from 'livekit-server-sdk';

const PORT = 3001;

const handler = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
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

      const { roomName, identity, name, clubYardages } = body;
      const rn = roomName ?? `caddy-${Date.now()}`;
      const id = identity ?? `user-${Date.now()}`;
      const displayName = name ?? 'Golfer';

      const at = new AccessToken(apiKey, apiSecret, {
        identity: id,
        name: displayName,
        ttl: '1h',
        metadata: JSON.stringify({ clubYardages: clubYardages ?? {} }),
      });

      at.addGrant({
        roomJoin: true,
        room: rn,
        canPublish: true,
        canSubscribe: true,
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
