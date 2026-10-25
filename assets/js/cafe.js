import * as THREE from 'three';

const RESUME_URL = 'isteyak_resume.pdf';
const stage = document.getElementById('stage');
const bubble = document.getElementById('bubble');

let renderer;
try {
    renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'low-power' });
} catch (err) {
    document.getElementById('fallback').hidden = false;
    bubble.remove();
    throw err;
}
renderer.setPixelRatio(1);
stage.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b0716);
scene.fog = new THREE.Fog(0x2a1145, 18, 46);

const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 120);

// ---------- helpers ----------
const boxGeo = new THREE.BoxGeometry(1, 1, 1);
const matCache = new Map();

function mat(color, glow = false) {
    const key = `${color}|${glow}`;
    if (!matCache.has(key)) {
        matCache.set(key, glow ? new THREE.MeshBasicMaterial({ color }) : new THREE.MeshLambertMaterial({ color }));
    }
    return matCache.get(key);
}

function box(parent, w, h, d, color, x = 0, y = 0, z = 0, glow = false) {
    const m = new THREE.Mesh(boxGeo, typeof color === 'object' ? color : mat(color, glow));
    m.scale.set(w, h, d);
    m.position.set(x, y, z);
    parent.add(m);
    return m;
}

function group(parent, x = 0, y = 0, z = 0) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    parent.add(g);
    return g;
}

function canvasTexture(w, h, draw) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d');
    draw(ctx, w, h);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.generateMipmaps = false;
    return { tex, ctx };
}

function rng(seed) {
    let s = seed >>> 0;
    return () => {
        s = (s * 1664525 + 1013904223) >>> 0;
        return s / 4294967296;
    };
}
const rand = rng(7);

function plane(parent, w, h, material, x = 0, y = 0, z = 0) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), material);
    m.position.set(x, y, z);
    parent.add(m);
    return m;
}

function neonSign(text, { color, w = 128, h = 32, size = 18, vertical = false, bg = '#14081f' }) {
    const { tex } = canvasTexture(w, h, (g) => {
        g.fillStyle = bg;
        g.fillRect(0, 0, w, h);
        g.strokeStyle = color;
        g.lineWidth = 2;
        g.strokeRect(2, 2, w - 4, h - 4);
        g.fillStyle = '#ffffff';
        g.shadowColor = color;
        g.shadowBlur = 6;
        g.font = `bold ${size}px "Hiragino Sans", "Yu Gothic", Meiryo, sans-serif`;
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        if (vertical) {
            const chars = [...text];
            const step = (h - 8) / chars.length;
            chars.forEach((ch, i) => g.fillText(ch, w / 2, 4 + step * (i + 0.5)));
        } else {
            g.fillText(text, w / 2, h / 2 + 1);
        }
    });
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearFilter;
    return new THREE.MeshBasicMaterial({ map: tex });
}

const smooth = (t) => t * t * (3 - 2 * t);

// ---------- palette ----------
const WALL = 0x241a3d;
const WOOD = 0x6b4128;
const WOOD_DARK = 0x3a2217;
const TABLE_TOP = 1.55;

// ---------- outside: synthwave sky, skyline, street ----------
const sky = canvasTexture(160, 96, (g, w, h) => {
    const grad = g.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#06021a');
    grad.addColorStop(0.35, '#2b0b52');
    grad.addColorStop(0.62, '#8a1f6b');
    grad.addColorStop(0.8, '#ff6a5c');
    grad.addColorStop(1, '#ff9a5c');
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);
    const r = rng(3);
    for (let i = 0; i < 70; i++) {
        g.fillStyle = `rgba(255,255,255,${0.3 + r() * 0.7})`;
        g.fillRect(Math.floor(r() * w), Math.floor(r() * h * 0.45), 1, 1);
    }
    const cx = w * 0.64, cy = h * 0.72, rad = 20;
    const sg = g.createLinearGradient(0, cy - rad, 0, cy + rad);
    sg.addColorStop(0, '#ffe36e');
    sg.addColorStop(1, '#ff3d8b');
    g.fillStyle = sg;
    g.beginPath();
    g.arc(cx, cy, rad, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#9a2470';
    for (let i = 0; i < 6; i++) {
        g.fillRect(cx - rad, cy - 2 + i * 4, rad * 2, 1 + Math.floor(i / 2));
    }
});
const skyMat = new THREE.MeshBasicMaterial({ map: sky.tex, fog: false });
plane(scene, 120, 30, skyMat, 0, 16, -44);

const winTex = canvasTexture(16, 32, (g, w, h) => {
    g.fillStyle = '#120a26';
    g.fillRect(0, 0, w, h);
    const r = rng(11);
    const cols = ['#ff7ac8', '#6fe3ff', '#ffd27a', '#b38cff'];
    for (let y = 1; y < h; y += 3) {
        for (let x = 1; x < w; x += 3) {
            if (r() < 0.32) {
                g.fillStyle = cols[Math.floor(r() * cols.length)];
                g.fillRect(x, y, 1, 1);
            }
        }
    }
}).tex;
winTex.wrapS = winTex.wrapT = THREE.RepeatWrapping;

