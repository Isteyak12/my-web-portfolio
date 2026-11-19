(() => {
    // after `npx wrangler deploy` in geo-api/, paste the printed workers.dev URL here
    const GEO_API = /^(localhost|127\.0\.0\.1)$/.test(location.hostname)
        ? 'http://127.0.0.1:8789'
        : 'https://portfolio-geo.isteyakislam12.workers.dev';
    const root = document.documentElement;
    const reveal = () => root.classList.remove('geo-pending');
    const titles = document.querySelectorAll('[data-gta-title]');
    if (!titles.length || GEO_API.includes('REPLACE_WITH')) {
        reveal();
        return;
    }

    // never keep the tagline hidden for long if the check is slow or fails
    const fallback = setTimeout(reveal, 1500);
    const ctrl = 'AbortController' in window ? new AbortController() : null;
    if (ctrl) setTimeout(() => ctrl.abort(), 1500);

    const params = new URLSearchParams(location.search);
    const test = params.get('gta');
    const query = test === '1' || test === '0' ? `?gta=${test}` : '';

    fetch(`${GEO_API}/geo${query}`, ctrl ? { signal: ctrl.signal } : undefined)
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
            if (data && data.gta) {
                titles.forEach((el) => {
                    el.textContent = el.dataset.gtaTitle;
                });
            }
        })
        .catch(() => {})
        .finally(() => {
            clearTimeout(fallback);
            reveal();
        });
})();
