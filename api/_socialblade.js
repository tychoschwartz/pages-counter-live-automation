/**
 * Minimal server-side Social Blade "Matrix" Business API client.
 *
 * Credentials come from env vars and are NEVER exposed to the browser:
 *   SOCIALBLADE_CLIENT_ID
 *   SOCIALBLADE_TOKEN
 *
 * Docs: https://socialblade.com/developers/docs
 * Endpoint: https://matrix.sbapis.com/b/instagram/statistics
 *
 * The response schema is parsed defensively — Social Blade has shipped a few
 * shapes over time — and every getter falls back to `undefined` so a missing
 * field never throws.
 */

const BASE = 'https://matrix.sbapis.com/b/instagram/statistics';

/** Pull the first defined value from a list of nested paths. */
function pick(obj, paths) {
  for (const path of paths) {
    let cur = obj;
    let ok = true;
    for (const key of path) {
      if (cur == null || typeof cur !== 'object' || !(key in cur)) { ok = false; break; }
      cur = cur[key];
    }
    if (ok && cur != null) return cur;
  }
  return undefined;
}

function num(v) {
  const n = typeof v === 'string' ? parseFloat(v.replace(/[^0-9.\-]/g, '')) : Number(v);
  return Number.isFinite(n) ? n : undefined;
}

/** Normalise Social Blade's daily history into [{date, followers}] ascending by date. */
function parseDaily(data) {
  const raw = pick(data, [['daily'], ['statistics', 'daily'], ['history', 'daily'], ['data', 'daily']]);
  if (!Array.isArray(raw)) return undefined;
  const points = raw
    .map((d) => ({
      date: d.date || d.day || d.timestamp,
      followers: num(d.followers ?? d.follower_count ?? d.count),
    }))
    .filter((p) => p.date && Number.isFinite(p.followers));
  if (points.length < 2) return undefined;
  points.sort((a, b) => String(a.date).localeCompare(String(b.date)));
  return points;
}

/**
 * Fetch one handle's live statistics.
 * @returns {Promise<{handle:string, ok:boolean, followers?:number, following?:number,
 *   media?:number, avgLikes?:number, engagementRate?:number, grade?:string,
 *   growth30?:number, daily?:{date:string,followers:number}[], error?:string}>}
 */
export async function fetchHandle(handle, { clientId, token, allowStale = true, timeoutMs = 9000 } = {}) {
  if (!clientId || !token) return { handle, ok: false, error: 'missing-credentials' };

  const url = `${BASE}?query=${encodeURIComponent(handle)}&history=default&allow-stale=${allowStale}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: { clientid: clientId, token, accept: 'application/json' },
      signal: ctrl.signal,
    });
    if (!res.ok) return { handle, ok: false, error: `http-${res.status}` };
    const json = await res.json();
    if (json?.status && json.status.success === false) {
      return { handle, ok: false, error: json.status.error || 'api-error' };
    }
    const data = json?.data ?? json;

    const followers = num(pick(data, [
      ['statistics', 'total', 'followers'], ['statistics', 'followers'], ['followers'], ['general', 'followers'],
    ]));

    return {
      handle,
      ok: Number.isFinite(followers),
      followers,
      following: num(pick(data, [['statistics', 'total', 'following'], ['following']])),
      media: num(pick(data, [['statistics', 'total', 'media'], ['media']])),
      avgLikes: num(pick(data, [['statistics', 'average', 'likes'], ['statistics', 'total', 'avg_likes'], ['misc', 'avg_likes']])),
      engagementRate: num(pick(data, [['statistics', 'total', 'engagement_rate'], ['misc', 'engagement_rate'], ['engagement_rate']])),
      grade: pick(data, [['misc', 'grade'], ['statistics', 'total', 'grade'], ['ranks', 'grade'], ['grade']]),
      growth30: num(pick(data, [['statistics', 'growth', 'followers', '30'], ['growth', 'followers', '30']])),
      daily: parseDaily(data),
    };
  } catch (err) {
    return { handle, ok: false, error: err.name === 'AbortError' ? 'timeout' : String(err.message || err) };
  } finally {
    clearTimeout(timer);
  }
}

/** Fetch many handles with a small concurrency cap to be gentle on the API. */
export async function fetchMany(handles, opts = {}, concurrency = 4) {
  const out = {};
  const queue = [...handles];
  async function worker() {
    while (queue.length) {
      const h = queue.shift();
      out[h] = await fetchHandle(h, opts);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, handles.length) }, worker));
  return out;
}