const antennaLights = [];
for (let i = 0; i < 24; i++) {
    const w = 2 + rand() * 4;
    const h = 4 + rand() * 9;
    const d = 2 + rand() * 3;
    const x = -32 + i * 2.8 + rand() * 1.5;
    const z = -22 - rand() * 12;
    const t = winTex.clone();
    t.repeat.set(w / 2, h / 4);
    t.needsUpdate = true;
    box(scene, w, h, d, new THREE.MeshBasicMaterial({ map: t }), x, h / 2, z);
    if (rand() < 0.35) {
        const tip = box(scene, 0.3, 0.3, 0.3, new THREE.MeshBasicMaterial({ color: 0xff3355 }), x, h + 0.8, z);
        box(scene, 0.08, 1.2, 0.08, 0x2a2340, x, h + 0.2, z);
        antennaLights.push({ tip, phase: rand() * 6 });
    }
}

const street = canvasTexture(64, 64, (g, w, h) => {
    g.fillStyle = '#0c0a18';
    g.fillRect(0, 0, w, h);
    const r = rng(5);
    const cols = ['rgba(255,95,180,', 'rgba(72,226,255,', 'rgba(255,190,110,'];
    for (let i = 0; i < 14; i++) {
        const x = Math.floor(r() * w);
        const c = cols[i % cols.length];
        for (let y = 0; y < h; y++) {
            g.fillStyle = `${c}${0.05 + 0.25 * (1 - y / h) * r()})`;
            g.fillRect(x, y, 1 + Math.floor(r() * 2), 1);
        }
    }
});
street.tex.wrapS = THREE.RepeatWrapping;
street.tex.repeat.set(3, 1);
const streetPlane = plane(scene, 60, 18, new THREE.MeshBasicMaterial({ map: street.tex }), 0, 0.01, -13.2);
streetPlane.rotation.x = -Math.PI / 2;
box(scene, 60, 0.15, 1.2, 0x3a3350, 0, 0.08, -4.9);
box(scene, 60, 0.15, 1.2, 0x3a3350, 0, 0.08, -13.2);

const SHOP_Z = -15.5;
function shop({ x, width, body, awning, signText, signColor, glowColor }) {
    const s = group(scene, x, 0, SHOP_Z);
    box(s, width, 4.8, 3, body, 0, 2.4, 0);
    box(s, width + 0.3, 0.2, 3.2, 0x150d24, 0, 4.85, 0);
    box(s, 0.1, 0.9, 0.1, 0x2a2340, -width / 2 + 1, 5.2, 1.4);
    box(s, 0.1, 0.9, 0.1, 0x2a2340, width / 2 - 1, 5.2, 1.4);
    box(s, width - 0.6, 2.2, 0.05, glowColor, 0, 1.4, 1.53, true);
    for (let i = 0; i < 3; i++) {
        box(s, 0.5, 1.2, 0.06, 0x1a1030, -width / 2 + 1.2 + i * 1.3, 1.1, 1.58);
    }
    box(s, width + 0.4, 0.25, 1.1, awning, 0, 2.75, 1.9);
    for (let i = 0; i < Math.floor(width / 1.2); i++) {
        box(s, 0.5, 0.45, 0.06, i % 2 ? awning : 0xf3e6d8, -width / 2 + 0.6 + i * 1.2, 2.45, 2.42);
    }
    box(s, width - 0.4, 1.2, 0.05, 0x2e2148, 0, 3.75, 1.53);
    for (let i = 0; i < 3; i++) {
        box(s, 0.7, 0.6, 0.05, 0xffd27a, -width / 2 + 1 + i * (width - 2) / 2, 3.75, 1.56, true);
    }
    const sign = plane(s, width - 1.4, 1.0, neonSign(signText, { color: signColor, w: 160, h: 36 }), 0, 5.55, 1.5);
    sign.renderOrder = 1;
    return s;
}

shop({ x: -6.5, width: 7, body: 0x2a1d3d, awning: 0xc23a4a, signText: 'ラーメン 夜', signColor: '#ff4f6a', glowColor: 0xffb36b });
shop({ x: 1.6, width: 7.2, body: 0x1d2a3d, awning: 0x2f6f8f, signText: 'CYBER CAFÉ', signColor: '#48e2ff', glowColor: 0x8fe9ff });
const tokyoSign = plane(scene, 0.9, 3.2, neonSign('東京', { color: '#ff5fb4', w: 32, h: 112, size: 26, vertical: true }), 5.6, 3.6, SHOP_Z + 2.2);
tokyoSign.renderOrder = 1;

const lanternMats = [];
for (const lx of [-9.5, -4.3, -1.2, 4.6, 9]) {
    const m = new THREE.MeshBasicMaterial({ color: 0xff5544 });
    lanternMats.push(m);
    box(scene, 0.45, 0.6, 0.45, m, lx, 3.35, SHOP_Z + 2.6);
    box(scene, 0.5, 0.06, 0.5, 0x2a1d1d, lx, 3.68, SHOP_Z + 2.6);
}

for (const sx of [-11, 8.5]) {
    box(scene, 0.12, 4.6, 0.12, 0x3a3350, sx, 2.3, -12.8);
    box(scene, 0.8, 0.12, 0.12, 0x3a3350, sx + 0.35, 4.55, -12.8);
    box(scene, 0.45, 0.2, 0.3, 0xfff0c8, sx + 0.7, 4.42, -12.8, true);
}

