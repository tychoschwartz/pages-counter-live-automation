/**
 * GET /api/cron  — invoked by Vercel Cron once a day (see vercel.json).
 *
 * Forces a fresh Social Blade fetch and stores the snapshot so the site is
 * up to date every single day without depending on visitor traffic. This is
 * what makes the counters refresh "keer op keer", automatically.
 *
 * Optionally protected: if CRON_SECRET is set, Vercel sends it as
 * `Authorization: Bearer <CRON_SECRET>` and we reject anything else.
 */

import { computeStats, writeSnapshot } from './_core.js';

export default async function handler(req, res) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.authorization || '';
    if (auth !== `Bearer ${secret}`) {
      res.status(401).json({ ok: false, error: 'unauthorized' });
      return;
    }
  }

  const body = await computeStats();
  const stored = await writeSnapshot(body).catch(() => false);

  // Never cache the cron response.
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({
    ok: true,
    refreshedAt: body.updatedAt,
    source: body.source,
    stored,                       // true if written to Vercel KV
    managedPages: body.totals.managedPages,
    followersUnderManagement: body.totals.followersUnderManagement,
    livePages: Object.values(body.pages).filter((p) => p.live).length,
  });
}
