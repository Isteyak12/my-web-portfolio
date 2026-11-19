// Cloudflare Worker: tells the portfolio whether a visitor is in the Greater Toronto Area.
// Cloudflare attaches an approximate location to every request (request.cf); only a
// yes/no answer is returned, and nothing is stored.

const ALLOWED_ORIGINS = new Set([
    'https://isteyak.com',
    'https://www.isteyak.com',
    'http://localhost:8000',
    'http://127.0.0.1:8000',
]);

// ---------- GTA check ----------
// The Greater Toronto Area spans many municipalities, so match on distance from
// downtown Toronto (within Ontario) instead of a list of city names.
const TORONTO = { lat: 43.6532, lon: -79.3832 };
const GTA_RADIUS_KM = 55;

function inGta(cf) {
    if (!cf || cf.country !== 'CA' || cf.regionCode !== 'ON') return false;
    const lat = Number(cf.latitude);
    const lon = Number(cf.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return false;
    const rad = Math.PI / 180;
    const dLat = (lat - TORONTO.lat) * rad;
    const dLon = (lon - TORONTO.lon) * rad;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(TORONTO.lat * rad) * Math.cos(lat * rad) * Math.sin(dLon / 2) ** 2;
    return 6371 * 2 * Math.asin(Math.sqrt(a)) <= GTA_RADIUS_KM;
}

export default {
    async fetch(request, env) {
        const origin = request.headers.get('Origin') || '';
        const headers = {
            'Access-Control-Allow-Origin': ALLOWED_ORIGINS.has(origin) ? origin : 'null',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Vary': 'Origin',
            'Content-Type': 'application/json',
            // the answer depends on the visitor, so it must never be cached and shared
            'Cache-Control': 'private, no-store',
        };
        if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });

        const url = new URL(request.url);
        if (request.method !== 'GET' || url.pathname !== '/geo') {
            return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers });
        }
        // ?gta=1 / ?gta=0 lets you preview both titles, but only when running locally
        const forced = env.DEV_MODE === '1' && url.searchParams.get('gta');
        const gta = forced ? forced === '1' : inGta(request.cf);
        return new Response(JSON.stringify({ gta }), { status: 200, headers });
    },
};