// cherry tree outside the window, a nod to the reference mood
const tree = group(scene, -4.8, 0, -6.6);
box(tree, 0.45, 3.6, 0.45, 0x4a2b20, 0, 1.8, 0);
box(tree, 0.3, 1.6, 0.3, 0x4a2b20, 0.5, 3.6, 0).rotation.z = -0.6;
box(tree, 0.3, 1.4, 0.3, 0x4a2b20, -0.5, 3.5, 0).rotation.z = 0.6;
const blossomCols = [0xf7a8cf, 0xf08dbd, 0xfcc6e0, 0xe877ad];
for (let i = 0; i < 60; i++) {
    const a = rand() * Math.PI * 2;
    const rr = Math.sqrt(rand());
    const bx = Math.cos(a) * rr * 2.6;
    const bz = Math.sin(a) * rr * 1.4;
    const by = 4.3 + (rand() - 0.4) * 1.8 * (1 - rr * 0.4);
    const s = 0.5 + rand() * 0.35;
    box(tree, s, s, s, blossomCols[i % blossomCols.length], bx, by, bz);
}

const drone = group(scene, 3.2, 5.3, -8);
box(drone, 0.7, 0.18, 0.7, 0x2b2f3d);
for (const [px, pz] of [[-0.45, -0.45], [0.45, -0.45], [-0.45, 0.45], [0.45, 0.45]]) {
    box(drone, 0.35, 0.03, 0.08, 0x8a8fa3, px, 0.14, pz);
}
const droneLight = new THREE.MeshBasicMaterial({ color: 0xff3355 });
box(drone, 0.14, 0.1, 0.14, droneLight, 0, -0.12, 0.3);

// rain outside the glass
const RAIN = 900;
const RAIN_TOP = 14;
const rainPos = new Float32Array(RAIN * 6);
const rainSpeed = new Float32Array(RAIN);
for (let i = 0; i < RAIN; i++) {
    const x = -18 + rand() * 36;
    const y = rand() * RAIN_TOP;
    const z = -4.7 - rand() * 14;
    rainPos.set([x, y, z, x + 0.06, y + 0.5, z], i * 6);
    rainSpeed[i] = 10 + rand() * 6;
}
const rainGeo = new THREE.BufferGeometry();
rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
const rain = new THREE.LineSegments(rainGeo, new THREE.LineBasicMaterial({ color: 0xa8c4ff, transparent: true, opacity: 0.5 }));
scene.add(rain);

// ---------- interior shell ----------
box(scene, 6, 7.8, 0.3, WALL, -9.5, 3.9, -4.15);
box(scene, 6, 7.8, 0.3, WALL, 9.5, 3.9, -4.15);
box(scene, 13, 1.5, 0.3, WOOD_DARK, 0, 0.75, -4.15);
box(scene, 13, 1.6, 0.3, WALL, 0, 7.0, -4.15);
box(scene, 0.3, 7.8, 14, WALL, -12.4, 3.9, 2.8);
box(scene, 0.3, 7.8, 14, WALL, 12.4, 3.9, 2.8);
box(scene, 26, 0.3, 14, 0x170f29, 0, 7.85, 2.8);

box(scene, 13.6, 0.25, 0.5, WOOD, 0, 6.25, -4.05);
box(scene, 13.8, 0.2, 0.9, WOOD, 0, 1.5, -3.85);
box(scene, 0.25, 4.75, 0.5, WOOD, -6.6, 3.87, -4.05);
box(scene, 0.25, 4.75, 0.5, WOOD, 6.6, 3.87, -4.05);
box(scene, 0.18, 4.75, 0.4, WOOD, -2.8, 3.87, -4.05);
box(scene, 0.18, 4.75, 0.4, WOOD, 3.6, 3.87, -4.05);

box(scene, 25, 0.06, 0.06, 0xff4fa3, 0, 7.66, -3.9, true);
const coffeeSign = plane(scene, 2.8, 0.75, neonSign('コーヒー', { color: '#48e2ff', w: 128, h: 34, size: 20 }), -9.2, 5.6, -3.98);
coffeeSign.renderOrder = 1;

const glass = canvasTexture(64, 64, (g, w, h) => {
    g.fillStyle = 'rgba(110,140,255,0.07)';
    g.fillRect(0, 0, w, h);
    const r = rng(21);
    for (let i = 0; i < 46; i++) {
        const x = Math.floor(r() * w);
        const y = Math.floor(r() * h);
        g.fillStyle = 'rgba(210,230,255,0.6)';
        g.fillRect(x, y, 1, 2);
        if (r() < 0.35) {
            g.fillStyle = 'rgba(210,230,255,0.22)';
            g.fillRect(x, y - 7, 1, 7);
        }
    }
});
glass.tex.wrapS = glass.tex.wrapT = THREE.RepeatWrapping;
glass.tex.repeat.set(7, 3);
plane(scene, 13, 4.75, new THREE.MeshBasicMaterial({ map: glass.tex, transparent: true, depthWrite: false }), 0, 3.87, -4.02).renderOrder = 2;

const floorTex = canvasTexture(64, 64, (g, w) => {
    for (let i = 0; i < 8; i++) {
        g.fillStyle = i % 2 ? '#3b2418' : '#452a1c';
        g.fillRect(0, i * 8, w, 8);
        g.fillStyle = '#2a170f';
        g.fillRect(0, i * 8 + 7, w, 1);
        g.fillRect((i * 23) % w, i * 8, 1, 8);
    }
}).tex;
floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping;
floorTex.repeat.set(6, 4);
const floor = plane(scene, 25, 14, new THREE.MeshLambertMaterial({ map: floorTex }), 0, 0, 2.8);
floor.rotation.x = -Math.PI / 2;
box(scene, 4.6, 0.02, 3.2, 0x3b1d4f, 1.1, 0.01, -1.5);
box(scene, 4.8, 0.02, 0.1, 0xff4fa3, 1.1, 0.02, 0.1, true);

