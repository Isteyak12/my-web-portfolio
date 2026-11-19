(() => {
    const canvas = document.getElementById('binary-field');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const root = document.documentElement;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const CELL_W = 11;
    const CELL_H = 15;
    const FPS = 12;
    const BASE = 0.045;
    const GLOW = 0.2;

    let cols = 0;
    let rows = 0;
    let cells = [];
    let width = 0;
    let height = 0;
    let running = false;
    let visible = true;
    let last = 0;

    // banded layout like a data dump: 3 rows of digits, then a quiet row,
    // and each row broken into runs of digits separated by gaps
    function build() {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        width = canvas.clientWidth;
        height = canvas.clientHeight;
        canvas.width = Math.round(width * dpr);
        canvas.height = Math.round(height * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        cols = Math.ceil(width / CELL_W);
        rows = Math.ceil(height / CELL_H);
        cells = [];
        for (let r = 0; r < rows; r++) {
            const quietRow = r % 4 === 3;
            let run = 0;
            let gap = 0;
            for (let c = 0; c < cols; c++) {
                if (gap > 0) {
                    gap--;
                    cells.push(null);
                    continue;
                }
                if (run <= 0) {
                    run = 3 + Math.floor(Math.random() * 12);
                }
                run--;
                if (run === 0) gap = 1 + Math.floor(Math.random() * 3);
                if (quietRow || Math.random() < 0.12) {
                    cells.push(null);
                    continue;
                }
                cells.push({ ch: Math.random() < 0.5 ? '0' : '1', glow: Math.random() * 0.4 });
            }
        }
    }

    function color() {
        return root.getAttribute('data-theme') === 'overdrive' ? '255, 122, 26' : '77, 166, 255';
    }

    function draw() {
        ctx.clearRect(0, 0, width, height);
        ctx.font = '600 12px "Fira Code", Consolas, monospace';
        ctx.textBaseline = 'top';
        const rgb = color();
        const cx = width / 2;
        const cy = height * 0.45;
        const maxD = Math.hypot(cx, cy);
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const cell = cells[r * cols + c];
                if (!cell) continue;
                const x = c * CELL_W;
                const y = r * CELL_H;
                // quieter in the middle, where the photo and name sit
                const d = Math.hypot(x - cx, y - cy) / maxD;
                const falloff = 0.25 + 0.75 * Math.min(1, d * 1.6);
                const a = (BASE + cell.glow * GLOW) * falloff;
                if (a < 0.008) continue;
                ctx.fillStyle = `rgba(${rgb}, ${a.toFixed(3)})`;
                ctx.fillText(cell.ch, x, y);
            }
        }
    }

    function step() {
        const flips = Math.max(4, Math.round(cells.length * 0.012));
        for (let i = 0; i < flips; i++) {
            const cell = cells[Math.floor(Math.random() * cells.length)];
            if (!cell) continue;
            cell.ch = cell.ch === '0' ? '1' : '0';
            cell.glow = 1;
        }
        for (const cell of cells) {
            if (cell && cell.glow > 0) cell.glow = Math.max(0, cell.glow - 0.07);
        }
    }

    function loop(now) {
        if (!running) return;
        if (now - last >= 1000 / FPS) {
            last = now;
            step();
            draw();
        }
        requestAnimationFrame(loop);
    }

    function setRunning(on) {
        if (reduceMotion) return;
        if (on && !running) {
            running = true;
            requestAnimationFrame(loop);
        } else if (!on) {
            running = false;
        }
    }

    build();
    draw();

    new ResizeObserver(() => {
        build();
        draw();
    }).observe(canvas);

    const scroller = document.querySelector('.content');
    if ('IntersectionObserver' in window) {
        new IntersectionObserver(([entry]) => {
            visible = entry.isIntersecting;
            setRunning(visible && !document.hidden);
        }, { root: scroller, threshold: 0 }).observe(canvas);
    }
    document.addEventListener('visibilitychange', () => setRunning(visible && !document.hidden));

    // redraw in the new colour when the Overdrive switch flips
    new MutationObserver(draw).observe(root, { attributes: true, attributeFilter: ['data-theme'] });

    setRunning(true);
})();
