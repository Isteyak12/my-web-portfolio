(() => {
    const arcade = document.getElementById('drone-arcade');
    const canvas = document.getElementById('drone-canvas');
    const openBtn = document.getElementById('hud-drone');
    const closeBtn = document.getElementById('drone-close');
    const soundBtn = document.getElementById('drone-sound');
    if (!arcade || !canvas) return;

    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;
    const FONT = '8px "Press Start 2P", monospace';
    const BEST_KEY = 'neon-drone-best';
    const SFX_KEY = 'neon-drone-sfx';
    const isTouch = window.matchMedia('(hover: none)').matches;

    // camera / world
    const F = 110;
    const CX = W / 2;
    const CY = 70;
    const Z_DRONE = 2.6;
    const Z_FAR = 26;
    const GAP = 7.5;
    const FLOOR = -1.25;
    const BOUND_X = 1.35;
    const BOUND_Y_MIN = -0.85;
    const BOUND_Y_MAX = 0.75;
    const MAX_SHIELDS = 3;

    const store = {
        get(key) { try { return localStorage.getItem(key); } catch (_) { return null; } },
        set(key, value) { try { localStorage.setItem(key, value); } catch (_) { /* storage unavailable */ } },
    };
    const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
    const project = (x, y, z) => ({ x: CX + (x * F) / z, y: CY - (y * F) / z, s: F / z });

    // ---------- drone sprite (seen from behind) ----------
    function sprite(rows, pal) {
        const c = document.createElement('canvas');
        c.width = rows[0].length;
        c.height = rows.length;
        const g = c.getContext('2d');
        rows.forEach((row, y) => [...row].forEach((ch, x) => {
            if (pal[ch]) {
                g.fillStyle = pal[ch];
                g.fillRect(x, y, 1, 1);
            }
        }));
        return c;
    }
    const DRONE_BODY = [
        '..oo............oo..',
        '..ogoooooooooooogo..',
        '...oobbbbbbbbbboo...',
        '....obcbbbbbbcbo....',
        '....obbbggggbbbo....',
        '.....obbrrrrbbo.....',
        '......oooooooo......',
        '......o......o......',
        '.....oo......oo.....',
    ];
    const DRONE_PAL = { o: '#120a1f', b: '#2b2f3d', g: '#59607a', c: '#48e2ff', r: '#ff3355', p: '#c8d2e6' };
    const droneFrames = [
        sprite(['pppppp........pppppp', ...DRONE_BODY], DRONE_PAL),
        sprite(['..pppp........pppp..', ...DRONE_BODY], DRONE_PAL),
    ];

    // ---------- static backdrop: synthwave sky, sun, skyline ----------
    const backdrop = document.createElement('canvas');
    backdrop.width = W;
    backdrop.height = H;
    (() => {
        const b = backdrop.getContext('2d');
        const sky = b.createLinearGradient(0, 0, 0, CY);
        sky.addColorStop(0, '#07021a');
        sky.addColorStop(0.55, '#3b0b5c');
        sky.addColorStop(1, '#c2366e');
        b.fillStyle = sky;
        b.fillRect(0, 0, W, CY);
        const rnd = (() => { let s = 9; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; })();
        for (let i = 0; i < 40; i++) {
            b.fillStyle = `rgba(255,255,255,${0.3 + rnd() * 0.6})`;
            b.fillRect(Math.floor(rnd() * W), 16 + Math.floor(rnd() * (CY - 40)), 1, 1);
        }
        const sun = b.createLinearGradient(0, CY - 34, 0, CY);
        sun.addColorStop(0, '#ffe36e');
        sun.addColorStop(1, '#ff3d8b');
        b.fillStyle = sun;
        b.beginPath();
        b.arc(CX, CY - 4, 26, 0, Math.PI * 2);
        b.fill();
        b.fillStyle = '#7a1d63';
        for (let i = 0; i < 6; i++) b.fillRect(CX - 26, CY - 16 + i * 4, 52, 1 + Math.floor(i / 2));
        for (let x = 0; x < W;) {
            const w = 6 + Math.floor(rnd() * 12);
            const h = 6 + Math.floor(rnd() * 18);
            b.fillStyle = '#12082a';
            b.fillRect(x, CY - h, w, h);
            for (let wy = CY - h + 2; wy < CY - 1; wy += 3) {
                for (let wx = x + 1; wx < x + w - 1; wx += 2) {
                    if (rnd() < 0.3) {
                        b.fillStyle = rnd() < 0.5 ? '#ff7ac8' : '#6fe3ff';
                        b.fillRect(wx, wy, 1, 1);
                    }
                }
            }
            x += w + Math.floor(rnd() * 3);
        }
        const ground = b.createLinearGradient(0, CY, 0, H);
        ground.addColorStop(0, '#1a0630');
        ground.addColorStop(1, '#07020f');
        b.fillStyle = ground;
        b.fillRect(0, CY, W, H - CY);
        b.fillStyle = '#ff5fb4';
        b.fillRect(0, CY, W, 1);
    })();

    // ---------- sound ----------
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
            case 'pass': tone(660, 0.06, { vol: 0.04 }); tone(990, 0.08, { delay: 0.05, vol: 0.04 }); break;
            case 'perfect': [784, 1047, 1568].forEach((f, i) => tone(f, 0.07, { delay: i * 0.05, vol: 0.04 })); break;
            case 'gold': [880, 1175, 1760].forEach((f, i) => tone(f, 0.08, { delay: i * 0.06, type: 'triangle', vol: 0.06 })); break;
            case 'crash': tone(220, 0.3, { type: 'sawtooth', to: 55, vol: 0.07 }); break;
            case 'start': [392, 523, 784].forEach((f, i) => tone(f, 0.07, { delay: i * 0.07, vol: 0.04 })); break;
            case 'end': [523, 392, 294, 196].forEach((f, i) => tone(f, 0.14, { delay: i * 0.11, vol: 0.04 })); break;
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

    // ---------- state ----------
    let state = 'title';
    let score = 0;
    let best = Number(store.get(BEST_KEY)) || 0;
    let shields = MAX_SHIELDS;
    let combo = 0;
    let travel = 0;
    let speed = 7;
    let shake = 0;
    let flash = 0;
    let stateT = 0;
    let crashT = 0;
    let newBest = false;
    let clockT = 0;
    const rings = [];
    const fx = [];
    const dust = Array.from({ length: 34 }, () => ({ a: Math.random() * Math.PI * 2, r: 4 + Math.random() * 120 }));
    const drone = { x: 0, y: 0, tx: 0, ty: 0, vx: 0 };
    const keys = new Set();
    let lastCenter = { x: 0, y: 0 };

    function spawnRing(z) {
        const gold = score >= 3 && Math.random() < 0.15;
        const base = Math.max(0.27, 0.44 - score * 0.004);
        // the course drifts gently at first, then swings wider as the score climbs
        const spread = Math.min(1, 0.35 + score * 0.08);
        const x = clamp(lastCenter.x + (Math.random() - 0.5) * 1.1 * spread, -BOUND_X * 0.85, BOUND_X * 0.85);
        const y = clamp(lastCenter.y + (Math.random() - 0.5) * 0.9 * spread, BOUND_Y_MIN * 0.8, BOUND_Y_MAX * 0.8);
        lastCenter = { x, y };
        rings.push({ x, y, z, r: gold ? base * 0.8 : base, gold, done: false, missed: false, pulse: 0 });
    }

    function startRun() {
        state = 'play';
        stateT = 0;
        score = 0;
        shields = MAX_SHIELDS;
        combo = 0;
        travel = 0;
        speed = 5.5;
        newBest = false;
        rings.length = 0;
        fx.length = 0;
        Object.assign(drone, { x: 0, y: 0, tx: 0, ty: 0, vx: 0 });
        lastCenter = { x: 0, y: 0 };
        for (let z = 9; z <= Z_FAR; z += GAP) spawnRing(z);
        sfx('start');
    }

    function endRun() {
        state = 'over';
        stateT = 0;
        newBest = score > best;
        if (newBest) {
            best = score;
            store.set(BEST_KEY, String(best));
        }
        sfx('end');
    }

    function popText(text, color) {
        const p = project(drone.x, drone.y, Z_DRONE);
        fx.push({ type: 'text', x: p.x, y: p.y - 18, vy: -20, life: 0.8, text, color });
    }

    function sparks(x, y, color) {
        for (let i = 0; i < 12; i++) {
            const a = (i / 12) * Math.PI * 2;
            const v = 50 + Math.random() * 40;
            fx.push({ type: 'spark', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.45, color });
        }
    }

    function checkRing(ring) {
        ring.done = true;
        const d = Math.hypot(drone.x - ring.x, drone.y - ring.y);
        const p = project(ring.x, ring.y, Z_DRONE);
        if (d <= ring.r - 0.05) {
            combo += 1;
            let pts = ring.gold ? 3 : 1;
            const perfect = d < ring.r * 0.35;
            if (perfect) pts += 1;
            if (combo >= 5) pts *= 2;
            score += pts;
            ring.pulse = 0.35;
            sparks(p.x, p.y, ring.gold ? '#ffd27a' : '#48e2ff');
            popText(perfect ? `PERFECT +${pts}` : `+${pts}`, ring.gold ? '#ffd27a' : perfect ? '#ff5fb4' : '#ffffff');
            sfx(ring.gold ? 'gold' : perfect ? 'perfect' : 'pass');
        } else {
            ring.missed = true;
            combo = 0;
            shields = Math.max(0, shields - 1);
            shake = 0.3;
            flash = 0.22;
            sfx('crash');
            popText('MISS', '#ff3355');
            if (shields === 0 && crashT <= 0) crashT = 0.7;
        }
    }

    function update(dt) {
        stateT += dt;
        const playing = state === 'play';
        const pace = playing ? speed : 3.5;
        travel += pace * dt;

        dust.forEach((d) => {
            d.r += (d.r * 1.6 + 8) * dt * (pace / 7);
            if (d.r > 140) {
                d.r = 2 + Math.random() * 8;
                d.a = Math.random() * Math.PI * 2;
            }
        });

        if (playing) {
            speed = Math.min(13, 5.5 + score * 0.15);
            const kx = (keys.has('right') ? 1 : 0) - (keys.has('left') ? 1 : 0);
            const ky = (keys.has('up') ? 1 : 0) - (keys.has('down') ? 1 : 0);
            if (kx || ky) {
                drone.tx = clamp(drone.tx + kx * 2.2 * dt, -BOUND_X, BOUND_X);
                drone.ty = clamp(drone.ty + ky * 2.2 * dt, BOUND_Y_MIN, BOUND_Y_MAX);
            }
        } else if (state === 'title') {
            drone.tx = Math.sin(stateT * 1.3) * 0.5;
            drone.ty = Math.sin(stateT * 2.1) * 0.2;
        }

        const prevX = drone.x;
        const follow = Math.min(1, dt * 9);
        drone.x += (drone.tx - drone.x) * follow;
        drone.y += (drone.ty - drone.y) * follow;
        drone.vx = dt > 0 ? (drone.x - prevX) / dt : 0;

        if (playing) {
            rings.forEach((ring) => {
                const prevZ = ring.z;
                ring.z -= speed * dt;
                if (!ring.done && prevZ > Z_DRONE && ring.z <= Z_DRONE) checkRing(ring);
                ring.pulse = Math.max(0, ring.pulse - dt);
            });
            for (let i = rings.length - 1; i >= 0; i--) if (rings[i].z < 0.7) rings.splice(i, 1);
            const farthest = rings.reduce((m, r) => Math.max(m, r.z), 0);
            if (farthest < Z_FAR - GAP) spawnRing(farthest + GAP);
            if (crashT > 0) {
                crashT -= dt;
                if (crashT <= 0) endRun();
            }
        }

        for (let i = fx.length - 1; i >= 0; i--) {
            const p = fx[i];
            p.x += (p.vx || 0) * dt;
            p.y += (p.vy || 0) * dt;
            p.life -= dt;
            if (p.life <= 0) fx.splice(i, 1);
        }
        shake = Math.max(0, shake - dt);
        flash = Math.max(0, flash - dt);
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

    function drawFloor() {
        ctx.fillStyle = 'rgba(255, 95, 180, 0.55)';
        const offset = travel % 1.5;
        for (let k = 0; k < 16; k++) {
            const z = 1.2 + k * 1.5 - offset;
            if (z <= 0.9) continue;
            const y = Math.round(CY - (FLOOR * F) / z);
            if (y >= H || y <= CY) continue;
            ctx.globalAlpha = Math.min(1, 1.6 / z);
            ctx.fillRect(0, y, W, 1);
        }
        ctx.globalAlpha = 0.45;
        for (let x = -9; x <= 9; x++) {
            const near = project(x * 0.9, FLOOR, 0.9);
            const steps = 60;
            for (let i = 0; i <= steps; i++) {
                const t = i / steps;
                const px = Math.round(near.x + (CX - near.x) * t);
                const py = Math.round(near.y + (CY - near.y) * t);
                if (py < H && py > CY) ctx.fillRect(px, py, 1, 1);
            }
        }
        ctx.globalAlpha = 1;
    }

    function drawDust() {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
        dust.forEach((d) => {
            const x = Math.round(CX + Math.cos(d.a) * d.r);
            const y = Math.round(CY - 6 + Math.sin(d.a) * d.r * 0.7);
            if (y > 16) ctx.fillRect(x, y, d.r > 60 ? 2 : 1, 1);
        });
    }

    function drawRing(ring, isNext) {
        const p = project(ring.x, ring.y, ring.z);
        const rad = ring.r * p.s;
        if (rad < 1 || rad > 260) return;
        let color = ring.gold ? '#ffd27a' : isNext ? '#ff5fb4' : '#48e2ff';
        if (ring.missed) color = '#ff3355';
        const fade = ring.z < Z_DRONE ? Math.max(0, ring.z / Z_DRONE) : 1;
        const thick = Math.max(1, 0.07 * p.s);
        ctx.save();
        ctx.globalAlpha = fade;
        ctx.strokeStyle = color;
        ctx.globalAlpha = 0.25 * fade;
        ctx.lineWidth = thick * 3;
        ctx.beginPath();
        ctx.arc(p.x, p.y, rad, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = fade;
        ctx.lineWidth = thick;
        ctx.stroke();
        if (isNext && !ring.done) {
            const blink = 0.5 + 0.5 * Math.sin(clockT * 10);
            ctx.globalAlpha = 0.5 * blink;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(p.x, p.y, rad + thick * 2.5, 0, Math.PI * 2);
            ctx.stroke();
        }
        if (ring.pulse > 0) {
            ctx.globalAlpha = ring.pulse * 2;
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(p.x, p.y, rad * (1 + (0.35 - ring.pulse) * 2), 0, Math.PI * 2);
            ctx.stroke();
        }
        ctx.restore();
    }

    function drawAim(ring) {
        const p = project(drone.x, drone.y, ring.z);
        const inside = Math.hypot(drone.x - ring.x, drone.y - ring.y) <= ring.r - 0.05;
        ctx.fillStyle = inside ? '#7dff9c' : '#ffffff';
        const x = Math.round(p.x);
        const y = Math.round(p.y);
        ctx.fillRect(x - 3, y, 2, 1);
        ctx.fillRect(x + 2, y, 2, 1);
        ctx.fillRect(x, y - 3, 1, 2);
        ctx.fillRect(x, y + 2, 1, 2);
    }

    function drawDrone() {
        const p = project(drone.x, drone.y, Z_DRONE);
        const shadow = project(drone.x, FLOOR, Z_DRONE);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        ctx.fillRect(Math.round(shadow.x - 12), Math.round(shadow.y), 24, 2);
        ctx.fillRect(Math.round(shadow.x - 8), Math.round(shadow.y - 1), 16, 1);
        const img = droneFrames[Math.floor(clockT * 30) % 2];
        const bank = clamp(-drone.vx * 0.12, -0.45, 0.45);
        const bob = Math.round(Math.sin(clockT * 6) * 1);
        ctx.save();
        ctx.translate(Math.round(p.x), Math.round(p.y) + bob);
        ctx.rotate(bank);
        ctx.drawImage(img, -20, -10, 40, 20);
        ctx.restore();
        if (Math.floor(clockT * 4) % 2 === 0) {
            ctx.fillStyle = '#7dff9c';
            ctx.fillRect(Math.round(p.x) - 1, Math.round(p.y) + bob - 9, 2, 1);
        }
    }

    function drawHud() {
        ctx.fillStyle = '#0a0517';
        ctx.fillRect(0, 0, W, 15);
        ctx.fillStyle = '#ff5fb4';
        ctx.fillRect(0, 15, W, 1);
        text(`SCORE ${String(score).padStart(3, '0')}`, 4, 4, '#ffd27a', 'left');
        for (let i = 0; i < MAX_SHIELDS; i++) {
            const x = W - 12 - i * 10;
            ctx.fillStyle = '#05020a';
            ctx.fillRect(x - 1, 3, 9, 9);
            ctx.fillStyle = i < shields ? '#48e2ff' : '#2b1450';
            ctx.fillRect(x, 4, 7, 7);
            if (i < shields) {
                ctx.fillStyle = '#c9f6ff';
                ctx.fillRect(x + 1, 5, 2, 2);
            }
        }
        if (state === 'play' && combo >= 5) text('x2', W / 2, 4, '#ff5fb4');
    }

    function dim() {
        ctx.fillStyle = 'rgba(10, 5, 23, 0.72)';
        ctx.fillRect(0, 16, W, H - 16);
    }

    function drawTitle() {
        dim();
        text('NEON DRONE', W / 2, 24, '#ffd27a');
        text('PORTAL RUN', W / 2, 36, '#ff5fb4');
        const bob = Math.round(Math.sin(stateT * 3) * 3);
        ctx.drawImage(droneFrames[Math.floor(clockT * 30) % 2], W / 2 - 30, 52 + bob, 60, 30);
        if (Math.floor(stateT * 2) % 2 === 0) text(isTouch ? 'TAP TO START' : 'CLICK TO START', W / 2, 92, '#ffffff');
        text(isTouch ? 'DRAG TO STEER' : 'MOUSE/ARROWS/WASD', W / 2, 108, '#48e2ff');
        text(`BEST ${best}`, W / 2, 126, '#c9b8ff');
    }

    function drawOver() {
        dim();
        text('SIGNAL LOST', W / 2, 30, '#ff3355');
        text(`SCORE ${score}`, W / 2, 54, '#ffd27a');
        if (newBest) {
            if (Math.floor(stateT * 3) % 2 === 0) text('NEW BEST!', W / 2, 72, '#48e2ff');
        } else {
            text(`BEST ${best}`, W / 2, 72, '#c9b8ff');
        }
        if (stateT > 0.6) text(isTouch ? 'TAP TO FLY AGAIN' : 'CLICK TO FLY AGAIN', W / 2, 104, '#ffffff');
    }

    function draw() {
        ctx.imageSmoothingEnabled = false;
        ctx.save();
        if (shake > 0) ctx.translate(Math.round((Math.random() - 0.5) * 4), Math.round((Math.random() - 0.5) * 4));
        ctx.drawImage(backdrop, 0, 0);
        drawFloor();
        drawDust();
        const sorted = rings.slice().sort((a, b) => b.z - a.z);
        const next = rings.filter((r) => !r.done).sort((a, b) => a.z - b.z)[0];
        sorted.filter((r) => r.z >= Z_DRONE).forEach((r) => drawRing(r, r === next));
        if (state === 'play' && next) drawAim(next);
        drawDrone();
        sorted.filter((r) => r.z < Z_DRONE).forEach((r) => drawRing(r, false));
        fx.forEach((p) => {
            if (p.type === 'spark') {
                ctx.fillStyle = p.color;
                ctx.fillRect(Math.round(p.x), Math.round(p.y), 2, 2);
            } else {
                text(p.text, Math.round(p.x), Math.round(p.y), p.color);
            }
        });
        ctx.restore();
        drawHud();
        if (flash > 0) {
            ctx.fillStyle = `rgba(255, 51, 85, ${(flash * 1.5).toFixed(2)})`;
            ctx.fillRect(0, 0, W, H);
        }
        if (state === 'title') drawTitle();
        else if (state === 'over') drawOver();
    }

    // ---------- loop / input / open / close ----------
    let raf = 0;
    let lastT = 0;
    function frame() {
        const now = performance.now();
        const dt = Math.min(0.05, Math.max(0, (now - lastT) / 1000));
        lastT = now;
        clockT += dt;
        update(dt);
        draw();
        raf = requestAnimationFrame(frame);
    }

    function toCanvas(e) {
        const r = canvas.getBoundingClientRect();
        return {
            x: ((e.clientX - r.left - canvas.clientLeft) * W) / canvas.clientWidth,
            y: ((e.clientY - r.top - canvas.clientTop) * H) / canvas.clientHeight,
        };
    }

    function steerTo(e) {
        const p = toCanvas(e);
        drone.tx = clamp(((p.x - CX) * Z_DRONE) / F, -BOUND_X, BOUND_X);
        drone.ty = clamp(((CY - p.y) * Z_DRONE) / F, BOUND_Y_MIN, BOUND_Y_MAX);
    }

    canvas.addEventListener('pointermove', (e) => {
        if (state === 'play') steerTo(e);
    });
    canvas.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        ensureAudio();
        canvas.focus();
        if (state === 'title' || (state === 'over' && stateT > 0.6)) {
            startRun();
            steerTo(e);
        } else if (state === 'play') {
            steerTo(e);
        }
    });

    const KEYMAP = {
        ArrowLeft: 'left', a: 'left', A: 'left',
        ArrowRight: 'right', d: 'right', D: 'right',
        ArrowUp: 'up', w: 'up', W: 'up',
        ArrowDown: 'down', s: 'down', S: 'down',
    };

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
        if (KEYMAP[e.key]) {
            e.preventDefault();
            keys.add(KEYMAP[e.key]);
        } else if ((e.key === ' ' || e.key === 'Enter') && state !== 'play') {
            e.preventDefault();
            ensureAudio();
            if (state === 'title' || stateT > 0.6) startRun();
        }
    });
    arcade.addEventListener('keyup', (e) => {
        if (KEYMAP[e.key]) keys.delete(KEYMAP[e.key]);
    });

    let lastFocus = null;
    function open() {
        if (!arcade.hidden) return;
        lastFocus = document.activeElement;
        arcade.hidden = false;
        state = 'title';
        stateT = 0;
        rings.length = 0;
        fx.length = 0;
        keys.clear();
        if (document.fonts) document.fonts.load(FONT).catch(() => {});
        canvas.focus();
        lastT = performance.now();
        raf = requestAnimationFrame(frame);
    }

    function close() {
        if (arcade.hidden) return;
        arcade.hidden = true;
        cancelAnimationFrame(raf);
        keys.clear();
        state = 'title';
        if (lastFocus && typeof lastFocus.focus === 'function') lastFocus.focus();
    }

    arcade.addEventListener('pointerdown', (e) => {
        if (e.target === arcade) close();
    });
    closeBtn.addEventListener('click', close);
    if (openBtn) openBtn.addEventListener('click', open);
})();