const shelf = group(scene, -9.2, 0, -3.85);
for (const sy of [3.0, 4.2]) {
    box(shelf, 3, 0.1, 0.5, WOOD, 0, sy, 0);
    let bx = -1.3;
    while (bx < 1.2) {
        const bw = 0.16 + rand() * 0.14;
        const bh = 0.5 + rand() * 0.3;
        box(shelf, bw, bh, 0.38, [0x7a3b5e, 0x2f5d7c, 0xc9a04e, 0x4e7a52, 0x8a3a3a][Math.floor(rand() * 5)], bx + bw / 2, sy + 0.05 + bh / 2, 0);
        bx += bw + 0.02;
    }
}

const pot = group(scene, -2.2, 0, -3.3);
box(pot, 0.6, 0.6, 0.6, 0xb5653a, 0, 0.3, 0);
for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    const leaf = box(pot, 0.18, 0.7 + rand() * 0.5, 0.18, i % 2 ? 0x3f8a4f : 0x58a862, Math.cos(a) * 0.22, 0.95, Math.sin(a) * 0.22);
    leaf.rotation.set(Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5);
}

for (const [lx, lz] of [[-2.4, -2.4], [4.2, -0.4]]) {
    box(scene, 0.03, 1.4, 0.03, 0x111111, lx, 7.0, lz);
    box(scene, 0.5, 0.65, 0.5, 0xff6a4a, lx, 6.0, lz, true);
    box(scene, 0.56, 0.08, 0.56, 0x2a1d1d, lx, 6.35, lz);
}

// ---------- desk setup ----------
box(scene, 3.0, 0.12, 1.8, WOOD, 1.6, TABLE_TOP - 0.06, -1.6);
for (const [lx, lz] of [[0.25, -2.35], [2.95, -2.35], [0.25, -0.85], [2.95, -0.85]]) {
    box(scene, 0.12, TABLE_TOP - 0.12, 0.12, WOOD_DARK, lx, (TABLE_TOP - 0.12) / 2, lz);
}
box(scene, 0.9, 0.12, 0.9, 0x2d2440, -0.35, 1.05, -1.5);
box(scene, 0.14, 1.0, 0.14, 0x8a8fa3, -0.35, 0.5, -1.5);
box(scene, 0.6, 0.06, 0.6, 0x8a8fa3, -0.35, 0.03, -1.5);

const lamp = group(scene, 2.75, TABLE_TOP, -2.2);
box(lamp, 0.4, 0.06, 0.4, 0xb08a3e, 0, 0.03, 0);
box(lamp, 0.06, 0.85, 0.06, 0xb08a3e, 0.1, 0.45, 0).rotation.z = -0.25;
box(lamp, 0.06, 0.6, 0.06, 0xb08a3e, -0.05, 1.0, 0).rotation.z = 1.0;
box(lamp, 0.38, 0.22, 0.32, 0xb08a3e, -0.35, 1.08, 0).rotation.z = 0.35;
box(lamp, 0.2, 0.06, 0.2, 0xffe2a8, -0.38, 0.95, 0, true);
const lampLight = new THREE.PointLight(0xffb070, 9, 6, 1.6);
lampLight.position.set(2.4, TABLE_TOP + 0.85, -2.2);
scene.add(lampLight);

const books = group(scene, 2.55, TABLE_TOP, -0.95);
box(books, 0.7, 0.12, 0.5, 0x2f5d7c, 0, 0.06, 0);
box(books, 0.65, 0.1, 0.46, 0xc9a04e, 0.02, 0.17, 0).rotation.y = 0.15;
box(books, 0.6, 0.1, 0.44, 0x7a3b5e, -0.02, 0.27, 0).rotation.y = -0.1;

// ---------- the man (original blocky character) ----------
const C = {
    skin: 0xa8704f, skinDark: 0x8d5a3d, jacket: 0xf2a9b8, jacketDark: 0xd88d9f, shirt: 0x2e2733,
    pants: 0x1b1b21, shoe: 0xa3a8ae, sole: 0xeceff1, beanie: 0xd9483f, band: 0xf3eee8, hair: 0x1a1210,
};

const man = group(scene, -0.35, 0, -1.5);
man.rotation.y = Math.PI / 2 - 0.25;

for (const s of [-1, 1]) {
    const x = s * 0.24;
    box(man, 0.42, 0.36, 0.95, C.pants, x, 1.3, 0.38);
    box(man, 0.38, 1.0, 0.38, C.pants, x, 0.72, 0.78);
    box(man, 0.42, 0.22, 0.62, C.shoe, x, 0.14, 0.9);
    box(man, 0.44, 0.07, 0.64, C.sole, x, 0.035, 0.9);
}

const torso = group(man, 0, 1.15, 0);
box(torso, 1.0, 1.15, 0.58, C.jacket, 0, 0.6, 0);
box(torso, 0.34, 0.95, 0.02, C.shirt, 0, 0.62, 0.3);
box(torso, 1.02, 0.14, 0.6, C.jacketDark, 0, 0.07, 0);
box(torso, 0.64, 0.14, 0.64, C.jacketDark, 0, 1.15, 0);

