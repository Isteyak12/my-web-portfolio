(() => {
    const canvas = document.getElementById('sky-hopper-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d'), W = canvas.width, H = canvas.height;
    const overlay = document.getElementById('sky-hopper-overlay');
    const restart = document.getElementById('sky-hopper-restart');
    const keys = new Set();
    let comet, asteroids, crystals, score, best = 0, running, ended, last, spawn, stars, trail;

    function reset() {
        comet = { x: 150, y: H / 2, vy: 0, glow: 0 };
        asteroids = []; crystals = []; trail = []; score = 0; spawn = 0; running = false; ended = false;
        stars = Array.from({ length: 52 }, (_, i) => ({ x: (i * 83) % W, y: 14 + (i * 47) % (H - 28), size: i % 6 === 0 ? 2 : 1 }));
        overlay.textContent = 'Press a direction or tap to start'; overlay.classList.remove('hidden'); draw();
    }
    function start() { if (ended) reset(); running = true; overlay.classList.add('hidden'); }
    function distance(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
    function spawnAsteroid() { const r = 17 + Math.random() * 22; asteroids.push({ x: W + r, y: 34 + Math.random() * (H - 68), r, vx: 170 + Math.random() * 90, vy: (Math.random() - .5) * 36, spin: Math.random() * 6, spinSpeed: (Math.random() - .5) * 2 }); }
    function spawnCrystal() { crystals.push({ x: W + 22, y: 42 + Math.random() * (H - 84), r: 11, vx: 145, bob: Math.random() * 6 }); }
    function finish() { running = false; ended = true; best = Math.max(best, score); overlay.textContent = `Signal lost · ${score} crystals · press a direction to retry`; overlay.classList.remove('hidden'); }
    function update(dt) {
        if (!running) return;
        const up = keys.has('up'), down = keys.has('down');
        if (up) comet.vy -= 780 * dt; if (down) comet.vy += 780 * dt;
        comet.vy *= Math.pow(.022, dt); comet.y += comet.vy * dt; comet.y = Math.max(20, Math.min(H - 20, comet.y)); comet.glow = Math.max(0, comet.glow - dt);
        trail.push({ x: comet.x - 13, y: comet.y, life: .36, color: trail.length % 3 === 0 ? '#ff4b42' : trail.length % 3 === 1 ? '#ffd45d' : '#48bfff' }); trail = trail.filter(p => (p.life -= dt) > 0);
        spawn += dt; if (spawn > .72) { spawn = 0; Math.random() < .62 ? spawnAsteroid() : spawnCrystal(); }
        asteroids.forEach(a => { a.x -= a.vx * dt; a.y += a.vy * dt; a.spin += a.spinSpeed * dt; if (a.y < a.r + 14 || a.y > H - a.r - 14) a.vy *= -1; if (distance(comet, a) < a.r + 13) finish(); });
        crystals.forEach(c => { c.x -= c.vx * dt; c.bob += dt * 4; if (distance(comet, c) < c.r + 16) { c.collected = true; score++; comet.glow = .3; } });
        asteroids = asteroids.filter(a => a.x > -70); crystals = crystals.filter(c => c.x > -35 && !c.collected);
    }
    function drawAsteroid(a) { ctx.save(); ctx.translate(a.x, a.y); ctx.rotate(a.spin); ctx.fillStyle = '#63718d'; ctx.beginPath(); for (let i=0;i<9;i++) { const r = a.r * (.78 + (i % 3) * .12), angle = i * Math.PI * 2 / 9; i ? ctx.lineTo(Math.cos(angle)*r, Math.sin(angle)*r) : ctx.moveTo(Math.cos(angle)*r, Math.sin(angle)*r); } ctx.closePath(); ctx.fill(); ctx.strokeStyle='#9aa9c4'; ctx.lineWidth=2; ctx.stroke(); ctx.fillStyle='rgba(24,35,61,.46)'; ctx.beginPath(); ctx.arc(-a.r*.22,-a.r*.2,a.r*.2,0,Math.PI*2); ctx.arc(a.r*.3,a.r*.17,a.r*.13,0,Math.PI*2); ctx.fill(); ctx.restore(); }
    function drawCrystal(c) { const y=c.y+Math.sin(c.bob)*5; ctx.save();ctx.translate(c.x,y);ctx.rotate(c.bob*.3);ctx.shadowColor='#75f5ec';ctx.shadowBlur=18;ctx.fillStyle='#72eee5';ctx.beginPath();ctx.moveTo(0,-c.r);ctx.lineTo(c.r*.7,0);ctx.lineTo(0,c.r);ctx.lineTo(-c.r*.7,0);ctx.closePath();ctx.fill();ctx.shadowBlur=0;ctx.fillStyle='#e9ffff';ctx.beginPath();ctx.moveTo(0,-c.r*.6);ctx.lineTo(c.r*.32,0);ctx.lineTo(0,c.r*.2);ctx.closePath();ctx.fill();ctx.restore(); }
    function drawComet() {
        ctx.save(); ctx.translate(comet.x, comet.y); ctx.rotate(comet.vy / 700);
        // Layered tail gives the comet a warm fire core with an electric-blue outer wake.
        const blueWake = ctx.createLinearGradient(-70, 0, -5, 0);
        blueWake.addColorStop(0, 'rgba(36, 114, 255, 0)'); blueWake.addColorStop(.6, 'rgba(50, 163, 255, .36)'); blueWake.addColorStop(1, 'rgba(86, 218, 255, .85)');
        ctx.fillStyle = blueWake; ctx.beginPath(); ctx.moveTo(-70, 0); ctx.quadraticCurveTo(-35, -21, -4, -7); ctx.quadraticCurveTo(-31, 19, -70, 0); ctx.fill();
        const fireTail = ctx.createLinearGradient(-57, 0, 2, 0);
        fireTail.addColorStop(0, 'rgba(232, 43, 45, 0)'); fireTail.addColorStop(.55, 'rgba(240, 73, 35, .62)'); fireTail.addColorStop(1, 'rgba(255, 209, 75, .98)');
        ctx.fillStyle = fireTail; ctx.beginPath(); ctx.moveTo(-58, 0); ctx.quadraticCurveTo(-29, -13, 1, -5); ctx.quadraticCurveTo(-23, 13, -58, 0); ctx.fill();
        ctx.shadowColor = comet.glow ? '#fff4a1' : '#ff7653'; ctx.shadowBlur = comet.glow ? 28 : 18;
        ctx.fillStyle = '#b6253c'; ctx.beginPath(); ctx.arc(0, 0, 17, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#ef5631'; ctx.beginPath(); ctx.arc(3, -2, 13, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#ffd45d'; ctx.beginPath(); ctx.arc(7, -4, 8, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0; ctx.fillStyle = 'rgba(117, 221, 255, .9)'; ctx.beginPath(); ctx.arc(-9, 4, 4, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff6bc'; ctx.beginPath(); ctx.arc(10, -6, 3, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
    }
    function draw() {
        const sky=ctx.createLinearGradient(0,0,W,H);sky.addColorStop(0,'#091b3d');sky.addColorStop(1,'#241348');ctx.fillStyle=sky;ctx.fillRect(0,0,W,H);
        stars.forEach(s=>{s.x-=running?20/60:0;if(s.x<0)s.x=W;ctx.fillStyle='rgba(211,238,255,.65)';ctx.fillRect(s.x,s.y,s.size,s.size);});
        ctx.fillStyle='rgba(104,69,205,.18)';ctx.beginPath();ctx.arc(W*.73,H*.45,230,0,Math.PI*2);ctx.fill();
        trail.forEach(p=>{ctx.globalAlpha=p.life/.36*.45;ctx.fillStyle=p.color;ctx.beginPath();ctx.arc(p.x,p.y,10*p.life/.36,0,Math.PI*2);ctx.fill();});ctx.globalAlpha=1;
        crystals.forEach(drawCrystal);asteroids.forEach(drawAsteroid);drawComet();
        ctx.fillStyle='#f4f9ff';ctx.font='800 22px system-ui';ctx.textAlign='center';ctx.fillText(score,W/2,39);ctx.font='700 11px system-ui';ctx.fillStyle='#a7d9ff';ctx.fillText(`CRYSTALS · BEST ${best}`,W/2,57);
    }
    function frame(now) { const dt=Math.min(.035,(now-last)/1000||0);last=now;update(dt);draw();requestAnimationFrame(frame); }
    function controlFromEvent(e) { if (e.key === 'ArrowUp' || e.key.toLowerCase() === 'w') return 'up'; if (e.key === 'ArrowDown' || e.key.toLowerCase() === 's') return 'down'; return ''; }
    window.addEventListener('keydown', e=>{const key=controlFromEvent(e),el=e.target;if(!key||el instanceof HTMLInputElement||el instanceof HTMLTextAreaElement||el.isContentEditable)return;e.preventDefault();keys.add(key);start();});
    window.addEventListener('keyup',e=>keys.delete(controlFromEvent(e)));window.addEventListener('blur',()=>keys.clear());
    document.querySelectorAll('[data-comet-key]').forEach(button=>{const key=button.dataset.cometKey,down=e=>{e.preventDefault();keys.add(key);start();},up=e=>{e.preventDefault();keys.delete(key);};button.addEventListener('pointerdown',down);button.addEventListener('pointerup',up);button.addEventListener('pointerleave',up);button.addEventListener('pointercancel',up);});
    canvas.addEventListener('pointerdown',()=>{keys.add(comet.y > H/2?'up':'down');start();setTimeout(()=>keys.clear(),130);});overlay.addEventListener('click',start);restart.addEventListener('click',reset);reset();requestAnimationFrame(frame);
})();
