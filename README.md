# Pagescaling — live faceless-content site

Marketing site for **Pagescaling**, a done-for-you faceless Instagram page
management service. Static, single-page, hand-tuned animations — now wired to
**live Instagram figures pulled from the Social Blade API server-side**.

The follower counts on the logo wall, the case-study numbers, the Social Blade
grades and the growth charts all update automatically from Social Blade. If the
API is unavailable the site falls back to baked-in numbers, so it never renders
blank.

---

## How the live data works

```
Browser ──GET /api/stats──▶ Vercel serverless function
                              │  reads SOCIALBLADE_CLIENT_ID / SOCIALBLADE_TOKEN
                              │  calls matrix.sbapis.com for each handle
                              ▼
                           JSON { pages, charts, totals, updatedAt }
                              │  Cache-Control: s-maxage=86400 (edge-cached 24h)
Browser ◀── live numbers ─────┘  frontend swaps them into the existing animations
```

- **The Social Blade token never reaches the browser.** Only computed numbers are
  sent to the client.
- **Refreshed automatically every day.** A [Vercel Cron](vercel.json) hits
  `/api/cron` once a day (06:00 UTC), which fetches Social Blade and stores a
  fresh snapshot — so the numbers are up to date every day **without depending on
  anyone visiting the site**.
- **Edge-cached for 24 hours** (`s-maxage=86400, stale-while-revalidate`) so bursts
  of traffic don't hit the origin repeatedly.
- **Graceful fallback**: no token, an API error, or an offline viewer all fall
  back to the last-known numbers in [`data/pages.js`](data/pages.js).

### Why the plain `index.html` file shows static numbers

Opening `index.html` on its own (no server) can't show live data — Social Blade's
API requires the secret token in a request header, which is impossible from the
browser (it would leak the token, and CORS blocks it). The live numbers only
appear once the site is **deployed to Vercel with the token set**, because then
the `/api/stats` function exists to fetch them server-side.

### Daily refresh — with or without Vercel KV

| Setup | What happens | Credit usage |
|---|---|---|
| **Vercel KV connected** (recommended) | Daily cron writes a snapshot to KV; every visitor reads that snapshot | ~1 fetch-set / day, regardless of traffic |
| **No KV** | Cron + first daily visitor trigger a live fetch; result is edge-cached 24h | ~1 fetch-set / day + occasional per-region revalidations |

To enable KV: Vercel dashboard → **Storage → Create → KV**, connect it to the
project. It auto-injects `KV_REST_API_URL` / `KV_REST_API_TOKEN`; the code picks
it up automatically (and silently skips it if absent).

### Verify it works after deploying

Open **`/api/debug`** on your deployed site (e.g. `https://your-site/api/debug`).
It reports whether the token is configured and shows how one handle parses —
green means the live counters will work. Add `?handle=opusreality` to check
another page.

### Which numbers are live

| Surface | Live source |
|---|---|
| Logo-wall follower counts (17 pages) | Social Blade `followers` |
| Case-study follower subtitles | Social Blade `followers` |
| Social Blade grades (A−, B+, …) | Social Blade `grade` |
| @multimillionaire_mind engagement rate | Social Blade `engagement_rate` |
| Editor stat (@victorianpoetry followers) | Social Blade `followers` |
| Growth charts (execute, mmm, phil, opus, victorianpoetry) | Social Blade daily history |
| "Last updated" indicator | API `updatedAt` |

> The hero's **"6.4M+ followers under management"** and the editorial headline
> numbers (views, likes generated, reach) are **intentionally left static** —
> they're the operator's own accounting / period-scoped figures, not the raw
> Social Blade follower sum, and are deliberately not auto-recomputed.

---

## Project structure

```
index.html            The site — markup, styles and all animations (unchanged design)
data/pages.js         Single source of truth: every handle + fallback numbers
api/stats.js          Endpoint the frontend fetches (snapshot-first, then live)
api/cron.js           Daily Vercel Cron — refreshes the snapshot automatically
api/debug.js          Post-deploy check that your token works (/api/debug)
api/_core.js          Shared stats builder + optional Vercel KV persistence
api/_socialblade.js   Server-side Social Blade client (defensive parsing)
brand/ logos/ posts/  Image assets, served at the site root
vercel.json           Cron schedule + caching headers
```

To change a page, its fallback number, or add/remove a handle, edit
**`data/pages.js`** — that one file drives both the API and the frontend
fallbacks.

---

## Local development

```bash
npm install -g vercel      # once
vercel dev                 # serves the static site + /api functions locally
```

Create a `.env` from the template and fill in real credentials (never commit it):

```bash
cp .env.example .env
# edit .env → SOCIALBLADE_CLIENT_ID, SOCIALBLADE_TOKEN
```

Without credentials the site still runs — `/api/stats` returns the fallback
numbers with `"source":"fallback"`.

---

## Deploying to Vercel

1. Import this repo in Vercel (no framework preset needed — it's a static site
   with serverless functions).
2. Add the environment variables under **Settings → Environment Variables**:
   - `SOCIALBLADE_CLIENT_ID`
   - `SOCIALBLADE_TOKEN`
3. Deploy. `/api/stats` is picked up automatically; the static files are served
   from the root.

---

## Notes

- Animations, layout and copy tone are preserved from the original design.
- `prefers-reduced-motion` is respected throughout.
- Fonts load non-blocking; images are far-future cached via `vercel.json`.