const head = group(torso, 0, 1.2, 0);
box(head, 0.28, 0.16, 0.28, C.skinDark, 0, 0.06, 0);
box(head, 0.78, 0.78, 0.78, C.skin, 0, 0.52, 0);
box(head, 0.6, 0.2, 0.02, 0x7e5038, 0, 0.27, 0.392);
box(head, 0.2, 0.04, 0.02, 0x4a2a1a, 0, 0.31, 0.4);
box(head, 0.1, 0.14, 0.08, C.skinDark, 0, 0.47, 0.42);
for (const s of [-1, 1]) {
    box(head, 0.1, 0.12, 0.02, 0x1a1210, s * 0.17, 0.57, 0.4);
    box(head, 0.04, 0.04, 0.02, 0xffffff, s * 0.17 + 0.03, 0.6, 0.405);
    box(head, 0.2, 0.05, 0.02, C.hair, s * 0.17, 0.69, 0.4);
    box(head, 0.06, 0.18, 0.14, C.skinDark, s * 0.41, 0.5, 0);
    box(head, 0.04, 0.2, 0.14, C.hair, s * 0.4, 0.72, 0.14);
}
box(head, 0.8, 0.16, 0.8, C.hair, 0, 0.84, -0.01);
box(head, 0.84, 0.36, 0.84, C.beanie, 0, 1.06, 0);
box(head, 0.86, 0.16, 0.86, C.band, 0, 0.88, 0);
for (let i = 0; i < 4; i++) {
    box(head, 0.08, 0.08, 0.02, C.band, -0.24 + i * 0.16, 1.08 + (i % 2) * 0.08, 0.425);
}

function makeArm(side) {
    const shoulder = group(torso, side * 0.64, 1.0, 0);
    box(shoulder, 0.3, 0.6, 0.32, C.jacket, 0, -0.27, 0);
    const elbow = group(shoulder, 0, -0.55, 0);
    box(elbow, 0.28, 0.52, 0.3, C.jacket, 0, -0.24, 0);
    box(elbow, 0.3, 0.1, 0.32, C.jacketDark, 0, -0.48, 0);
    const hand = group(elbow, 0, -0.62, 0);
    box(hand, 0.22, 0.2, 0.24, C.skin);
    return { shoulder, elbow, hand };
}
const armR = makeArm(-1);
const armL = makeArm(1);

function applyArm(arm, p) {
    arm.shoulder.rotation.set(p.sx, 0, p.sz);
    arm.elbow.rotation.set(p.ex, 0, 0);
}

function lerpPose(a, b, t) {
    return { sx: a.sx + (b.sx - a.sx) * t, sz: a.sz + (b.sz - a.sz) * t, ex: a.ex + (b.ex - a.ex) * t };
}

// brute-force a pose whose hand lands on a world-space target
function solveArm(arm, target) {
    const p = new THREE.Vector3();
    let best = null;
    let bestD = Infinity;
    for (let sx = -2.6; sx <= 0.4; sx += 0.06) {
        for (let ex = -2.6; ex <= 0; ex += 0.06) {
            for (let sz = -0.8; sz <= 0.8; sz += 0.08) {
                arm.shoulder.rotation.set(sx, 0, sz);
                arm.elbow.rotation.set(ex, 0, 0);
                arm.hand.updateWorldMatrix(true, false);
                arm.hand.getWorldPosition(p);
                const d = p.distanceToSquared(target) + 0.002 * sz * sz;
                if (d < bestD) {
                    bestD = d;
                    best = { sx, sz, ex };
                }
            }
        }
    }
    return best;
}

torso.rotation.x = 0.08;
head.rotation.x = 0.08;
man.updateWorldMatrix(true, true);
const toWorld = (x, y, z) => man.localToWorld(new THREE.Vector3(x, y, z));

const KEY_Y = TABLE_TOP + 0.13;
const poseTypeR = solveArm(armR, toWorld(-0.2, KEY_Y, 0.98));
const poseTypeL = solveArm(armL, toWorld(0.2, KEY_Y, 0.98));
const CAN_LOCAL = new THREE.Vector3(-0.62, TABLE_TOP + 0.16, 0.8);
const poseReach = solveArm(armR, toWorld(CAN_LOCAL.x, CAN_LOCAL.y, CAN_LOCAL.z));
head.rotation.x = -0.22;
head.updateWorldMatrix(true, false);
const poseSip = solveArm(armR, head.localToWorld(new THREE.Vector3(-0.05, 0.2, 0.58)));
head.rotation.x = 0.08;
applyArm(armR, poseTypeR);
applyArm(armL, poseTypeL);

// keyboard with rgb underglow, aligned with the man
const keyboard = group(scene);
keyboard.position.copy(toWorld(0, TABLE_TOP, 0.98));
keyboard.rotation.y = man.rotation.y;
box(keyboard, 1.0, 0.06, 0.36, 0x1b1d2a, 0, 0.04, 0);
const keysTex = canvasTexture(25, 9, (g) => {
    g.fillStyle = '#1b1d2a';
    g.fillRect(0, 0, 25, 9);
    for (let y = 1; y < 9; y += 2) {
        for (let x = 1; x < 25; x += 2) {
            g.fillStyle = (x + y) % 6 === 0 ? '#ff7ac8' : '#d7dcef';
            g.fillRect(x, y, 1, 1);
        }
    }
}).tex;
const keysTop = plane(keyboard, 0.96, 0.32, new THREE.MeshLambertMaterial({ map: keysTex }), 0, 0.072, 0);
keysTop.rotation.x = -Math.PI / 2;
const underglow = new THREE.MeshBasicMaterial({ color: 0xff4fa3 });
box(keyboard, 1.04, 0.02, 0.4, underglow, 0, 0.005, 0);

