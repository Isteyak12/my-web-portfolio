(() => {
    const body = document.getElementById('bio-body');
    const btn = document.getElementById('bio-toggle');
    if (!body || !btn) return;

    const label = btn.querySelector('.bio-toggle-label');
    const first = body.querySelector('p');

    // collapsed view: the opening paragraph plus a faded peek at the next line
    const collapsedHeight = () => (first ? first.offsetHeight : 0) + 46;

    if (body.scrollHeight <= collapsedHeight() + 24) return;

    function setCollapsed(collapsed) {
        btn.setAttribute('aria-expanded', String(!collapsed));
        label.textContent = collapsed ? 'Read more' : 'Show less';
        body.classList.toggle('is-collapsed', collapsed);
    }

    body.style.maxHeight = `${collapsedHeight()}px`;
    setCollapsed(true);
    btn.hidden = false;

    btn.addEventListener('click', () => {
        const expanding = body.classList.contains('is-collapsed');
        if (expanding) {
            body.style.maxHeight = `${body.scrollHeight}px`;
            setCollapsed(false);
            body.addEventListener('transitionend', function done(e) {
                if (e.propertyName !== 'max-height') return;
                body.removeEventListener('transitionend', done);
                if (!body.classList.contains('is-collapsed')) body.style.maxHeight = 'none';
            });
        } else {
            body.style.maxHeight = `${body.scrollHeight}px`;
            void body.offsetHeight;
            body.style.maxHeight = `${collapsedHeight()}px`;
            setCollapsed(true);
        }
    });

    window.addEventListener('resize', () => {
        if (body.classList.contains('is-collapsed')) body.style.maxHeight = `${collapsedHeight()}px`;
    });
})();
