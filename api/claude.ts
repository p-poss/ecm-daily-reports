import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Vercel serverless function that proxies requests to the Anthropic
 * Messages API. Keeps ANTHROPIC_API_KEY server-side (no VITE_ prefix).
 *
 * The frontend POSTs to /api/claude with the same body it would send
 * to the Anthropic API. This function adds the auth headers and
 * forwards the request.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(req.body),
    });

    const data = await response.json();

    // Forward the status code and body from Anthropic.
    return res.status(response.status).json(data);
  } catch (error) {
    console.error('Anthropic proxy error:', error);
    return res.status(502).json({
      error: 'Failed to reach Anthropic API',
      detail: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
