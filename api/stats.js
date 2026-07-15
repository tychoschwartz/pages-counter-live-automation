/**
 * GET /api/stats
 *
 * What the browser fetches. Returns live Instagram figures for every page,
 * merged over baked-in fallbacks so the response is always complete. The
 * Social Blade token stays server-side; the browser only ever sees numbers.
 *
 * Freshness strategy:
 *   1. If a Vercel KV snapshot exists and is < 25h old → serve it (instant,
 *      zero Social Blade credits spent on visitor traffic). The daily cron
 *      (/api/cron) keeps that snapshot fresh.
 *   2. Otherwise compute live from Social Blade, best-effort store the
 *      snapshot, and return it.
 *
 * Either way the response is edge-cached for 24h so bursts of traffic don't
 * hit the origin repeatedly.
 */

import { computeStats, readSnapshot, writeSnapshot, isFresh } from './_core.js';

const DAY = 86400;

export default async function handler(req, res) {
  let body = null;

  // 1) Prefer a fresh persisted snapshot (written by the daily cron).
  try {
    const snap = await readSnapshot();
    if (snap && isFresh(snap)) body = { ...snap, served: 'snapshot' };
  } catch { /* ignore, fall through to live */ }

  // 2) No fresh snapshot — compute live and persist for next time.
  if (!body) {
    body = await computeStats();
    body.served = 'live';
    writeSnapshot(body).catch(() => {});
  }

  res.setHeader('Cache-Control', `public, s-maxage=${DAY}, stale-while-revalidate=${DAY}`);
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.status(200).json(body);
}
