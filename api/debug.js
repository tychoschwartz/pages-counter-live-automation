/**
 * GET /api/debug?handle=execute
 *
 * One-shot verification tool. After deploying, open this in your browser to
 * confirm your Social Blade credentials work and see how one page parses:
 *
 *   /api/debug                → checks @execute
 *   /api/debug?handle=opusreality
 *
 * Returns whether the token is configured, the parsed result, and (when
 * ?raw=1) the raw upstream shape so the parser can be matched to your plan's
 * response. Never cached. Does not expose the token.
 */

import { fetchHandle } from './_socialblade.js';

export default async function handler(req, res) {
  const clientId = process.env.SOCIALBLADE_CLIENT_ID;
  const token = process.env.SOCIALBLADE_TOKEN;
  const handle = (req.query.handle || 'execute').toString().replace(/[^a-z0-9._]/gi, '');

  res.setHeader('Cache-Control', 'no-store');

  if (!clientId || !token) {
    res.status(200).json({
      ok: false,
      credentialsConfigured: false,
      hint: 'Set SOCIALBLADE_CLIENT_ID and SOCIALBLADE_TOKEN in Vercel → Settings → Environment Variables, then redeploy.',
    });
    return;
  }

  const result = await fetchHandle(handle, { clientId, token });
  res.status(200).json({
    ok: result.ok,
    credentialsConfigured: true,
    handle,
    parsed: result,
    note: result.ok
      ? 'Credentials work — the site will show live numbers for this handle.'
      : `Fetch failed (${result.error}). If it is not a credentials error, the response schema may differ — share this output and the parser can be adjusted.`,
  });
}
