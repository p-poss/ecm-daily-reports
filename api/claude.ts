import type { VercelRequest, VercelResponse } from '@vercel/node';

const ALLOWED_MODELS = new Set([
  'claude-sonnet-4-6',
  'claude-haiku-4-5',
  'claude-haiku-4-5-20251001',
]);
const MAX_OUTPUT_TOKENS = 2048;

const RATE_LIMIT = 20;
const RATE_WINDOW_MS = 60_000;
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return false;
  }
  entry.count++;
  if (rateLimitMap.size > 500) {
    for (const [k, v] of rateLimitMap) {
      if (now > v.resetAt) rateLimitMap.delete(k);
    }
  }
  return entry.count > RATE_LIMIT;
}

function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return false;
  const allowed = (process.env.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return allowed.includes(origin);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!isAllowedOrigin(req.headers.origin)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const ip =
    (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ??
    (req.headers['x-real-ip'] as string | undefined) ??
    'unknown';
  if (isRateLimited(ip)) {
    return res.status(429).json({ error: 'Too many requests' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });
  }

  const body = (req.body ?? {}) as Record<string, unknown>;
  const model = typeof body.model === 'string' ? body.model : '';
  if (!ALLOWED_MODELS.has(model)) {
    return res.status(400).json({ error: 'Invalid model' });
  }

  const requestedMax = typeof body.max_tokens === 'number' ? body.max_tokens : MAX_OUTPUT_TOKENS;
  const safeBody = { ...body, max_tokens: Math.min(requestedMax, MAX_OUTPUT_TOKENS) };

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(safeBody),
    });

    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (error) {
    console.error('Anthropic proxy error:', error);
    return res.status(502).json({
      error: 'Failed to reach Anthropic API',
      detail: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
