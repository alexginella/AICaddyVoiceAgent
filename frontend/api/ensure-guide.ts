/**
 * Proxies POST /api/ensure-guide to the Course Guide Service (same contract as api-server.js).
 * Vercel: set GUIDE_SERVICE_URL to the public HTTPS origin of the guide (server-side only).
 */
import type { VercelRequest, VercelResponse } from './vercel-types';

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

  const guideUrl = process.env.GUIDE_SERVICE_URL?.trim();
  if (!guideUrl) {
    return res.status(500).json({
      error:
        'GUIDE_SERVICE_URL is not configured. Set it in Vercel to your public Course Guide Service HTTPS base URL.',
    });
  }

  try {
    const base = guideUrl.replace(/\/$/, '');
    let body: string;
    if (typeof req.body === 'string') {
      body = req.body;
    } else if (req.body != null && typeof req.body === 'object') {
      body = JSON.stringify(req.body);
    } else {
      body = '{}';
    }

    const r = await fetch(`${base}/ensure-guide`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });

    const text = await r.text();
    let payload: unknown;
    try {
      payload = text ? JSON.parse(text) : {};
    } catch {
      payload = { error: text || 'Invalid response from course guide service' };
    }
    return res.status(r.status).json(payload);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return res.status(502).json({
      error:
        msg ||
        'Course guide service unavailable. Check GUIDE_SERVICE_URL and network access from Vercel.',
    });
  }
}
