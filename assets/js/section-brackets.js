(() => {
    const scroller = document.querySelector('.content');
    const sections = document.querySelectorAll('.content section');
    if (!scroller || !sections.length || !('IntersectionObserver' in window)) return;

    // re-draw the brackets every time a section scrolls back into view
    const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => entry.target.classList.toggle('in-view', entry.isIntersecting));
    }, { root: scroller, threshold: 0.12 });

    sections.forEach((section) => observer.observe(section));
    document.documentElement.classList.add('brackets-ready');
})();
