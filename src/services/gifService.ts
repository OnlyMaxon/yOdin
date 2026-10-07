// GIF search for the comment composer, backed by GIPHY.
//
// Not Tenor: as of January 2026 Google stopped issuing Tenor API keys to new
// clients, so however well it would have fit, it cannot be obtained for this app.
//
// The key is a client-side key and ships inside the app, as the Firebase and
// Algolia ones already do — a key the client must send cannot be hidden. A free
// GIPHY key allows 100 calls/hour **for the whole app**, not per user, which is
// enough for testing but not for release; a production key is granted on
// request from the GIPHY dashboard.
//
// Set it in .env as:
//   EXPO_PUBLIC_GIPHY_API_KEY=...
// Without it every call returns an empty list instead of throwing, so the app
// keeps working and the picker says exactly what is missing.
const KEY = process.env.EXPO_PUBLIC_GIPHY_API_KEY ?? '';
const BASE = 'https://api.giphy.com/v1/gifs';

// Content rating ceiling. 'g' is the strictest GIPHY offers, and anything looser
// would quietly undercut the app's own rules: the Play content rating declares
// no sexual content and the terms of use forbid it.
const RATING = 'g';

export interface Gif {
  id: string;
  /** The animation stored on the comment and shown in the thread. */
  url: string;
  /** Smaller animation used in the picker grid. */
  preview: string;
  width: number;
  height: number;
}

export function isGifSearchAvailable(): boolean {
  return KEY.length > 0;
}

interface GiphyImage {
  url?: string;
  width?: string;
  height?: string;
}

function toGif(raw: { id?: string; images?: Record<string, GiphyImage> }): Gif | null {
  const full = raw.images?.fixed_height;
  const small = raw.images?.fixed_width_small ?? raw.images?.preview_gif ?? full;
  if (!raw.id || !full?.url || !small?.url) return null;
  return {
    id: raw.id,
    url: full.url,
    preview: small.url,
    width: Number(full.width ?? 0),
    height: Number(full.height ?? 0),
  };
}

async function request(path: string, params: Record<string, string>): Promise<Gif[]> {
  if (!KEY) return [];
  const qs = new URLSearchParams({ api_key: KEY, rating: RATING, ...params });
  try {
    const res = await fetch(`${BASE}/${path}?${qs}`);
    if (!res.ok) return [];
    const json = (await res.json()) as { data?: unknown[] };
    return (json.data ?? [])
      .map((d) => toGif(d as Parameters<typeof toGif>[0]))
      .filter((g): g is Gif => g !== null);
  } catch {
    // Offline, or GIPHY down or out of quota — an empty picker beats a crash.
    return [];
  }
}

/** Trending GIFs, shown before the user types anything. */
export function trendingGifs(limit = 24): Promise<Gif[]> {
  return request('trending', { limit: String(limit) });
}

export function searchGifs(query: string, limit = 24): Promise<Gif[]> {
  const q = query.trim();
  if (!q) return trendingGifs(limit);
  return request('search', { q, limit: String(limit) });
}

/**
 * Only GIPHY's own CDN is accepted when rendering a stored GIF. The security
 * rule enforces the same host server-side; this is the client-side half, so a
 * tampered document cannot make every reader's app fetch an arbitrary URL and
 * hand their IP address to whoever planted it.
 */
export function isGifUrl(url: string | undefined): boolean {
  return !!url && /^https:\/\/media[0-9]*\.giphy\.com\//.test(url);
}
