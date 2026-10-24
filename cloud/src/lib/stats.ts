// The site's visit counts (owner request, 2026-10-22). Umami runs on the site's own server and its
// script and collector sit under the site's own /stats/ path, so no request leaves the site (CLD-08).
// Nothing is counted unless UMAMI_WEBSITE_ID is set.

/** Where Caddy serves Umami's script and collector on the site's own domain. */
export const STATS_PATH = "/stats";

/** The Umami website the pages report to, or `null` when the site counts nothing. */
export function statsWebsite(env: Readonly<Record<string, string | undefined>> = process.env): string | null {
  const id = env["UMAMI_WEBSITE_ID"]?.trim() ?? "";
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) ? id : null;
}

/**
 * Umami's `data-before-send` hook. A share link's token is a secret, so `/s/<token>` is counted as
 * `/s/link`, in the page and in the referrer alike.
 */
export const STATS_HOOK = `window.aisusStats=function(type,payload){var hide=function(url){return typeof url==="string"?url.replace(/\\/s\\/[^/?#]+/,"/s/link"):url};payload.url=hide(payload.url);payload.referrer=hide(payload.referrer);return payload};`;