// energy drink (original "VOLT" can)
const can = group(scene);
const canHome = toWorld(CAN_LOCAL.x, CAN_LOCAL.y, CAN_LOCAL.z);
can.position.copy(canHome);
box(can, 0.17, 0.32, 0.17, 0x1fd6c4);
box(can, 0.175, 0.08, 0.175, 0xff4fa3, 0, 0.02, 0);
box(can, 0.06, 0.1, 0.18, 0xffe36e, 0, 0.02, 0);
box(can, 0.15, 0.03, 0.15, 0xc9ced6, 0, 0.175, 0);
const canHomeQuat = can.quaternion.clone();

// monitor angled between the man and the camera
const monitor = group(scene);
monitor.position.copy(toWorld(0.15, TABLE_TOP, 1.8));
monitor.rotation.y = man.rotation.y + Math.PI + 0.75;
box(monitor, 0.5, 0.04, 0.35, 0x22222e, 0, 0.02, 0);
box(monitor, 0.08, 0.55, 0.08, 0x22222e, 0, 0.3, -0.05);
box(monitor, 1.55, 0.95, 0.07, 0x15151f, 0, 1.0, 0);
const CODE_W = 64, CODE_H = 40;
const code = canvasTexture(CODE_W, CODE_H, () => {});
plane(monitor, 1.43, 0.84, new THREE.MeshBasicMaterial({ map: code.tex }), 0, 1.0, 0.04);
const screenLight = new THREE.PointLight(0x7fb8ff, 4, 3.5, 1.6);
screenLight.position.set(0, 1.0, 0.6);
monitor.add(screenLight);

const CODE_COLORS = ['#ff7ac8', '#6fe3ff', '#ffd27a', '#9cff9c', '#c3a6ff', '#8b93b8'];
function newCodeLine() {
    const segs = [];
    let x = 3 + Math.floor(rand() * 4) * 3;
    const n = 1 + Math.floor(rand() * 4);
    for (let i = 0; i < n && x < CODE_W - 6; i++) {
        const len = 2 + Math.floor(rand() * 10);
        segs.push({ x, len: Math.min(len, CODE_W - 3 - x), c: CODE_COLORS[Math.floor(rand() * CODE_COLORS.length)] });
        x += len + 2;
    }
    return segs;
}
const codeLines = Array.from({ length: 11 }, newCodeLine);
let typedPx = 0;
let codeTimer = 0;
function drawCode(cursorOn) {
    const g = code.ctx;
    g.fillStyle = '#0b1020';
    g.fillRect(0, 0, CODE_W, CODE_H);
    g.fillStyle = '#2a2f4a';
    g.fillRect(0, 0, CODE_W, 3);
    g.fillStyle = '#ff5f7a';
    g.fillRect(1, 1, 1, 1);
    g.fillStyle = '#ffd27a';
    g.fillRect(3, 1, 1, 1);
    g.fillStyle = '#7dff9c';
    g.fillRect(5, 1, 1, 1);
    const last = codeLines.length - 1;
    let cursorX = 3;
    codeLines.forEach((line, i) => {
        const y = 5 + i * 3;
        g.fillStyle = '#3a4060';
        g.fillRect(0, y, 1, 1);
        for (const s of line) {
            let len = s.len;
            if (i === last) {
                len = Math.max(0, Math.min(len, typedPx - s.x));
                if (len > 0) cursorX = s.x + len + 1;
            }
            if (len > 0) {
                g.fillStyle = s.c;
                g.fillRect(s.x, y, len, 1);
            }
        }
        if (i === last && cursorOn) {
            g.fillStyle = '#ffffff';
            g.fillRect(cursorX, y - 1, 1, 2);
        }
    });
    code.tex.needsUpdate = true;
}
drawCode(true);

// ---------- robots ----------
const barCounter = group(scene, 5.4, 0, -2.9);
box(barCounter, 2.6, 1.35, 0.9, 0x3a2a4f, 0, 0.675, 0);
box(barCounter, 2.8, 0.1, 1.0, WOOD, 0, 1.4, 0);
box(barCounter, 2.6, 0.06, 0.02, 0xff4fa3, 0, 1.15, 0.46, true);
box(barCounter, 0.6, 0.7, 0.5, 0x9aa3b5, 0.8, 1.8, -0.1);
box(barCounter, 0.1, 0.1, 0.02, 0xff3355, 0.65, 1.95, 0.16, true);
box(barCounter, 0.16, 0.18, 0.16, 0xf3eee8, -0.6, 1.54, 0.1);
box(barCounter, 0.16, 0.18, 0.16, 0xf3eee8, -0.85, 1.54, 0.15);

const barista = group(scene, 5.1, 0, -3.6);
box(barista, 0.9, 1.0, 0.55, 0x8ea2bd, 0, 1.9, 0);
box(barista, 0.22, 0.22, 0.02, 0x48e2ff, 0, 1.95, 0.28, true);
for (const s of [-1, 1]) {
    const arm = box(barista, 0.2, 0.75, 0.2, 0x6f8199, s * 0.58, 1.95, 0.25);
    arm.rotation.x = -0.9;
}
box(barista, 0.2, 0.24, 0.2, 0xf3eee8, 0, 1.75, 0.68);
const baristaHead = group(barista, 0, 2.42, 0);
box(baristaHead, 0.75, 0.6, 0.6, 0xc5d0e0, 0, 0.3, 0);
box(baristaHead, 0.6, 0.16, 0.02, 0x48e2ff, 0, 0.32, 0.31, true);
box(baristaHead, 0.04, 0.3, 0.04, 0x8ea2bd, 0, 0.75, 0);
const baristaTip = new THREE.MeshBasicMaterial({ color: 0xff3355 });
box(baristaHead, 0.1, 0.1, 0.1, baristaTip, 0, 0.92, 0);

