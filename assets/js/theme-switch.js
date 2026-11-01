(() => {
    const root = document.documentElement;
    const btn = document.getElementById('theme-switch');
    const wave = document.getElementById('od-wave');
    if (!btn) return;

    const KEY = 'portfolio-theme';
    const THEME = 'overdrive';
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

    function hexToRgb(hex) {
        const n = parseInt(hex.slice(1), 16);
        return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
    }

    // recolour the live particles.js instance in place instead of rebuilding it
    function setParticleColor(hex) {
        const pjs = window.pJSDom && window.pJSDom[0] && window.pJSDom[0].pJS;
        if (!pjs) return;
        const rgb = hexToRgb(hex);
        pjs.particles.color.value = hex;
        pjs.particles.line_linked.color = hex;
        pjs.particles.line_linked.color_rgb_line = rgb;
        pjs.particles.array.forEach((p) => {
            p.color = { value: hex, rgb };
        });
    }

    function playWave(on) {
        if (!wave || reduceMotion.matches) return;
        const r = btn.getBoundingClientRect();
        wave.style.setProperty('--x', `${r.left + r.width / 2}px`);
        wave.style.setProperty('--y', `${r.top + r.height / 2}px`);
        wave.classList.toggle('off', !on);
        wave.classList.remove('go');
        void wave.offsetWidth;
        wave.classList.add('go');
    }

    function apply(on, animate) {
        if (on) root.setAttribute('data-theme', THEME);
        else root.removeAttribute('data-theme');
        btn.setAttribute('aria-pressed', String(on));
        btn.setAttribute('aria-label', on ? 'Switch back to the blue theme' : 'Switch to Overdrive orange theme');
        btn.querySelector('.theme-switch-tip').textContent = on ? 'OVERDRIVE: ON' : 'OVERDRIVE';
        setParticleColor(on ? '#ff8a2a' : '#ffffff');
        if (animate) playWave(on);
    }

    btn.addEventListener('click', () => {
        const on = root.getAttribute('data-theme') !== THEME;
        apply(on, true);
        try { localStorage.setItem(KEY, on ? THEME : 'default'); } catch (_) { /* storage unavailable */ }
    });

    apply(root.getAttribute('data-theme') === THEME, false);
})();
