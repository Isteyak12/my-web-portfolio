(() => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    document.querySelectorAll('a.bio-badge[href^="#"]').forEach((link) => {
        link.addEventListener('click', (e) => {
            const target = document.getElementById(link.getAttribute('href').slice(1));
            if (!target) return;
            e.preventDefault();
            target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
            target.classList.remove('jump-flash');
            void target.offsetWidth;
            target.classList.add('jump-flash');
            target.addEventListener('animationend', () => target.classList.remove('jump-flash'), { once: true });
        });
    });
})();
