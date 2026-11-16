(() => {
    const $ = (id) => document.getElementById(id);
    const stage = $('stage');
    const flyEl = $('fly');
    const bubble = $('fly-bubble');
    const codeText = $('code-text');
    const runBtn = $('run-btn');
    const testsEl = $('tests');
    const verdictEl = $('verdict');
    const brainState = $('brain-state');
    const replayBtn = $('replay-btn');
    const skipBtn = $('skip-btn');

    const SOLUTION = [
        'def pair_sum(nums, target):',
        '    seen = {}',
        '    for i, n in enumerate(nums):',
        '        need = target - n',
        '        if need in seen:',
        '            return [seen[need], i]',
        '        seen[n] = i',
        '    return []',
    ].join('\n');

    // the same algorithm in JS, so the tests below are really executed
    function pairSum(nums, target) {
        const seen = new Map();
        for (let i = 0; i < nums.length; i++) {
            const need = target - nums[i];
            if (seen.has(need)) return [seen.get(need), i];
            seen.set(nums[i], i);
        }
        return [];
    }

    const TESTS = [
        { nums: [2, 7, 11, 15], target: 9, expect: [0, 1] },
        { nums: [3, 2, 4], target: 6, expect: [1, 2] },
        { nums: [3, 3], target: 6, expect: [0, 1] },
    ];

    // ---------- keyboard ----------
    const ROWS = [
        ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '='],
        ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p', '[', ']'],
        ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', ';', 'enter'],
        ['shift', 'z', 'x', 'c', 'v', 'b', 'n', 'm', ',', '.', '/'],
        ['space'],
    ];
    const SHIFTED = { _: '-', '(': '9', ')': '0', ':': ';', '{': '[', '}': ']' };
    const keys = {};
    const kb = $('keyboard');
    ROWS.forEach((row) => {
        const r = document.createElement('div');
        r.className = 'kb-row';
        row.forEach((k) => {
            const el = document.createElement('div');
            el.className = 'key' + (k === 'space' ? ' space' : k.length > 1 ? ' wide' : '');
            el.textContent = k === 'space' ? '' : k;
            r.appendChild(el);
            keys[k] = el;
        });
        kb.appendChild(r);
    });

    function keyFor(ch) {
        if (ch === '\n') return 'enter';
        if (ch === ' ') return 'space';
        return SHIFTED[ch] || ch;
    }

    // ---------- syntax highlight ----------
    const KW = new Set(['def', 'for', 'in', 'if', 'return']);
    const BI = new Set(['enumerate']);
    const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    function highlight(src) {
        return src.replace(/([A-Za-z_][A-Za-z0-9_]*)|(\d+)|([=\-+:<>])|([^A-Za-z0-9_=\-+:<>]+)/g, (m, word, num, op, rest) => {
            if (word) {
                if (KW.has(word)) return `<span class="tok-kw">${word}</span>`;
                if (BI.has(word)) return `<span class="tok-bi">${word}</span>`;
                if (word === 'pair_sum') return `<span class="tok-fn">${word}</span>`;
                return word;
            }
            if (num) return `<span class="tok-num">${num}</span>`;
            if (op) return `<span class="tok-op">${esc(op)}</span>`;
            return esc(rest);
        });
    }

    // ---------- fly motion ----------
    const fly = { x: 60, y: 60, tx: 60, ty: 60, landed: false, angle: 0 };
    let hoverJitter = true;

    function centerOf(el, dy = 0) {
        const s = stage.getBoundingClientRect();
        const r = el.getBoundingClientRect();
        return { x: r.left - s.left + r.width / 2, y: r.top - s.top + r.height / 2 + dy };
    }

    function flyTo(p) {
        fly.tx = p.x;
        fly.ty = p.y;
    }

    let last = performance.now();
    function tick(now) {
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        const k = 1 - Math.exp(-dt * 14);
        const px = fly.x;
        fly.x += (fly.tx - fly.x) * k;
        fly.y += (fly.ty - fly.y) * k;
        const dist = Math.hypot(fly.tx - fly.x, fly.ty - fly.y);
        fly.landed = dist < 3 && !hoverJitter;
        let jx = 0;
        let jy = 0;
        if (!fly.landed) {
            // bats flutter: a light bob with each wingbeat
            jy = Math.sin(now / 80) * 3;
            jx = Math.sin(now / 170) * 2;
        }
        const vx = (fly.x - px) / Math.max(dt, 0.001);
        fly.angle += (Math.max(-25, Math.min(25, vx * 0.04)) - fly.angle) * k;
        flyEl.style.transform = `translate(${fly.x + jx}px, ${fly.y + jy}px) rotate(${fly.angle * 0.4}deg)`;
        flyEl.classList.toggle('landed', fly.landed);
        drawBrain();
        requestAnimationFrame(tick);
    }

    // ---------- brain raster (stylised) ----------
    const canvas = $('brain-canvas');
    const ctx = canvas.getContext('2d');
    const N = 18;
    const GROUPS = [
        { from: 0, to: 6, color: '#4da6ff' },   // "visual"
        { from: 6, to: 12, color: '#f5b3ff' },  // "decision"
        { from: 12, to: 18, color: '#5fe39a' }, // "motor"
    ];
    const RATES = {
        idle: [0.01, 0.01, 0.01],
        reading: [0.12, 0.04, 0.01],
        thinking: [0.04, 0.16, 0.02],
        typing: [0.05, 0.06, 0.05],
        running: [0.06, 0.1, 0.02],
        solved: [0.2, 0.2, 0.2],
    };
    let mode = 'idle';
    let motorBurst = 0;
    function setMode(m) {
        mode = m;
        brainState.textContent = m;
    }
    function drawBrain() {
        const w = canvas.width;
        const h = canvas.height;
        ctx.drawImage(canvas, -2, 0);
        ctx.fillStyle = 'rgba(8, 10, 18, 0.9)';
        ctx.fillRect(w - 2, 0, 2, h);
        const rowH = h / N;
        GROUPS.forEach((g, gi) => {
            for (let n = g.from; n < g.to; n++) {
                let p = RATES[mode][gi];
                if (gi === 2 && motorBurst > 0) p += 0.5;
                if (Math.random() < p) {
                    ctx.fillStyle = g.color;
                    ctx.fillRect(w - 2, n * rowH + 1, 2, rowH - 2);
                }
            }
        });
        motorBurst = Math.max(0, motorBurst - 1);
    }
    ctx.fillStyle = 'rgba(8, 10, 18, 1)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // ---------- sequencing ----------
    let skipping = false;
    let runId = 0;
    const sleep = (ms) => (skipping ? Promise.resolve() : new Promise((r) => setTimeout(r, ms)));

    function say(text) {
        bubble.textContent = text;
        bubble.classList.toggle('show', !!text);
    }

    async function pressKey(name) {
        const el = keys[name];
        if (!el) return;
        if (!skipping) {
            const p = centerOf(el, -6);
            const travel = Math.hypot(p.x - fly.x, p.y - fly.y);
            flyTo(p);
            await sleep(Math.min(150, 40 + travel * 0.35));
        }
        el.classList.add('down');
        motorBurst = 4;
        await sleep(55);
        el.classList.remove('down');
    }

    async function type(id) {
        let typed = '';
        for (let i = 0; i < SOLUTION.length; i++) {
            if (id !== runId) return;
            const ch = SOLUTION[i];
            // auto-indent: the editor fills leading spaces after Enter
            if (ch === ' ' && (typed.endsWith('\n') || /\n +$/.test(typed))) {
                typed += ch;
                continue;
            }
            const shifted = SHIFTED[ch];
            if (shifted) keys.shift.classList.add('down');
            await pressKey(keyFor(ch));
            if (shifted) keys.shift.classList.remove('down');
            typed += ch;
            codeText.innerHTML = highlight(typed);
        }
    }

    async function runTests(id) {
        flyTo(centerOf(runBtn, -4));
        say('run it…');
        await sleep(650);
        runBtn.classList.add('pressed');
        await sleep(160);
        runBtn.classList.remove('pressed');
        say('');
        setMode('running');
        testsEl.innerHTML = '';
        let passed = 0;
        for (const t of TESTS) {
            if (id !== runId) return 0;
            await sleep(520);
            const got = pairSum(t.nums, t.target);
            const ok = JSON.stringify(got) === JSON.stringify(t.expect);
            if (ok) passed++;
            const li = document.createElement('li');
            li.className = ok ? 'pass' : 'fail';
            li.innerHTML = `<span class="mark">${ok ? '✓' : '✗'}</span><span>pair_sum([${t.nums.join(', ')}], ${t.target}) → [${got.join(', ')}]</span>`;
            testsEl.appendChild(li);
        }
        return passed;
    }

    async function celebrate(id) {
        const c = centerOf(verdictEl, -10);
        hoverJitter = true;
        say('solved!');
        for (let a = 0; a < Math.PI * 4 && id === runId; a += 0.35) {
            flyTo({ x: c.x + Math.cos(a) * 70, y: c.y + Math.sin(a) * 26 });
            await sleep(60);
        }
        flyTo({ x: c.x + 90, y: c.y - 20 });
        await sleep(1400);
        say('');
    }

    async function play() {
        const id = ++runId;
        skipping = false;
        replayBtn.hidden = true;
        skipBtn.hidden = false;
        codeText.innerHTML = '';
        testsEl.innerHTML = '<li class="empty">waiting for a run…</li>';
        verdictEl.textContent = '';
        verdictEl.className = 'verdict';

        hoverJitter = true;
        fly.x = fly.tx = 20;
        fly.y = fly.ty = 20;
        setMode('reading');
        say('reading the problem…');
        flyTo(centerOf($('problem-title'), -18));
        await sleep(2200);
        if (id !== runId) return;

        setMode('thinking');
        say('hash map, one pass?');
        flyTo(centerOf($('code'), -40));
        await sleep(2000);
        if (id !== runId) return;
        say('');

        setMode('typing');
        hoverJitter = false;
        await type(id);
        if (id !== runId) return;
        hoverJitter = true;

        const passed = await runTests(id);
        if (id !== runId) return;
        const all = passed === TESTS.length;
        verdictEl.textContent = all ? `Accepted · ${passed}/${TESTS.length} tests passed` : `${passed}/${TESTS.length} tests passed`;
        verdictEl.classList.add(all ? 'ok' : 'bad');
        setMode(all ? 'solved' : 'idle');

        skipping = false;
        skipBtn.hidden = true;
        await celebrate(id);
        if (id !== runId) return;
        setMode('idle');
        replayBtn.hidden = false;
        replayBtn.focus({ preventScroll: true });
    }

    skipBtn.addEventListener('click', () => {
        skipping = true;
        say('');
    });
    replayBtn.addEventListener('click', play);

    requestAnimationFrame((t) => {
        last = t;
        requestAnimationFrame(tick);
    });
    // wait for fonts so key and line positions are final before the fly starts aiming
    (document.fonts ? document.fonts.ready : Promise.resolve()).then(() => setTimeout(play, 400));
})();
