/**
 * Lasting Legacy Cleaners - Funeral Home ZIP Locator API (Vercel Serverless Function)
 *
 * Route:   GET /api/llc-funeral-homes?zip=46062
 * Returns: { ok: true, zip, location: {lat,lng,formatted_address}, results: [...] }
 *
 * This is the static-site replacement for the WordPress "Funeral Home ZIP Locator"
 * plugin (wp-admin/admin-ajax.php?action=fzl_search_zip), which cannot run on Vercel.
 * Same Google APIs, same logic:
 *   1) Google Geocoding API      -> ZIP code to lat/lng (US only)
 *   2) Google Places API (New)   -> Nearby Search, includedTypes: ["funeral_home"]
 *
 * REQUIRED Vercel environment variable:
 *   GOOGLE_MAPS_API_KEY   Server key with "Geocoding API" and "Places API (New)" enabled.
 *                         Do NOT restrict it by HTTP referrer (server calls send no referrer).
 *                         Restrict it by API instead (Geocoding API + Places API (New)).
 * OPTIONAL:
 *   LLC_SEARCH_RADIUS_M   Search radius in meters (default 40000 = ~25 miles, max 50000)
 *   LLC_RESULTS_LIMIT     Max results (default 6, max 20)
 *
 * Note: vercel.json rewrites /api/:path* to the partner-portal backend. Vercel serves real
 * files and functions BEFORE rewrites, and vercel.json also has an explicit pass-through
 * rule for this path, so this function is not affected by that rewrite.
 */

'use strict';

const CACHE = new Map(); // warm-instance cache: zip -> { t, payload }
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

const FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.addressComponents',
  'places.location',
  'places.nationalPhoneNumber',
  'places.internationalPhoneNumber',
  'places.rating',
  'places.userRatingCount',
  'places.googleMapsUri',
  'places.websiteUri',
  'places.regularOpeningHours.openNow',
  'places.businessStatus',
].join(',');

const US_ZIP_MSG =
  'This ZIP code system only works for USA. Please enter a valid 5-digit US ZIP code.';

function send(res, status, body, cacheSeconds) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (cacheSeconds) {
    // Cache successful lookups at Vercel's edge to keep Google API costs low.
    res.setHeader('Cache-Control', `public, s-maxage=${cacheSeconds}, stale-while-revalidate=86400`);
  } else {
    res.setHeader('Cache-Control', 'no-store');
  }
  res.end(JSON.stringify(body));
}

function clampInt(value, def, min, max) {
  const n = parseInt(value, 10);
  if (Number.isNaN(n)) return def;
  return Math.min(max, Math.max(min, n));
}

async function fetchJson(url, options, timeoutMs) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, { ...options, signal: ctrl.signal });
    let data = null;
    try {
      data = await r.json();
    } catch (e) {
      data = null;
    }
    return { status: r.status, data };
  } finally {
    clearTimeout(timer);
  }
}

function geocodeStatusMessage(status) {
  switch (status) {
    case 'ZERO_RESULTS':
      return 'That ZIP code could not be found. Please double-check it and try again.';
    case 'OVER_QUERY_LIMIT':
      return 'The search service is temporarily over its usage limit. Please try again shortly.';
    case 'REQUEST_DENIED':
      return 'The search request was denied. Please check the Google API key configuration.';
    case 'INVALID_REQUEST':
      return 'The search request was invalid.';
    default:
      return 'The geocoding service returned an error. Please try again later.';
  }
}

async function geocodeZip(zip, key) {
  const params = new URLSearchParams({
    address: `${zip}, USA`,
    components: `postal_code:${zip}|country:US`,
    key,
  });
  const { status, data } = await fetchJson(
    `https://maps.googleapis.com/maps/api/geocode/json?${params.toString()}`,
    { method: 'GET' },
    12000
  );
  if (status !== 200 || !data) {
    throw new Error('The geocoding service returned an unexpected response.');
  }
  if (data.status !== 'OK') {
    const err = new Error(geocodeStatusMessage(data.status));
    err.publicStatus = data.status === 'ZERO_RESULTS' ? 404 : 502;
    throw err;
  }
  const result = data.results && data.results[0];
  if (!result || !result.geometry || !result.geometry.location) {
    const err = new Error('That ZIP code could not be located.');
    err.publicStatus = 404;
    throw err;
  }
  return {
    lat: Number(result.geometry.location.lat),
    lng: Number(result.geometry.location.lng),
    formatted_address: result.formatted_address || '',
  };
}

