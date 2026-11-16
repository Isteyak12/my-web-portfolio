(() => {
    const form = document.getElementById('contact-form');
    if (!form) return;

    const status = document.getElementById('contact-status');
    const button = form.querySelector('.contact-send');
    // reuse the address already shown in the page header so it lives in one place
    const headerMail = document.querySelector('.contact-info a[href^="mailto:"]');
    const address = headerMail ? headerMail.getAttribute('href').replace(/^mailto:/, '') : '';

    const emailLink = document.getElementById('contact-email-link');
    if (emailLink && address) emailLink.href = `mailto:${address}`;

    function say(text, kind) {
        status.textContent = text;
        status.dataset.kind = kind || '';
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const data = new FormData(form);
        if (data.get('_gotcha')) return;

        const name = String(data.get('name') || '').trim();
        const email = String(data.get('email') || '').trim();
        const message = String(data.get('message') || '').trim();
        if (!name || !message || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            say('Please fill in your name, a valid email and a message.', 'error');
            return;
        }

        const endpoint = form.dataset.endpoint;
        if (!endpoint) {
            // no form service connected yet: hand the message to the visitor's email app
            const subject = encodeURIComponent(`Portfolio message from ${name}`);
            const body = encodeURIComponent(`${message}\n\n— ${name} (${email})`);
            window.location.href = `mailto:${address}?subject=${subject}&body=${body}`;
            say('Opening your email app with the message filled in…', 'ok');
            return;
        }

        button.disabled = true;
        say('Sending…', '');
        try {
            const res = await fetch(endpoint, {
                method: 'POST',
                headers: { Accept: 'application/json' },
                body: data,
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            form.reset();
            say("Thanks! Your message is on its way. I'll reply soon.", 'ok');
        } catch (_) {
            say('Something went wrong sending that. Please try the Email me link instead.', 'error');
        } finally {
            button.disabled = false;
        }
    });
})();
