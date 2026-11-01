(() => {
    const arcade = document.getElementById('arcade');
    const canvas = document.getElementById('arcade-canvas');
    const bubble = document.getElementById('bubble');
    const closeBtn = document.getElementById('arcade-close');
    const soundBtn = document.getElementById('arcade-sound');
    if (!arcade || !canvas) return;

    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;
    const ROUND_SECONDS = 30;
    const RISE = 0.12;
    const BEST_KEY = 'bonk-a-hamster-best';
    const SFX_KEY = 'bonk-a-hamster-sfx';
    const FONT = '8px "Press Start 2P", monospace';
    const isTouch = window.matchMedia('(hover: none)').matches;

    const store = {
        get(key) { try { return localStorage.getItem(key); } catch (_) { return null; } },
        set(key, value) { try { localStorage.setItem(key, value); } catch (_) { /* storage unavailable */ } },
    };

    // ---------- pixel sprites (drawn from text grids) ----------
    function sprite(rows, pal) {
        const c = document.createElement('canvas');
        c.width = rows[0].length;
        c.height = rows.length;
        const g = c.getContext('2d');
        rows.forEach((row, y) => {
            [...row].forEach((ch, x) => {
                if (pal[ch]) {
                    g.fillStyle = pal[ch];
                    g.fillRect(x, y, 1, 1);
                }
            });
        });
        return c;
    }

    const HAMSTER_ROWS = [
        '...oo......oo...',
        '..oppo....oppo..',
        '..opfoooooofpo..',
        '.offffffffffffo.',
        '.offffffffffffo.',
        'offkwffffffkwffo',
        'offkkffffffkkffo',
        'ofcffllllllffcfo',
        'offflllpplllfffo',
        'offlllloollllffo',
        '.ofllllllllllfo.',
        '.offllllllllffo.',
        '..offffffffffo..',
        '.offllffffllffo.',
        'offllllffllllffo',
        'offffffffffffffo',
    ];
    const HAMSTER_BONK_ROWS = HAMSTER_ROWS.map((row, i) => {
        if (i === 5) return 'offffffffffffffo';
        if (i === 9) return 'offllllkkllllffo';
        return row;
    });
    const ROBOT_ROWS = [
        '.......rr.......',
        '.......oo.......',
        '..oooooooooooo..',
        '.oggggggggggggo.',
        '.ogvvvvvvvvvvgo.',
        '.ogvwvvvvvvwvgo.',
        '.ogvvvvvvvvvvgo.',
        '.oggggggggggggo.',
        '.oggddggggddggo.',
        '.oggggddddggggo.',
        '.oggggggggggggo.',
        '..oooooooooooo..',
        '...oddddddddo...',
        '..oddggggggddo..',
        '.oddgggggggggddo',
        'oddggggggggggddo',
    ];
    const MALLET_ROWS = [
        '..oooooooo..',
        '.orwrrrrrro.',
        '.orrrrrrrro.',
        '.oddddddddo.',
        '..oooooooo..',
        '....obbo....',
        '....obbo....',
        '....obbo....',
        '....obbo....',
        '....obbo....',
        '....obbo....',
        '....oooo....',
    ];

    const PAL = { o: '#3b1f12', f: '#e8a25a', l: '#f7dcb4', p: '#ff8fa3', k: '#140c08', w: '#ffffff', c: '#ff9e8a' };
    const GOLD = { ...PAL, o: '#6b3f00', f: '#ffcc33', l: '#fff1a8', c: '#ffb347' };
    const ROBOT_PAL = { o: '#1b1530', g: '#9fb0c8', d: '#6f8199', v: '#48e2ff', r: '#ff3355', w: '#ffffff' };
    const ROBOT_HIT = { ...ROBOT_PAL, v: '#ff3355', g: '#c7cfdc' };
    const MALLET_PAL = { o: '#1a1030', r: '#ff5f7a', w: '#ffd0d8', d: '#c43a52', b: '#c98b4e' };

    const SPR = {
        hamster: sprite(HAMSTER_ROWS, PAL),
        hamsterHit: sprite(HAMSTER_BONK_ROWS, PAL),
        gold: sprite(HAMSTER_ROWS, GOLD),
        goldHit: sprite(HAMSTER_BONK_ROWS, GOLD),
        robot: sprite(ROBOT_ROWS, ROBOT_PAL),
        robotHit: sprite(ROBOT_ROWS, ROBOT_HIT),
        mallet: sprite(MALLET_ROWS, MALLET_PAL),
    };
    const KINDS = {
        hamster: { points: 1, up: SPR.hamster, hit: SPR.hamsterHit },
        gold: { points: 3, up: SPR.gold, hit: SPR.goldHit },
        robot: { points: -2, up: SPR.robot, hit: SPR.robotHit },
    };

    // ---------- board ----------
    const COLS = [40, 96, 152];
    const ROWS = [58, 92, 126];
    const HOLE_RX = 20;
    const HOLE_RY = 5;
    const holes = [];
    ROWS.forEach((cy) => COLS.forEach((cx) => holes.push({ cx, cy, kind: null, phase: 'idle', t: 0, upTime: 0 })));

    function ellipse(g, cx, cy, rx, ry, color, lowerHalfOnly = false) {
        g.fillStyle = color;
        for (let dy = lowerHalfOnly ? 0 : -ry; dy <= ry; dy++) {
            const hw = Math.round(rx * Math.sqrt(1 - (dy * dy) / (ry * ry)));
            g.fillRect(cx - hw, cy + dy, hw * 2, 1);
        }
    }

    function pixelLine(g, x0, y0, x1, y1) {
        const dx = x1 - x0;
        const dy = y1 - y0;
        const n = Math.max(Math.abs(dx), Math.abs(dy));
        for (let i = 0; i <= n; i++) {
            g.fillRect(Math.round(x0 + (dx * i) / n), Math.round(y0 + (dy * i) / n), 1, 1);
        }
    }

    const bg = document.createElement('canvas');
    bg.width = W;
    bg.height = H;
    (() => {
        const b = bg.getContext('2d');
        const grad = b.createLinearGradient(0, 0, 0, H);
        grad.addColorStop(0, '#1d0b3a');
        grad.addColorStop(1, '#0a0517');
        b.fillStyle = grad;
        b.fillRect(0, 0, W, H);
        b.fillStyle = 'rgba(255, 95, 180, 0.22)';
        for (let x = -168; x <= W + 168; x += 24) pixelLine(b, W / 2, 16, x, H);
        for (let k = 1; k < 12; k++) b.fillRect(0, Math.round(16 + (H - 16) * (k / 11) ** 2), W, 1);
        b.fillStyle = '#0a0517';
        b.fillRect(0, 0, W, 16);
        b.fillStyle = '#ff5fb4';
        b.fillRect(0, 15, W, 1);
        for (let x = 3; x < W; x += 8) {
            b.fillStyle = (x / 8) % 2 < 1 ? '#ffd27a' : '#48e2ff';
            b.fillRect(x, 13, 2, 1);
        }
        holes.forEach((h) => {
            ellipse(b, h.cx, h.cy, HOLE_RX + 2, HOLE_RY + 2, '#2b1450');
            ellipse(b, h.cx, h.cy, HOLE_RX, HOLE_RY, '#48e2ff');
            ellipse(b, h.cx, h.cy, HOLE_RX - 2, HOLE_RY - 1, '#05020a');
        });
    })();

    // ---------- sound (tiny synthesized blips) ----------
    let actx = null;
    let sfxOn = store.get(SFX_KEY) !== 'off';

    function ensureAudio() {
        if (!sfxOn) return;
        try {
            actx = actx || new (window.AudioContext || window.webkitAudioContext)();
            if (actx.state === 'suspended') actx.resume();
        } catch (_) {
            actx = null;
        }
    }

    function tone(freq, dur, { type = 'square', vol = 0.05, to = null, delay = 0 } = {}) {
        if (!sfxOn || !actx) return;
        const t0 = actx.currentTime + delay;
        const osc = actx.createOscillator();
        const gain = actx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, t0);
        if (to) osc.frequency.exponentialRampToValueAtTime(to, t0 + dur);
        gain.gain.setValueAtTime(vol, t0);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        osc.connect(gain).connect(actx.destination);
        osc.start(t0);
        osc.stop(t0 + dur + 0.02);
    }

    function sfx(name) {
        switch (name) {
            case 'bonk': tone(520, 0.09, { to: 160, vol: 0.06 }); break;
            case 'gold': [660, 880, 1320].forEach((f, i) => tone(f, 0.08, { delay: i * 0.06 })); break;
            case 'robot': tone(150, 0.28, { type: 'sawtooth', to: 60, vol: 0.06 }); break;
            case 'whiff': tone(320, 0.05, { type: 'triangle', to: 240, vol: 0.03 }); break;
            case 'tick': tone(1100, 0.04, { vol: 0.03 }); break;
            case 'start': [440, 660, 880].forEach((f, i) => tone(f, 0.07, { delay: i * 0.07, vol: 0.04 })); break;
            case 'end': [880, 660, 440, 330].forEach((f, i) => tone(f, 0.12, { delay: i * 0.1, vol: 0.04 })); break;
            default: break;
        }
    }

    function renderSoundBtn() {
        soundBtn.textContent = sfxOn ? 'SFX ON' : 'SFX OFF';
        soundBtn.setAttribute('aria-pressed', String(sfxOn));
    }
    soundBtn.addEventListener('click', () => {
        sfxOn = !sfxOn;
        store.set(SFX_KEY, sfxOn ? 'on' : 'off');
        renderSoundBtn();
        ensureAudio();
        canvas.focus();
    });
    renderSoundBtn();

    // ---------- game state ----------
    let state = 'title';
    let score = 0;
    let best = Number(store.get(BEST_KEY)) || 0;
    let combo = 0;
    let elapsed = 0;
    let timeLeft = ROUND_SECONDS;
    let spawnTimer = 0;
    let lastTick = 0;
    let shake = 0;
    let flash = 0;
    let newBest = false;
    let titleT = 0;
    let overT = 0;
    const fx = [];
    const pointer = { x: W / 2, y: H / 2, visible: false, swing: 0, touchTimer: 0 };

    const smooth = (t) => t * t * (3 - 2 * t);

    function popOf(h) {
        if (h.phase === 'rise') return smooth(Math.min(1, h.t / RISE));
        if (h.phase === 'sink') return smooth(Math.max(0, 1 - h.t / RISE));
        return h.phase === 'idle' ? 0 : 1;
    }

    function resetBoard() {
        holes.forEach((h) => {
            h.phase = 'idle';
            h.kind = null;
            h.t = 0;
        });
        fx.length = 0;
    }

    function startRound() {
        resetBoard();
        state = 'play';
        score = 0;
        combo = 0;
        elapsed = 0;
        timeLeft = ROUND_SECONDS;
        spawnTimer = 0.4;
        lastTick = 0;
        newBest = false;
        sfx('start');
    }

    function endRound() {
        state = 'over';
        overT = 0;
        combo = 0;
        newBest = score > best;
        if (newBest) {
            best = score;
            store.set(BEST_KEY, String(best));
        }
        sfx('end');
    }

    function spawn(progress) {
        const idle = holes.filter((h) => h.phase === 'idle');
        const active = holes.length - idle.length;
        if (!idle.length || active >= 2 + Math.floor(progress * 2)) return;
        const h = idle[Math.floor(Math.random() * idle.length)];
        const r = Math.random();
        if (r < 0.08) h.kind = 'gold';
        else if (elapsed > 3 && r < 0.24) h.kind = 'robot';
        else h.kind = 'hamster';
        h.phase = 'rise';
        h.t = 0;
        h.upTime = (1.25 - 0.6 * progress) * (h.kind === 'gold' ? 0.7 : 1);
    }

    function burst(x, y, color) {
        for (let i = 0; i < 8; i++) {
            const a = (i / 8) * Math.PI * 2;
            const v = 40 + Math.random() * 25;
            fx.push({ type: 'star', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 20, life: 0.4, color });
        }
    }

    function bonk(h) {
        let pts = KINDS[h.kind].points;
        if (pts > 0) {
            combo += 1;
            if (combo >= 5) pts *= 2;
        } else {
            combo = 0;
            shake = 0.25;
            flash = 0.18;
        }
        score = Math.max(0, score + pts);
        sfx(h.kind === 'robot' ? 'robot' : h.kind === 'gold' ? 'gold' : 'bonk');
        burst(h.cx, h.cy - 16, h.kind === 'robot' ? '#ff3355' : '#ffd27a');
        fx.push({
            type: 'text',
            x: h.cx,
            y: h.cy - 34,
            vx: 0,
            vy: -22,
            life: 0.8,
            text: (pts > 0 ? '+' : '') + pts,
            color: pts < 0 ? '#ff3355' : h.kind === 'gold' ? '#ffd27a' : '#ffffff',
        });
        h.phase = 'hit';
        h.t = 0;
    }

    function bonkAt(x, y) {
        pointer.swing = 0.12;
        if (state === 'title') {
            startRound();
            return;
        }
        if (state === 'over') {
            if (overT > 0.6) startRound();
            return;
        }
        const h = holes.find((c) => (c.phase === 'up' || c.phase === 'rise') && popOf(c) > 0.35
            && Math.abs(x - c.cx) <= 19 && y >= c.cy - 30 && y <= c.cy + 7);
        if (h) bonk(h);
        else {
            combo = 0;
            sfx('whiff');
        }
    }

    function update(dt) {
        if (state === 'play') {
            elapsed += dt;
            timeLeft = Math.max(0, ROUND_SECONDS - elapsed);
            const progress = Math.min(1, elapsed / ROUND_SECONDS);
            spawnTimer -= dt;
            if (spawnTimer <= 0) {
                spawn(progress);
                spawnTimer = 0.85 - 0.45 * progress + Math.random() * 0.25;
            }
            const sec = Math.ceil(timeLeft);
            if (sec <= 5 && sec > 0 && sec !== lastTick) {
                lastTick = sec;
                sfx('tick');
            }
            if (timeLeft <= 0) endRound();
        }

        holes.forEach((h) => {
            if (h.phase === 'idle') return;
            h.t += dt;
            if (h.phase === 'rise' && h.t >= RISE) {
                h.phase = 'up';
                h.t = 0;
            } else if (h.phase === 'up' && h.t >= h.upTime) {
                h.phase = 'sink';
                h.t = 0;
                if (h.kind !== 'robot' && state === 'play') combo = 0;
            } else if (h.phase === 'hit' && h.t >= 0.32) {
                h.phase = 'sink';
                h.t = 0;
            } else if (h.phase === 'sink' && h.t >= RISE) {
                h.phase = 'idle';
                h.kind = null;
            }
        });

        for (let i = fx.length - 1; i >= 0; i--) {
            const p = fx[i];
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            if (p.type === 'star') p.vy += 120 * dt;
            p.life -= dt;
            if (p.life <= 0) fx.splice(i, 1);
        }
        shake = Math.max(0, shake - dt);
        flash = Math.max(0, flash - dt);
        pointer.swing = Math.max(0, pointer.swing - dt);
        pointer.touchTimer = Math.max(0, pointer.touchTimer - dt);
    }

    // ---------- drawing ----------
    function text(str, x, y, color, align = 'center') {
        ctx.font = FONT;
        ctx.textBaseline = 'top';
        ctx.textAlign = align;
        ctx.fillStyle = '#05020a';
        ctx.fillText(str, x + 1, y + 1);
        ctx.fillStyle = color;
        ctx.fillText(str, x, y);
    }

    function drawHole(h, t) {
        if (h.phase !== 'idle') {
            const kind = KINDS[h.kind];
            const img = h.phase === 'hit' ? kind.hit : kind.up;
            const hh = h.phase === 'hit' ? 26 : 32;
            const bottom = h.cy + 6 + Math.round((1 - popOf(h)) * 34);
            ctx.save();
            ctx.beginPath();
            ctx.rect(h.cx - 22, 0, 44, h.cy + 1);
            ctx.clip();
            ctx.drawImage(img, h.cx - 16, bottom - hh, 32, hh);
            if (h.phase === 'hit') {
                for (let i = 0; i < 3; i++) {
                    const a = t * 9 + i * 2.1;
                    ctx.fillStyle = '#ffd27a';
                    ctx.fillRect(Math.round(h.cx + Math.cos(a) * 10), Math.round(bottom - hh - 4 + Math.sin(a) * 2), 2, 2);
                }
            }
            ctx.restore();
        }
        ellipse(ctx, h.cx, h.cy, HOLE_RX, HOLE_RY, '#48e2ff', true);
        ellipse(ctx, h.cx, h.cy, HOLE_RX - 2, HOLE_RY - 1, '#05020a', true);
    }

    function drawHud() {
        text(`SCORE ${String(score).padStart(3, '0')}`, 4, 4, '#ffd27a', 'left');
        const urgent = state === 'play' && timeLeft <= 5 && Math.floor(elapsed * 4) % 2 === 0;
        text(`TIME ${String(Math.ceil(timeLeft)).padStart(2, '0')}`, W - 4, 4, urgent ? '#ff3355' : '#48e2ff', 'right');
        if (state === 'play' && combo >= 5) text('x2', W / 2, 4, '#ff5fb4');
    }

    function dim() {
        ctx.fillStyle = 'rgba(10, 5, 23, 0.8)';
        ctx.fillRect(0, 16, W, H - 16);
    }

    function drawTitle() {
        dim();
        text('BONK-A-HAMSTER', W / 2, 24, '#ffd27a');
        const bounce = Math.round(Math.abs(Math.sin(titleT * 4)) * 6);
        ctx.drawImage(SPR.hamster, W / 2 - 24, 40 - bounce, 48, 48);
        if (Math.floor(titleT * 2) % 2 === 0) text(isTouch ? 'TAP TO START' : 'CLICK TO START', W / 2, 94, '#ffffff');
        const legend = [[SPR.hamster, '+1', '#ffffff'], [SPR.gold, '+3', '#ffd27a'], [SPR.robot, '-2', '#ff3355']];
        legend.forEach(([img, label, color], i) => {
            const gx = 22 + i * 58;
            ctx.drawImage(img, gx, 108, 16, 16);
            text(label, gx + 20, 112, color, 'left');
        });
        text(`BEST ${best}`, W / 2, 132, '#c9b8ff');
    }

    function drawOver() {
        dim();
        text('TIME UP!', W / 2, 30, '#ff5fb4');
        text(`SCORE ${score}`, W / 2, 54, '#ffd27a');
        if (newBest) {
            if (Math.floor(overT * 3) % 2 === 0) text('NEW BEST!', W / 2, 72, '#48e2ff');
        } else {
            text(`BEST ${best}`, W / 2, 72, '#c9b8ff');
        }
        if (overT > 0.6) text(isTouch ? 'TAP TO PLAY AGAIN' : 'CLICK TO PLAY AGAIN', W / 2, 104, '#ffffff');
    }

    function drawMallet() {
        if (!pointer.visible && pointer.touchTimer <= 0) return;
        ctx.save();
        ctx.translate(Math.round(pointer.x), Math.round(pointer.y));
        ctx.rotate(pointer.swing > 0 ? -0.7 : 0.45);
        ctx.drawImage(SPR.mallet, -6, -3);
        ctx.restore();
    }

    function draw(t) {
        ctx.imageSmoothingEnabled = false;
        ctx.save();
        if (shake > 0) ctx.translate(Math.round((Math.random() - 0.5) * 4), Math.round((Math.random() - 0.5) * 4));
        ctx.drawImage(bg, 0, 0);
        holes.forEach((h) => drawHole(h, t));
        fx.forEach((p) => {
            if (p.type === 'star') {
                ctx.fillStyle = p.color;
                ctx.fillRect(Math.round(p.x), Math.round(p.y), 2, 2);
            } else {
                text(p.text, Math.round(p.x), Math.round(p.y), p.color);
            }
        });
        ctx.restore();
        drawHud();
        if (flash > 0) {
            ctx.fillStyle = `rgba(255, 51, 85, ${(flash * 1.6).toFixed(2)})`;
            ctx.fillRect(0, 0, W, H);
        }
        if (state === 'title') drawTitle();
        else if (state === 'over') drawOver();
        drawMallet();
    }

    // ---------- loop / open / close ----------
    let raf = 0;
    let lastT = 0;
    let clockT = 0;

    function frame() {
        // one clock for both ends: rAF timestamps can run on a different time base than performance.now()
        const now = performance.now();
        const dt = Math.min(0.05, Math.max(0, (now - lastT) / 1000));
        lastT = now;
        clockT += dt;
        titleT += dt;
        if (state === 'over') overT += dt;
        update(dt);
        draw(clockT);
        raf = requestAnimationFrame(frame);
    }

    let lastFocus = null;
    function open() {
        if (!arcade.hidden) return;
        lastFocus = document.activeElement;
        arcade.hidden = false;
        state = 'title';
        titleT = 0;
        resetBoard();
        if (document.fonts) document.fonts.load(FONT).catch(() => {});
        canvas.focus();
        lastT = performance.now();
        raf = requestAnimationFrame(frame);
    }

    function close() {
        if (arcade.hidden) return;
        arcade.hidden = true;
        cancelAnimationFrame(raf);
        state = 'title';
        if (lastFocus && typeof lastFocus.focus === 'function') lastFocus.focus();
    }

    function toCanvas(e) {
        const r = canvas.getBoundingClientRect();
        return {
            x: ((e.clientX - r.left - canvas.clientLeft) * W) / canvas.clientWidth,
            y: ((e.clientY - r.top - canvas.clientTop) * H) / canvas.clientHeight,
        };
    }

    canvas.addEventListener('pointermove', (e) => {
        const p = toCanvas(e);
        pointer.x = p.x;
        pointer.y = p.y;
        pointer.visible = e.pointerType === 'mouse';
    });
    canvas.addEventListener('pointerleave', () => { pointer.visible = false; });
    canvas.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        ensureAudio();
        canvas.focus();
        const p = toCanvas(e);
        pointer.x = p.x;
        pointer.y = p.y;
        if (e.pointerType === 'mouse') pointer.visible = true;
        else pointer.touchTimer = 0.35;
        bonkAt(p.x, p.y);
    });

    arcade.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            e.preventDefault();
            close();
            return;
        }
        if (e.key === 'Tab') {
            const focusables = [soundBtn, closeBtn, canvas];
            const i = focusables.indexOf(document.activeElement);
            e.preventDefault();
            const next = e.shiftKey ? (i <= 0 ? focusables.length - 1 : i - 1) : (i + 1) % focusables.length;
            focusables[next].focus();
            return;
        }
        if (e.target !== canvas) return;
        if (/^[1-9]$/.test(e.key)) {
            e.preventDefault();
            ensureAudio();
            const h = holes[Number(e.key) - 1];
            pointer.x = h.cx;
            pointer.y = h.cy - 12;
            pointer.touchTimer = 0.3;
            bonkAt(h.cx, h.cy - 12);
        } else if ((e.key === ' ' || e.key === 'Enter') && state !== 'play') {
            e.preventDefault();
            ensureAudio();
            bonkAt(-100, -100);
        }
    });

    arcade.addEventListener('pointerdown', (e) => {
        if (e.target === arcade) close();
    });
    closeBtn.addEventListener('click', close);
    if (bubble) bubble.addEventListener('click', open);
    const playBtn = document.getElementById('hud-play');
    if (playBtn) playBtn.addEventListener('click', open);
    document.addEventListener('cafe:play', open);
})();
