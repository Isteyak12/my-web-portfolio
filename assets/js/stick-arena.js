(() => {
    const canvas = document.getElementById('stick-arena-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const overlay = document.getElementById('arena-overlay');
    const restart = document.getElementById('arena-restart');
    const W = canvas.width, H = canvas.height, ground = 308;
    const keys = new Set();
    let started = false, finished = false, last = 0, flash = 0;

    function fighter(x, color, name, facing) {
        return { x, y: ground, vx: 0, vy: 0, color, name, facing, health: 100, attack: '', attackTime: 0, cooldown: 0, hurt: 0, lean: 0, step: 0, wins: 0 };
    }
    let player, bot;

    function reset() {
        player = fighter(190, '#47b5ff', 'YOU', 1);
        bot = fighter(530, '#ff5d73', 'BOT', -1);
        finished = false; started = false; flash = 0;
        overlay.textContent = 'Press a control to begin';
        overlay.classList.remove('hidden');
    }
    reset();

    function keyName(e) { return e.key.toLowerCase(); }
    window.addEventListener('keydown', e => {
        const key = keyName(e);
        const target = e.target;
        if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target.isContentEditable) return;
        if (['a', 'd', 'w', 'j', 'k'].includes(key)) { e.preventDefault(); keys.add(key); start(); }
    });
    window.addEventListener('keyup', e => keys.delete(keyName(e)));
    window.addEventListener('blur', () => keys.clear());
    document.querySelectorAll('[data-arena-key]').forEach(button => {
        const key = button.dataset.arenaKey;
        const down = e => { e.preventDefault(); keys.add(key); start(); };
        const up = e => { e.preventDefault(); keys.delete(key); };
        button.addEventListener('pointerdown', down);
        button.addEventListener('pointerup', up);
        button.addEventListener('pointerleave', up);
        button.addEventListener('pointercancel', up);
    });
    restart.addEventListener('click', reset);

    function start() { if (!finished) { started = true; overlay.classList.add('hidden'); } }
    function strike(f, type) {
        if (f.cooldown || f.hurt || finished) return;
        f.attack = type; f.attackTime = type === 'kick' ? .34 : .24; f.cooldown = type === 'kick' ? .48 : .32;
    }
    function hit(attacker, defender) {
        if (!attacker.attack || attacker.attackTime < .08 || attacker.attackTime > .18 || defender.hurt) return;
        const reach = attacker.attack === 'kick' ? 72 : 54;
        if (Math.abs(attacker.x - defender.x) < reach && Math.abs(attacker.y - defender.y) < 40) {
            const damage = attacker.attack === 'kick' ? 14 : 9;
            defender.health = Math.max(0, defender.health - damage);
            defender.vx += attacker.facing * (attacker.attack === 'kick' ? 185 : 120);
            defender.vy = -110; defender.hurt = .26; defender.lean = attacker.facing * .65; flash = .12;
            attacker.attackTime = 0;
            if (defender.health === 0) end(attacker);
        }
    }
    function end(winner) {
        finished = true; started = false;
        overlay.textContent = winner.name === 'YOU' ? 'Victory! Training bot defeated.' : 'Bot wins — try again.';
        overlay.classList.remove('hidden');
    }
    function updateFighter(f, dt) {
        f.attackTime = Math.max(0, f.attackTime - dt); if (!f.attackTime) f.attack = '';
        f.cooldown = Math.max(0, f.cooldown - dt); f.hurt = Math.max(0, f.hurt - dt);
        f.vy += 770 * dt; f.x += f.vx * dt; f.y += f.vy * dt;
        f.vx *= Math.pow(.0005, dt); f.x = Math.max(38, Math.min(W - 38, f.x));
        if (f.y >= ground) { f.y = ground; f.vy = 0; }
        f.step += Math.abs(f.vx) * dt * .06;
        f.lean *= Math.pow(.01, dt);
    }
    function update(dt) {
        if (!started || finished) return;
        const dir = (keys.has('d') ? 1 : 0) - (keys.has('a') ? 1 : 0);
        if (dir) { player.vx += dir * 900 * dt; player.facing = dir; }
        if (keys.has('w') && player.y === ground) { player.vy = -370; keys.delete('w'); }
        if (keys.has('j')) { strike(player, 'punch'); keys.delete('j'); }
        if (keys.has('k')) { strike(player, 'kick'); keys.delete('k'); }
        const distance = player.x - bot.x;
        bot.facing = distance < 0 ? -1 : 1;
        if (Math.abs(distance) > 62) bot.vx += Math.sign(distance) * 410 * dt;
        else if (Math.random() < dt * 2.2) strike(bot, Math.random() > .45 ? 'kick' : 'punch');
        if (bot.y === ground && Math.random() < dt * .18 && Math.abs(distance) > 120) bot.vy = -335;
        updateFighter(player, dt); updateFighter(bot, dt);
        hit(player, bot); hit(bot, player);
        flash = Math.max(0, flash - dt);
    }
    function line(x1, y1, x2, y2, color, width = 7) { ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); }
    function drawFighter(f) {
        const s = f.facing, bob = f.y === ground ? Math.sin(f.step) * 2 : 0, hipY = f.y - 42 + bob, chestY = f.y - 94 + bob;
        ctx.save(); ctx.translate(f.x, hipY); ctx.rotate(f.lean); ctx.translate(-f.x, -hipY);
        const attack = f.attack, arm = attack === 'punch' ? 34 : 13, leg = attack === 'kick' ? 46 : 18;
        line(f.x, hipY, f.x, chestY, f.color, 9);
        ctx.fillStyle = '#101827'; ctx.beginPath(); ctx.arc(f.x, chestY - 18, 16, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = f.color; ctx.lineWidth = 5; ctx.stroke();
        line(f.x, chestY - 4, f.x + s * arm, chestY + (attack === 'punch' ? -2 : 20), f.color);
        line(f.x, chestY - 2, f.x - s * 22, chestY + 25, f.color);
        line(f.x, hipY, f.x + s * leg, hipY + (attack === 'kick' ? -10 : 37), f.color, 8);
        line(f.x, hipY, f.x - s * 22, hipY + 39, f.color, 8);
        ctx.restore();
        if (f.hurt) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(f.x, chestY - 18, 24, 0, Math.PI * 2); ctx.stroke(); }
    }
    function bar(x, y, f, align) {
        const width = 220; ctx.textAlign = align; ctx.font = '700 13px system-ui'; ctx.fillStyle = '#dceaff'; ctx.fillText(f.name, x, y - 10);
        const left = align === 'left' ? x : x - width; ctx.fillStyle = '#222b3c'; ctx.fillRect(left, y, width, 10);
        ctx.fillStyle = f.color; ctx.fillRect(left, y, width * f.health / 100, 10); ctx.strokeStyle = 'rgba(255,255,255,.3)'; ctx.strokeRect(left, y, width, 10);
    }
    function draw() {
        const bg = ctx.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#07162d'); bg.addColorStop(1, '#101525'); ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = 'rgba(71,181,255,.12)'; for (let i = 0; i < 7; i++) ctx.fillRect(i * 120 - 20, 95 + (i % 2) * 35, 76, 4);
        ctx.fillStyle = '#172a42'; ctx.fillRect(0, ground + 2, W, H - ground); ctx.strokeStyle = '#55c6ff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, ground + 2); ctx.lineTo(W, ground + 2); ctx.stroke();
        bar(28, 32, player, 'left'); bar(W - 28, 32, bot, 'right');
        ctx.fillStyle = '#94a9c6'; ctx.textAlign = 'center'; ctx.font = '700 12px system-ui'; ctx.fillText('FIRST TO ZERO', W / 2, 32);
        drawFighter(player); drawFighter(bot);
        if (flash) { ctx.fillStyle = `rgba(255,255,255,${flash * 2})`; ctx.fillRect(0, 0, W, H); }
    }
    function frame(time) { const dt = Math.min(.035, (time - last) / 1000 || 0); last = time; update(dt); draw(); requestAnimationFrame(frame); }
    requestAnimationFrame(frame);
})();
