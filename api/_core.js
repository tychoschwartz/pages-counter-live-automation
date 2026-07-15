/**
 * Shared stats logic used by /api/stats (reads) and /api/cron (daily refresh).
 *
 * Persistence is optional: if a Vercel KV / Upstash store is connected
 * (env KV_REST_API_URL + KV_REST_API_TOKEN present) the daily cron writes a
 * snapshot there and visitors read it — so the page is always fresh and
 * visitor traffic never burns Social Blade credits. Without KV everything
 * still works via live fetch + CDN caching.
 */

import { ALL_PAGES, CHART_HANDLES } from '../data/pages.js';
import { fetchMany } from './_socialblade.js';

export const SNAPSHOT_KEY = 'pagescaling:stats:latest';

/** Merge a live Social Blade result over a page's baked-in fallback. */
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

/** Fetch every handle live from Social Blade and build the site payload. */
export async function computeStats() {
  const clientId = process.env.SOCIALBLADE_CLIENT_ID;
  const token = process.env.SOCIALBLADE_TOKEN;

  let liveByHandle = {};
  let anyLive = false;
  if (clientId && token) {
    try {
      liveByHandle = await fetchMany(ALL_PAGES.map((p) => p.handle), { clientId, token });
      anyLive = Object.values(liveByHandle).some((r) => r && r.ok);
    } catch {
      liveByHandle = {};
    }
  }

  const pages = {};
  for (const page of ALL_PAGES) pages[page.handle] = merge(page, liveByHandle[page.handle]);

  const charts = {};
  for (const handle of CHART_HANDLES) {
    const d = pages[handle]?.daily;
    if (Array.isArray(d) && d.length > 1) charts[handle] = d.map((p) => p.followers);
  }

  const managed = Object.values(pages).filter((p) => p.managed);
  const totalFollowers = managed.reduce((sum, p) => sum + (p.followers || 0), 0);

  return {
    updatedAt: new Date().toISOString(),
    source: anyLive ? 'socialblade' : 'fallback',
    totals: { followersUnderManagement: totalFollowers, managedPages: managed.length },
    pages,
    charts,
  };
}

/* ---------- optional Vercel KV persistence (safe no-ops without KV) ---------- */

function kvConfigured() {
  return !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}

async function getKv() {
  if (!kvConfigured()) return null;
  try {
    const mod = await import('@vercel/kv');
    return mod.kv || (mod.createClient && mod.createClient()) || null;
  } catch {
    return null; // @vercel/kv not installed — fall back to live fetch
  }
}

export async function readSnapshot() {
  const kv = await getKv();
  if (!kv) return null;
  try { return await kv.get(SNAPSHOT_KEY); } catch { return null; }
}

export async function writeSnapshot(snapshot) {
  const kv = await getKv();
  if (!kv) return false;
  try { await kv.set(SNAPSHOT_KEY, snapshot); return true; } catch { return false; }
}

/** True when a snapshot is younger than `maxAgeMs` (default 25h). */
export function isFresh(snapshot, maxAgeMs = 25 * 60 * 60 * 1000) {
  if (!snapshot?.updatedAt) return false;
  const t = Date.parse(snapshot.updatedAt);
  return Number.isFinite(t) && Date.now() - t < maxAgeMs;
}
