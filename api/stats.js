/**
 * GET /api/stats
 *
 * Returns live Instagram figures for every page on the site, merged over the
 * baked-in fallbacks so the response is always complete. The Social Blade
 * token stays server-side; the browser only ever sees numbers.
 *
 * The response is cached at Vercel's edge for 24h (s-maxage) with
 * stale-while-revalidate, so at most one origin call per region per day
 * reaches Social Blade — keeping API credit usage low.
 */

import { ALL_PAGES, CHART_HANDLES } from '../data/pages.js';
import { fetchMany } from './_socialblade.js';

const DAY = 86400;

/** Merge a live result over a page's fallback, keeping fallback for missing fields. */
function merge(page, live) {
  const fb = page.fallback || {};
  const useLive = live && live.ok;
  return {
    handle: page.handle,
    managed: !!page.managed,
    own: !!page.own,
    editor: !!page.editor,
    live: !!useLive,
    followers: useLive && Number.isFinite(live.followers) ? live.followers : fb.followers,
    avgLikes: (useLive && Number.isFinite(live.avgLikes) ? live.avgLikes : fb.avgLikes) ?? null,
    media: (useLive && Number.isFinite(live.media) ? live.media : fb.media) ?? null,
    grade: (useLive && live.grade) ? String(live.grade) : (fb.grade ?? null),
    engagementRate: (useLive && Number.isFinite(live.engagementRate) ? live.engagementRate : fb.engagementRate) ?? null,
    growth30: useLive && Number.isFinite(live.growth30) ? live.growth30 : null,
    daily: useLive && Array.isArray(live.daily) ? live.daily : null,
  };
}

export default async function handler(req, res) {
  const clientId = process.env.SOCIALBLADE_CLIENT_ID;
  const token = process.env.SOCIALBLADE_TOKEN;

  let liveByHandle = {};
  let anyLive = false;
  try {
    if (clientId && token) {
      liveByHandle = await fetchMany(ALL_PAGES.map((p) => p.handle), { clientId, token });
      anyLive = Object.values(liveByHandle).some((r) => r && r.ok);
    }
  } catch {
    liveByHandle = {};
  }

  const pages = {};
  for (const page of ALL_PAGES) {
    pages[page.handle] = merge(page, liveByHandle[page.handle]);
  }

  // Chart series: prefer live daily history, keyed by the site's chart ids.
  const charts = {};
  for (const handle of CHART_HANDLES) {
    const d = pages[handle]?.daily;
    if (Array.isArray(d) && d.length > 1) charts[handle] = d.map((p) => p.followers);
  }

  // Aggregate: total followers under management (managed pages only).
  const managed = Object.values(pages).filter((p) => p.managed);
  const totalFollowers = managed.reduce((sum, p) => sum + (p.followers || 0), 0);

  const body = {
    updatedAt: new Date().toISOString(),
    source: anyLive ? 'socialblade' : 'fallback',
    totals: {
      followersUnderManagement: totalFollowers,
      managedPages: managed.length,
    },
    pages,
    charts,
  };

  // 24h edge cache; serve stale for a day while revalidating in the background.
  res.setHeader('Cache-Control', `public, s-maxage=${DAY}, stale-while-revalidate=${DAY}`);
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.status(200).json(body);
}
