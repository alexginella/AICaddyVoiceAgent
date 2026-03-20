import type { VercelRequest, VercelResponse } from './vercel-types';
import { AccessToken } from 'livekit-server-sdk';
import { RoomConfiguration, RoomAgentDispatch } from '@livekit/protocol';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;

  if (!apiKey || !apiSecret) {
    return res.status(500).json({ error: 'LiveKit credentials not configured' });
  }

  try {
    const body = req.body ?? {};
    const { roomName, identity, name, userProfile, selectedCourse } = body as {
      roomName?: string;
      identity?: string;
      name?: string;
      userProfile?: Record<string, unknown>;
      selectedCourse?: { name?: string; guideSlug?: string };
    };

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

    return res.status(200).json({
      accessToken: token,
      roomName: rn,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return res.status(500).json({ error: msg });
  }
}