const sideTable = group(scene, -3.6, 0, -2.3);
box(sideTable, 1.1, 0.08, 1.1, WOOD, 0, 1.25, 0);
box(sideTable, 0.12, 1.2, 0.12, WOOD_DARK, 0, 0.6, 0);
box(sideTable, 0.14, 0.16, 0.14, 0xf3eee8, 0.25, 1.37, 0.2);

const patron = group(scene, -4.5, 0, -2.0);
patron.rotation.y = 0.9;
box(patron, 0.7, 0.1, 0.7, 0x2d2440, 0, 0.9, 0);
box(patron, 0.14, 0.9, 0.14, 0x8a8fa3, 0, 0.45, 0);
box(patron, 0.8, 0.85, 0.55, 0xe9a23b, 0, 1.4, 0);
box(patron, 0.5, 0.3, 0.02, 0x2b2f3d, 0, 1.45, 0.28);
for (const s of [-1, 1]) {
    box(patron, 0.22, 0.25, 0.5, 0x7a5520, s * 0.22, 1.05, 0.3);
    box(patron, 0.18, 0.6, 0.18, 0xc98b2e, s * 0.5, 1.4, 0.15).rotation.x = -0.7;
}
const patronHead = group(patron, 0, 1.85, 0);
box(patronHead, 0.7, 0.55, 0.55, 0xf0b552, 0, 0.27, 0);
const patronEye = new THREE.MeshBasicMaterial({ color: 0x7dff9c });
const patronEyes = [-1, 1].map((s) => box(patronHead, 0.12, 0.12, 0.02, patronEye, s * 0.16, 0.3, 0.28));
box(patronHead, 0.06, 0.2, 0.06, 0x7a5520, 0.2, 0.62, 0);

const cleaner = group(scene, 0, 0, 1.6);
box(cleaner, 0.7, 0.18, 0.7, 0xdfe5ee, 0, 0.12, 0);
box(cleaner, 0.72, 0.04, 0.72, 0x48e2ff, 0, 0.05, 0, true);
box(cleaner, 0.14, 0.06, 0.02, 0x2b2f3d, 0, 0.14, 0.36);
box(cleaner, 0.12, 0.04, 0.02, 0x7dff9c, 0, 0.15, 0.37, true);

// ---------- lights ----------
scene.add(new THREE.AmbientLight(0x6a58a0, 1.1));
scene.add(new THREE.HemisphereLight(0xff8ad0, 0x1a1030, 0.9));
const pinkLight = new THREE.PointLight(0xff4fa3, 30, 16, 1.6);
pinkLight.position.set(-3.5, 4.2, -4.6);
scene.add(pinkLight);
const cyanLight = new THREE.PointLight(0x48e2ff, 24, 16, 1.6);
cyanLight.position.set(4.5, 3.6, -4.6);
scene.add(cyanLight);
const fill = new THREE.DirectionalLight(0xc8b8ff, 0.6);
fill.position.set(2, 6, 8);
scene.add(fill);

// ---------- camera framing ----------
const target = new THREE.Vector3();
const VIEW_DIR = new THREE.Vector3(-0.05, 0.12, 1).normalize();
let camDist = 9;
const parallax = { x: 0, y: 0, tx: 0, ty: 0 };

function frameCamera(aspect) {
    const tanH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const portrait = aspect < 1;
    const halfW = portrait ? 2.8 : 6.6;
    const halfH = portrait ? 3.6 : 3.5;
    camDist = Math.min(17, Math.max(halfH / tanH, halfW / (tanH * aspect)));
    if (portrait) target.set(0.7, 3.2, -1.5);
    else target.set(0.8, 3.4, -1.6);
}

function placeCamera() {
    camera.position.copy(target).addScaledVector(VIEW_DIR, camDist);
    camera.position.x += parallax.x * 0.6;
    camera.position.y += parallax.y * 0.35;
    camera.lookAt(target);
}

