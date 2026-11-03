(() => {
    const cue = document.getElementById('scroll-cue');
    const scroller = document.querySelector('.content');
    if (!cue || !scroller) return;

    const target = document.getElementById('intro');
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function update() {
        const canScroll = scroller.scrollHeight > scroller.clientHeight + 40;
        const hidden = !canScroll || scroller.scrollTop > 60;
        cue.classList.toggle('is-hidden', hidden);
        cue.tabIndex = hidden ? -1 : 0;
    }

    scroller.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    update();

    cue.addEventListener('click', () => {
        const behavior = reduceMotion ? 'auto' : 'smooth';
        if (target) target.scrollIntoView({ behavior, block: 'start' });
        else scroller.scrollBy({ top: scroller.clientHeight * 0.8, behavior });
    });
})();