async function searchFuneralHomes(location, radius, limit, key) {
  const body = {
    includedTypes: ['funeral_home'],
    maxResultCount: limit,
    locationRestriction: {
      circle: {
        center: { latitude: location.lat, longitude: location.lng },
        radius: radius,
      },
    },
    rankPreference: 'DISTANCE',
  };
  const { status, data } = await fetchJson(
    'https://places.googleapis.com/v1/places:searchNearby',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': key,
        'X-Goog-FieldMask': FIELD_MASK,
      },
      body: JSON.stringify(body),
    },
    15000
  );

  if (status !== 200) {
    const detail = data && data.error && data.error.message ? ` (${String(data.error.message).slice(0, 200)})` : '';
    throw new Error(
      `The places service returned an error${detail}. Please check the API key and that Places API (New) is enabled.`
    );
  }

  const places = (data && Array.isArray(data.places)) ? data.places : [];
  return places
    .filter((p) => !p.businessStatus || p.businessStatus === 'OPERATIONAL')
    .map((p) => {
      const lat = p.location ? Number(p.location.latitude) : null;
      const lng = p.location ? Number(p.location.longitude) : null;
      let postalCode = '';
      if (Array.isArray(p.addressComponents)) {
        const pc = p.addressComponents.find((c) => Array.isArray(c.types) && c.types.includes('postal_code'));
        if (pc) postalCode = pc.longText || '';
      }
      const mapsUri = p.googleMapsUri
        || (lat && lng ? `https://www.google.com/maps/search/?api=1&query=${lat},${lng}` : '');
      return {
        name: (p.displayName && p.displayName.text) || 'Funeral Home',
        address: p.formattedAddress || '',
        postalCode,
        phone: p.nationalPhoneNumber || p.internationalPhoneNumber || '',
        rating: typeof p.rating === 'number' ? p.rating : null,
        ratingCount: typeof p.userRatingCount === 'number' ? p.userRatingCount : 0,
        openNow: p.regularOpeningHours && typeof p.regularOpeningHours.openNow === 'boolean'
          ? p.regularOpeningHours.openNow
          : null,
        website: p.websiteUri || '',
        mapsUri,
        lat,
        lng,
      };
    });
}

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.setHeader('Allow', 'GET, POST, OPTIONS');
    return res.end();
  }
  if (req.method !== 'GET' && req.method !== 'POST') {
    return send(res, 405, { ok: false, message: 'Method not allowed.' });
  }

  // Accept ?zip= (GET) or {"zip": "..."} / form body (POST).
  let zip = '';
  try {
    const url = new URL(req.url, 'http://localhost');
    zip = url.searchParams.get('zip') || '';
    if (!zip && req.body) {
      if (typeof req.body === 'string') {
        try { zip = JSON.parse(req.body).zip || ''; } catch (e) { zip = new URLSearchParams(req.body).get('zip') || ''; }
      } else if (typeof req.body === 'object') {
        zip = req.body.zip || '';
      }
    }
  } catch (e) {
    zip = '';
  }
  zip = String(zip).trim();

  if (!/^\d{5}$/.test(zip)) {
    return send(res, 400, { ok: false, code: 'invalid_zip', message: US_ZIP_MSG });
  }

  const key = process.env.GOOGLE_MAPS_API_KEY || process.env.FZL_GOOGLE_API_KEY || '';
  if (!key) {
    return send(res, 500, {
      ok: false,
      code: 'no_key',
      message: 'The funeral home search is not configured yet.',
    });
  }

  const radius = clampInt(process.env.LLC_SEARCH_RADIUS_M, 40000, 1000, 50000);
  const limit = clampInt(process.env.LLC_RESULTS_LIMIT, 6, 1, 20);

  const cached = CACHE.get(zip);
  if (cached && Date.now() - cached.t < CACHE_TTL_MS) {
    return send(res, 200, cached.payload, 21600);
  }

  try {
    const location = await geocodeZip(zip, key);
    const results = await searchFuneralHomes(location, radius, limit, key);
    const payload = { ok: true, zip, location, results };
    CACHE.set(zip, { t: Date.now(), payload });
    if (CACHE.size > 500) CACHE.delete(CACHE.keys().next().value);
    return send(res, 200, payload, 21600);
  } catch (err) {
    const aborted = err && err.name === 'AbortError';
    console.error('[llc-funeral-homes]', zip, err && err.message);
    return send(res, (err && err.publicStatus) || 502, {
      ok: false,
      code: aborted ? 'timeout' : 'search_failed',
      message: aborted
        ? 'The search took too long. Please try again.'
        : (err && err.message) || 'Something went wrong while searching.',
    });
  }
};