function resize() {
    const w = stage.clientWidth;
    const h = stage.clientHeight;
    const pix = Math.max(2, Math.round(Math.min(w, h * 1.5) / 380));
    renderer.setSize(Math.ceil(w / pix), Math.ceil(h / pix), false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    frameCamera(camera.aspect);
}
window.addEventListener('resize', resize);
resize();

window.addEventListener('pointermove', (e) => {
    parallax.tx = e.clientX / window.innerWidth - 0.5;
    parallax.ty = -(e.clientY / window.innerHeight - 0.5);
});

// ---------- interaction: the man is clickable too ----------
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
function pointerHitsMan(e) {
    const r = renderer.domElement.getBoundingClientRect();
    pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    return raycaster.intersectObject(man, true).length > 0;
}
renderer.domElement.addEventListener('pointermove', (e) => {
    document.body.classList.toggle('hover-man', pointerHitsMan(e));
});
renderer.domElement.addEventListener('click', (e) => {
    if (pointerHitsMan(e)) window.open(RESUME_URL, '_blank', 'noopener');
});

const bubbleAnchor = new THREE.Vector3();
function updateBubble() {
    head.localToWorld(bubbleAnchor.set(0, 1.65, 0));
    bubbleAnchor.project(camera);
    const x = (bubbleAnchor.x * 0.5 + 0.5) * stage.clientWidth;
    const y = (-bubbleAnchor.y * 0.5 + 0.5) * stage.clientHeight;
    bubble.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-32%, -100%)`;
    bubble.classList.add('ready');
}

// ---------- animation ----------
const CYCLE = 10;
let canHeld = false;
const clock = new THREE.Clock();

function typingJitter(arm, base, t, phase, amount) {
    applyArm(arm, {
        sx: base.sx + Math.cos(t * 14 + phase) * 0.025 * amount,
        sz: base.sz,
        ex: base.ex + Math.sin(t * 22 + phase) * 0.07 * amount,
    });
}

function animateMan(t) {
    const tc = t % CYCLE;
    torso.scale.y = 1 + Math.sin(t * 1.6) * 0.01;
    let headTilt = 0.08 + Math.sin(t * 3) * 0.015;
    let typing = 1;

    typingJitter(armL, poseTypeL, t, 1.7, tc > 6.4 && tc < 9.6 ? 0.4 : 1);

    if (tc < 6.4 || tc >= 9.7) {
        typingJitter(armR, poseTypeR, t, 0, 1);
    } else if (tc < 7.0) {
        applyArm(armR, lerpPose(poseTypeR, poseReach, smooth((tc - 6.4) / 0.6)));
        typing = 0;
    } else if (tc < 9.1) {
        if (!canHeld) {
            armR.hand.add(can);
            can.position.set(0, 0.04, 0.12);
            can.rotation.set(0, 0, 0);
            canHeld = true;
        }
        let k;
        if (tc < 7.7) k = smooth((tc - 7.0) / 0.7);
        else if (tc < 8.5) k = 1;
        else k = 1 - smooth((tc - 8.5) / 0.6);
        const pose = lerpPose(poseReach, poseSip, k);
        pose.ex += k === 1 ? Math.sin(t * 6) * 0.02 : 0;
        applyArm(armR, pose);
        armR.hand.rotation.x = -0.7 * k;
        headTilt = 0.08 + (-0.3 - 0.08) * k;
        typing = 0;
    } else {
        if (canHeld) {
            scene.add(can);
            can.position.copy(canHome);
            can.quaternion.copy(canHomeQuat);
            armR.hand.rotation.x = 0;
            canHeld = false;
        }
        applyArm(armR, lerpPose(poseReach, poseTypeR, smooth((tc - 9.1) / 0.6)));
        typing = 0;
    }
    head.rotation.x = headTilt;
    head.rotation.y = Math.sin(t * 0.4) * 0.05;
    return typing;
}

function animateWorld(t, dt, typing) {
    const pos = rainGeo.attributes.position.array;
    for (let i = 0; i < RAIN; i++) {
        const o = i * 6;
        let y = pos[o + 1] - rainSpeed[i] * dt;
        if (y < -0.5) y += RAIN_TOP + 0.5;
        pos[o + 1] = y;
        pos[o + 4] = y + 0.5;
    }
    rainGeo.attributes.position.needsUpdate = true;
    glass.tex.offset.y += dt * 0.03;

    codeTimer += dt;
    if (codeTimer > 0.09) {
        codeTimer = 0;
        if (typing) {
            typedPx += 1;
            const last = codeLines[codeLines.length - 1];
            const end = last.length ? last[last.length - 1].x + last[last.length - 1].len : 0;
            if (typedPx > end + 3) {
                codeLines.shift();
                codeLines.push(newCodeLine());
                typedPx = 0;
            }
        }
        drawCode(Math.floor(t * 2) % 2 === 0);
    }

    underglow.color.setHSL((t * 0.08) % 1, 0.9, 0.6);
    baristaHead.rotation.y = Math.sin(t * 0.5) * 0.45;
    barista.position.y = Math.sin(t * 2) * 0.03;
    baristaTip.color.setHex(Math.floor(t * 1.5) % 2 ? 0xff3355 : 0x55121c);

    const blink = (t % 4.2) < 0.12 ? 0.15 : 1;
    patronEyes.forEach((e) => { e.scale.y = 0.12 * blink; });
    patronHead.rotation.z = Math.sin(t * 0.7) * 0.12;

    const cx = Math.sin(t * 0.22) * 4.4;
    const dir = Math.cos(t * 0.22) >= 0 ? 1 : -1;
    cleaner.position.x = cx;
    cleaner.rotation.y = dir > 0 ? Math.PI / 2 : -Math.PI / 2;

    drone.position.y = 5.3 + Math.sin(t * 1.3) * 0.18;
    drone.position.x = 3.2 + Math.sin(t * 0.35) * 0.8;
    droneLight.color.setHex(Math.floor(t * 2.2) % 2 ? 0xff3355 : 0x3a0c14);

    antennaLights.forEach(({ tip, phase }) => {
        tip.material.color.setHex(Math.sin(t * 2 + phase) > 0.6 ? 0xff3355 : 0x400d18);
    });
    lanternMats.forEach((m, i) => m.color.setHSL(0.02, 1, 0.55 + Math.sin(t * 1.5 + i) * 0.06));
    lampLight.intensity = 9 + Math.sin(t * 9) * 0.25;
}

function loop() {
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;
    parallax.x += (parallax.tx - parallax.x) * 0.05;
    parallax.y += (parallax.ty - parallax.y) * 0.05;
    const typing = animateMan(t);
    animateWorld(t, dt, typing);
    placeCamera();
    renderer.render(scene, camera);
    updateBubble();
}

renderer.setAnimationLoop(loop);
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        renderer.setAnimationLoop(null);
    } else {
        clock.getDelta();
        renderer.setAnimationLoop(loop);
    }
});
