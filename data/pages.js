/**
 * Single source of truth for every Instagram page shown on the site.
 *
 * `handle`    – the Instagram / Social Blade username (no @).
 * `managed`   – true when Pagescaling runs the page end-to-end.
 * `own`       – true for our own in-house page.
 * `fallback`  – the last-known numbers, used when the live API is
 *               unavailable so the site never renders blank.
 *
 * The API (/api/stats) fetches live figures for every handle here and the
 * frontend swaps them in; if a fetch fails, the fallback below is kept.
 */

/** @typedef {{ handle:string, managed?:boolean, own?:boolean, editor?:boolean, fallback:{ followers:number, avgLikes?:number, media?:number, grade?:string, engagementRate?:number } }} Page */

/** Pages shown in the portfolio logo wall (ordered by size, biggest first). @type {Page[]} */
export const PORTFOLIO = [
  { handle: 'mindsetraptors',        managed: true, fallback: { followers: 1400000 } },
  { handle: 'opusreality',           managed: true, fallback: { followers: 990000 } },
  { handle: 'forthinkingminds',      managed: true, fallback: { followers: 846000 } },
  { handle: 'businessedgex',         managed: true, fallback: { followers: 670000 } },
  { handle: 'hustlingmillionaires',  managed: true, fallback: { followers: 661000 } },
  { handle: 'bymotivify',            managed: true, fallback: { followers: 657000 } },
  { handle: 'thephilosophart',       managed: true, fallback: { followers: 640000, avgLikes: 50807, grade: 'B+' } },
  { handle: 'causewerefemales',      managed: true, fallback: { followers: 563000 } },
  { handle: 'capitalfortunes',       managed: true, fallback: { followers: 506000 } },
  { handle: 'inspi',                 managed: true, fallback: { followers: 498000 } },
  { handle: 'adhdreacts',            managed: true, fallback: { followers: 483000 } },
  { handle: 'aroundvalue',           managed: true, fallback: { followers: 464000 } },
  { handle: 'execute',               managed: true, fallback: { followers: 411000, grade: 'A-' } },
  { handle: 'moneyciety',            managed: true, fallback: { followers: 389000 } },
  { handle: 'multimillionaire_mind', managed: true, own: true, fallback: { followers: 386000, grade: 'A-', engagementRate: 2.51 } },
  { handle: 'wordsyoulovee',         managed: true, fallback: { followers: 357000 } },
  { handle: 'createimprovement',     managed: true, fallback: { followers: 295000 } },
];

/** Editor track-record pages (shown separately, not part of a managed plan). @type {Page[]} */
export const EDITOR = [
  { handle: 'victorianpoetry', editor: true, fallback: { followers: 1391985, avgLikes: 9183, grade: 'A' } },
  { handle: 'vawtez',          editor: true, fallback: { followers: 716000 } },
];

/** Every handle the API should fetch live. */
export const ALL_PAGES = [...PORTFOLIO, ...EDITOR];

/** Handles whose historical follower curve powers a chart on the site. */
export const CHART_HANDLES = ['execute', 'multimillionaire_mind', 'thephilosophart', 'opusreality', 'victorianpoetry'];
