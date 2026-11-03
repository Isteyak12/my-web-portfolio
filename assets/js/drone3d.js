import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const $ = (id) => document.getElementById(id);
const host = $('scene');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const BEST_KEY = 'portal-flight-best';
const SOUND_KEY = 'portal-flight-sound';

const store = {
    get(key) { try { return localStorage.getItem(key); } catch (_) { return null; } },
    set(key, value) { try { localStorage.setItem(key, value); } catch (_) { /* storage unavailable */ } },
};

let renderer;
try {
    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
} catch (err) {
    $('fallback').hidden = false;
    $('start-panel').hidden = true;
    throw err;
}
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
host.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 6000);

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const rand = (a, b) => a + Math.random() * (b - a);

// ---------- night sky ----------
// An original night-time seaside corniche, loosely inspired by Gulf/Red Sea waterfronts.
// Everything here is procedural: no real landmarks, logos or photo textures.
const TILE = 1000;
const OFFSETS = [-TILE, 0, TILE];
const seeded = (seed) => { let v = seed >>> 0; return () => { v = (v * 1664525 + 1013904223) >>> 0; return v / 4294967296; }; };
const srand = seeded(1337);
const sr = (a, b) => a + srand() * (b - a);
const hdr = (hex, k) => new THREE.Color(hex).multiplyScalar(k);

function canvasTex(w, h, draw, repeat = false) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 4;
    return t;
}

scene.background = new THREE.Color(0x061a22);
scene.fog = new THREE.Fog(0x103338, 120, 950);

const skyGroup = new THREE.Group();
scene.add(skyGroup);
const dome = new THREE.Mesh(
    new THREE.SphereGeometry(4000, 32, 16),
    new THREE.MeshBasicMaterial({
        side: THREE.BackSide, fog: false, depthWrite: false,
        map: canvasTex(4, 256, (g, w, h) => {
            const grad = g.createLinearGradient(0, 0, 0, h);
            grad.addColorStop(0, '#03101a');
            grad.addColorStop(0.3, '#08202e');
            grad.addColorStop(0.46, '#17384a');
            grad.addColorStop(0.5, '#6a3a2a');
            grad.addColorStop(0.53, '#173a40');
            grad.addColorStop(0.6, '#0a2228');
            grad.addColorStop(1, '#04120f');
            g.fillStyle = grad;
            g.fillRect(0, 0, w, h);
        }),
    }),
);
skyGroup.add(dome);

const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(scene, 0, 0.1, 10000).texture;

(() => {
    const n = 1400;
    const pos = new Float32Array(n * 3);
    const col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(0.15 + Math.random() * 0.85);
        const r = 3000;
        pos.set([r * Math.sin(phi) * Math.cos(theta), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(theta)], i * 3);
        const b = 0.5 + Math.random() * 0.8;
        col.set([b, b, b * (0.9 + Math.random() * 0.2)], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    skyGroup.add(new THREE.Points(g, new THREE.PointsMaterial({ size: 1.6, sizeAttenuation: false, vertexColors: true, fog: false, depthWrite: false })));

    const moon = new THREE.Mesh(new THREE.SphereGeometry(42, 32, 16), new THREE.MeshBasicMaterial({ color: hdr(0xf3f0e6, 1.4), fog: false }));
    moon.position.set(-1100, 900, -2600);
    skyGroup.add(moon);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({
        map: canvasTex(128, 128, (c) => {
            const grad = c.createRadialGradient(64, 64, 10, 64, 64, 64);
            grad.addColorStop(0, 'rgba(220,230,255,0.3)');
            grad.addColorStop(1, 'rgba(220,230,255,0)');
            c.fillStyle = grad;
            c.fillRect(0, 0, 128, 128);
        }),
        transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending,
    }));
    halo.scale.setScalar(300);
    halo.position.copy(moon.position);
    skyGroup.add(halo);

    // distant shoreline lights across the bay, always out near the horizon
    const m = 2600;
    const hp = new Float32Array(m * 3);
    const hc = new Float32Array(m * 3);
    for (let i = 0; i < m; i++) {
        const far = Math.random() < 0.5;
        const x = far ? -2400 + Math.random() * 4800 : -2400 + Math.random() * 1900;
        const z = far ? -1500 - Math.random() * 500 : -300 - Math.random() * 1400;
        const tall = Math.random() < 0.08;
        hp.set([x, Math.random() * (tall ? 60 : 8), z], i * 3);
        const warm = Math.random() < 0.65;
        const k = 1.2 + Math.random() * 2.2;
        hc.set(warm ? [1 * k, 0.55 * k, 0.25 * k] : [1 * k, 0.78 * k, 0.5 * k], i * 3);
    }
    const hg = new THREE.BufferGeometry();
    hg.setAttribute('position', new THREE.BufferAttribute(hp, 3));
    hg.setAttribute('color', new THREE.BufferAttribute(hc, 3));
    skyGroup.add(new THREE.Points(hg, new THREE.PointsMaterial({ size: 2.2, sizeAttenuation: false, vertexColors: true, fog: false, depthWrite: false })));
})();

const moonLight = new THREE.DirectionalLight(0xb4c6ff, 0.9);
scene.add(moonLight, moonLight.target);
scene.add(new THREE.HemisphereLight(0x3f6f8a, 0x6a3a1e, 1.1));
// soft fill from behind the camera so the drone still reads clearly at night
const fillLight = new THREE.DirectionalLight(0xc9dcff, 0.9);
scene.add(fillLight, fillLight.target);
// warm bounce from the city lights below
const droneGlow = new THREE.PointLight(0xff9a50, 5, 12, 2);
scene.add(droneGlow);

// ---------- corniche world (one 1000-unit tile, repeated so it can follow the drone) ----------
const world = new THREE.Group();
scene.add(world);

const radialTex = (rgb) => canvasTex(64, 64, (g) => {
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, `rgba(${rgb},1)`);
    grad.addColorStop(0.35, `rgba(${rgb},0.45)`);
    grad.addColorStop(1, `rgba(${rgb},0)`);
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
});
const streakTex = canvasTex(16, 128, (g) => {
    const v = g.createLinearGradient(0, 0, 0, 128);
    v.addColorStop(0, 'rgba(255,255,255,0)');
    v.addColorStop(0.5, 'rgba(255,255,255,1)');
    v.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = v;
    g.fillRect(0, 0, 16, 128);
    const hgrad = g.createLinearGradient(0, 0, 16, 0);
    hgrad.addColorStop(0, 'rgba(0,0,0,1)');
    hgrad.addColorStop(0.5, 'rgba(0,0,0,0)');
    hgrad.addColorStop(1, 'rgba(0,0,0,1)');
    g.globalCompositeOperation = 'destination-out';
    g.fillStyle = hgrad;
    g.fillRect(0, 0, 16, 128);
});
const glowMat = (tex, color, opacity) => new THREE.MeshBasicMaterial({
    map: tex, color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, fog: true,
});
const warmPool = radialTex('255,130,60');
const whitePool = radialTex('255,160,80');

const tmpQ = new THREE.Quaternion();
const tmpE = new THREE.Euler();
const tmpP = new THREE.Vector3();
const tmpS = new THREE.Vector3();
function mat4(x, y, z, sx = 1, sy = 1, sz = 1, rx = 0, ry = 0, rz = 0) {
    tmpQ.setFromEuler(tmpE.set(rx, ry, rz));
    return new THREE.Matrix4().compose(tmpP.set(x, y, z), tmpQ, tmpS.set(sx, sy, sz));
}
// build a base list once, then repeat it in every tile so snapping the world never pops
function along(step, fn) {
    const base = [];
    for (let z = -TILE / 2; z < TILE / 2; z += step) {
        const r = fn(z);
        if (r) base.push(...(Array.isArray(r) ? r : [r]));
    }
    const out = [];
    OFFSETS.forEach((off) => base.forEach((m) => {
        const c = m.clone();
        c.elements[14] += off;
        out.push(c);
    }));
    return out;
}
function instanced(geo, material, matrices) {
    const mesh = new THREE.InstancedMesh(geo, material, matrices.length);
    matrices.forEach((m, i) => mesh.setMatrixAt(i, m));
    mesh.instanceMatrix.needsUpdate = true;
    world.add(mesh);
    return mesh;
}
function strip(x0, x1, y, color, extra = {}) {
    const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(x1 - x0, TILE * 3),
        new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0, ...extra }),
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set((x0 + x1) / 2, y, 0);
    world.add(mesh);
    return mesh;
}

// layout across x:  sea < -12 | rocks | promenade -10..2 | garden 2..6 | road 6..26 | sidewalk | city 30+
// one matte sea that fades from turquoise shallows at the shore (u = 1) to deep teal offshore.
// Matte on purpose: a glossy surface mirrors the moon and sky at this low angle and washes the teal out.
const seaGlow = canvasTex(1024, 1, (g, w) => {
    const grad = g.createLinearGradient(0, 0, w, 0);
    grad.addColorStop(0, '#0a3d38');
    grad.addColorStop(0.94, '#0c4f48');
    grad.addColorStop(0.975, '#11695e');
    grad.addColorStop(1, '#1a8c7a');
    g.fillStyle = grad;
    g.fillRect(0, 0, w, 1);
});
strip(-1800, -12, -0.6, 0x000000).material = new THREE.MeshLambertMaterial({ color: 0x0a2a28, emissive: 0xffffff, emissiveMap: seaGlow, emissiveIntensity: 0.32 });
strip(-12, 1200, -0.05, 0x17191e);
const pavingTex = canvasTex(64, 64, (g) => {
    g.fillStyle = '#8f7f68';
    g.fillRect(0, 0, 64, 64);
    g.strokeStyle = 'rgba(60,45,30,0.35)';
    g.lineWidth = 2;
    for (let i = 0; i <= 64; i += 16) {
        g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 64); g.stroke();
        g.beginPath(); g.moveTo(0, i); g.lineTo(64, i); g.stroke();
    }
}, true);
pavingTex.repeat.set(3, 750);
strip(-10, 2, 0.12, 0xffffff, { map: pavingTex, emissive: 0x211810, roughness: 0.8 });
const muralTex = canvasTex(32, 256, (g) => {
    const cols = ['#b98a4f', '#5f8f99', '#a8615d', '#7a9a64', '#c2a95f', '#857399'];
    for (let y = 0; y < 256; y += 16) {
        g.fillStyle = cols[(y / 16) % cols.length];
        g.fillRect(0, y, 32, 16);
        g.fillStyle = 'rgba(255,255,255,0.35)';
        g.fillRect(4 + ((y / 16) % 3) * 8, y + 4, 8, 8);
    }
}, true);
muralTex.repeat.set(1, 120);
strip(-0.6, 1.4, 0.14, 0xffffff, { map: muralTex, emissive: 0x231a12, emissiveMap: muralTex, emissiveIntensity: 0.35 });
strip(2, 6, 0.1, 0x1b3a1d, { roughness: 1 });
strip(6, 26, 0.06, 0x121419, { roughness: 0.6, metalness: 0.2 });
strip(15, 17, 0.25, 0x2a2b30);
strip(26, 30, 0.12, 0x3a3b42);

// seawall boulders
instanced(new THREE.DodecahedronGeometry(1, 0), new THREE.MeshStandardMaterial({ color: 0x2d2e33, roughness: 1, flatShading: true }),
    along(1.4, () => {
        const s = sr(0.6, 1.3);
        return mat4(-11.2 + sr(-0.9, 0.9), -0.3 + sr(0, 0.5), 0, s, s * sr(0.6, 1), s, sr(0, 3), sr(0, 3), sr(0, 3));
    }));

// lamp posts: promenade (both edges), median double arms, far sidewalk
const poleGeo = new THREE.CylinderGeometry(0.06, 0.09, 1, 6);
poleGeo.translate(0, 0.5, 0);
const poleMat = new THREE.MeshStandardMaterial({ color: 0x1c1d22, metalness: 0.7, roughness: 0.4 });
const bulbGeo = new THREE.SphereGeometry(1, 8, 6);
const poolGeo = new THREE.PlaneGeometry(1, 1);
poolGeo.rotateX(-Math.PI / 2);
const lampSpots = [];
const lampBase = [];
for (let z = -TILE / 2; z < TILE / 2; z += 10) {
    lampBase.push({ x: -9.4, z, h: 4.2, bulb: 0.24, warm: true, pool: 8 });
    lampBase.push({ x: 1.6, z: z + 5, h: 4.2, bulb: 0.24, warm: true, pool: 8 });
}
for (let z = -TILE / 2; z < TILE / 2; z += 24) {
    lampBase.push({ x: 16, z, h: 9.5, bulb: 0, warm: false, pool: 0, median: true });
    lampBase.push({ x: 28, z: z + 12, h: 8, bulb: 0.3, warm: false, pool: 11, offsetX: -1.6 });
}
OFFSETS.forEach((off) => lampBase.forEach((l) => lampSpots.push({ ...l, z: l.z + off })));

instanced(poleGeo, poleMat, lampSpots.map((l) => mat4(l.x, 0, l.z, 1, l.h, 1)));
const bulbWarm = new THREE.MeshBasicMaterial({ color: hdr(0xff8a3d, 4) });
const bulbWhite = new THREE.MeshBasicMaterial({ color: hdr(0xffa050, 4.5) });
instanced(bulbGeo, bulbWarm, lampSpots.filter((l) => l.warm).map((l) => mat4(l.x, l.h + 0.15, l.z, l.bulb, l.bulb, l.bulb)));
const medianBulbs = [];
const roadPools = [];
lampSpots.filter((l) => l.median).forEach((l) => {
    medianBulbs.push(mat4(l.x - 1.8, l.h - 0.2, l.z, 0.32, 0.2, 0.32), mat4(l.x + 1.8, l.h - 0.2, l.z, 0.32, 0.2, 0.32));
    roadPools.push(mat4(l.x - 4.5, 0.09, l.z, 12, 1, 12), mat4(l.x + 4.5, 0.09, l.z, 12, 1, 12));
});
lampSpots.filter((l) => !l.warm && !l.median).forEach((l) => {
    medianBulbs.push(mat4(l.x + l.offsetX, l.h - 0.2, l.z, 0.3, 0.2, 0.3));
    roadPools.push(mat4(l.x - 3, 0.15, l.z, l.pool, 1, l.pool));
});
instanced(bulbGeo, bulbWhite, medianBulbs);
instanced(new THREE.BoxGeometry(3.8, 0.12, 0.12), poleMat, lampSpots.filter((l) => l.median).map((l) => mat4(l.x, l.h - 0.05, l.z)));
instanced(poolGeo, glowMat(warmPool, 0xffffff, 0.4), lampSpots.filter((l) => l.warm).map((l) => mat4(l.x, 0.16, l.z, l.pool, 1, l.pool)));
instanced(poolGeo, glowMat(whitePool, 0xffffff, 0.22), roadPools);

// light streaks reflected on the water below the seaside lamps
const waterStreaks = instanced(
    new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
    glowMat(streakTex, hdr(0xff7a3a, 1.5), 0.55),
    lampSpots.filter((l) => l.x === -9.4).map((l) => mat4(-13.5 - (Math.abs(l.z) % 3), -0.55, l.z + 3, 0.9, 1, 15)),
);

// palms: promenade rows and the road median
const trunkGeo = new THREE.CylinderGeometry(0.15, 0.26, 8, 7);
trunkGeo.translate(0, 4, 0);
const crownGeo = (() => {
    const leaves = [];
    for (let i = 0; i < 9; i++) {
        const leaf = new THREE.BoxGeometry(0.34, 0.05, 3);
        leaf.translate(0, 0, 1.5);
        leaf.rotateX(0.45 + (i % 2) * 0.25);
        leaf.rotateY((i / 9) * Math.PI * 2);
        leaves.push(leaf);
    }
    const merged = mergeGeometries(leaves);
    merged.translate(0, 8, 0);
    return merged;
})();
const palmBase = [];
for (let z = -TILE / 2; z < TILE / 2; z += 12) {
    palmBase.push({ x: -6.6, z, s: sr(0.85, 1.15), lean: sr(-0.08, 0.08), ry: sr(0, 6) });
    palmBase.push({ x: -2.6, z: z + 6, s: sr(0.85, 1.15), lean: sr(-0.08, 0.08), ry: sr(0, 6) });
    palmBase.push({ x: 16, z: z + 3, s: sr(0.95, 1.2), lean: sr(-0.05, 0.05), ry: sr(0, 6) });
}
const palms = [];
OFFSETS.forEach((off) => palmBase.forEach((p) => palms.push(mat4(p.x, 0, p.z + off, p.s, p.s, p.s, p.lean, p.ry, p.lean * 0.6))));
const tealUp = radialTex('60,220,210');
const violetUp = radialTex('170,110,255');
const upTeal = [];
const upViolet = [];
OFFSETS.forEach((off) => palmBase.forEach((p, i) => {
    (i % 2 ? upViolet : upTeal).push(mat4(p.x, 0.18, p.z + off, 5, 1, 5));
}));
instanced(poolGeo, glowMat(tealUp, 0xffffff, 0.55), upTeal);
instanced(poolGeo, glowMat(violetUp, 0xffffff, 0.5), upViolet);
instanced(trunkGeo, new THREE.MeshStandardMaterial({ color: 0x7a6142, emissive: 0x24170b, roughness: 0.9 }), palms);
instanced(crownGeo, new THREE.MeshStandardMaterial({ color: 0x3f5f30, emissive: 0x0a1407, roughness: 0.85 }), palms);

// garden shrubs
instanced(new THREE.IcosahedronGeometry(1, 0), new THREE.MeshStandardMaterial({ color: 0x1f4a22, emissive: 0x0a1608, roughness: 1, flatShading: true }),
    along(3, (z) => mat4(sr(2.8, 5.2), 0.5, z + sr(-1, 1), sr(0.6, 1.1), sr(0.5, 0.9), sr(0.6, 1.1), 0, sr(0, 3))));

// lane dashes
instanced(new THREE.BoxGeometry(0.15, 0.02, 2.2), new THREE.MeshBasicMaterial({ color: hdr(0xd8d8d0, 0.6) }),
    along(7, (z) => [9.3, 11.9, 19.8, 22.4].map((x) => mat4(x, 0.08, z))));

// traffic: long-exposure light streaks, headlights toward the camera, taillights away
const CAR_LANES = [
    { x: 8.2, dir: 1, color: hdr(0xfff1d6, 2.2) }, { x: 10.6, dir: 1, color: hdr(0xfff1d6, 2.2) }, { x: 13.2, dir: 1, color: hdr(0xffe6b8, 2) },
    { x: 18.6, dir: -1, color: hdr(0xff2a1c, 2.6) }, { x: 21.1, dir: -1, color: hdr(0xff3a22, 2.6) }, { x: 23.6, dir: -1, color: hdr(0xff2a1c, 2.4) },
];
const cars = [];
CAR_LANES.forEach((lane) => {
    for (let i = 0; i < 26; i++) cars.push({ lane, base: srand() * TILE, speed: sr(14, 24), len: sr(2.5, 6) });
});
const carMeshes = CAR_LANES.map((lane) => {
    const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.9, 0.18, 1), new THREE.MeshBasicMaterial({ color: lane.color }), 26 * OFFSETS.length);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    world.add(mesh);
    return mesh;
});
const carMatrix = new THREE.Matrix4();
function updateTraffic(t) {
    CAR_LANES.forEach((lane, li) => {
        const mesh = carMeshes[li];
        let idx = 0;
        cars.filter((c) => c.lane === lane).forEach((c) => {
            const travel = ((((c.base + lane.dir * c.speed * t) % TILE) + TILE) % TILE) - TILE / 2;
            OFFSETS.forEach((off) => {
                carMatrix.compose(tmpP.set(lane.x, 0.55, travel + off), tmpQ.identity(), tmpS.set(1, 1, c.len));
                mesh.setMatrixAt(idx++, carMatrix);
            });
        });
        mesh.instanceMatrix.needsUpdate = true;
    });
}

// city blocks: real-scale facades (4 bays x 6 floors per texture repeat), walls lit by the scene, only windows glow
const FACADE_U = 16;
const FACADE_V = 21;
function facadeTextures(style, seed) {
    const rnd = seeded(seed);
    const S = 256;
    const bays = 4;
    const floors = 6;
    const bw = S / bays;
    const fh = S / floors;
    const mk = (draw) => {
        const t = canvasTex(S, S, draw, true);
        t.anisotropy = 8;
        return t;
    };
    const lit = [];
    for (let f = 0; f < floors; f++) {
        const floorLit = rnd() < style.floorLit;
        lit.push(Array.from({ length: bays }, () => (style.glass ? floorLit && rnd() < 0.85 : rnd() < style.lit)));
    }
    const warmth = Array.from({ length: floors * bays }, () => style.windowColors[Math.floor(rnd() * style.windowColors.length)]);
    const dimness = Array.from({ length: floors * bays }, () => 0.55 + rnd() * 0.45);

    const map = mk((g) => {
        g.fillStyle = style.wall;
        g.fillRect(0, 0, S, S);
        for (let f = 0; f < floors; f++) {
            const y = f * fh;
            g.fillStyle = style.slab;
            g.fillRect(0, y, S, style.glass ? 3 : 4);
            for (let b = 0; b < bays; b++) {
                const x = b * bw;
                if (style.glass) {
                    g.fillStyle = style.mullion;
                    g.fillRect(x, y, 2, fh);
                    g.fillRect(x + bw / 2, y, 1, fh);
                } else {
                    const wx = x + bw * 0.2;
                    const wy = y + fh * 0.24;
                    const ww = bw * 0.6;
                    const wh = fh * 0.56;
                    g.fillStyle = style.frame;
                    g.fillRect(wx - 2, wy - 2, ww + 4, wh + 4);
                    g.fillStyle = style.recess;
                    g.fillRect(wx, wy, ww, wh);
                    g.fillStyle = style.frame;
                    g.fillRect(wx + ww / 2 - 1, wy, 2, wh);
                    if (style.balcony && f % 2 === 0) {
                        g.fillStyle = style.slab;
                        g.fillRect(wx - 4, wy + wh, ww + 8, 3);
                    }
                }
            }
        }
        // keep the corner pixel plain so roofs sample bare wall
        g.fillStyle = style.wall;
        g.fillRect(0, S - 2, 2, 2);
    });

    const emissive = mk((g) => {
        g.fillStyle = style.wallGlow;
        g.fillRect(0, 0, S, S);
        for (let f = 0; f < floors; f++) {
            for (let b = 0; b < bays; b++) {
                if (!lit[f][b]) continue;
                const i = f * bays + b;
                const x = b * bw;
                const y = f * fh;
                g.globalAlpha = dimness[i];
                g.fillStyle = warmth[i];
                if (style.glass) {
                    g.fillRect(x + 2, y + 4, bw - 2, fh - 6);
                } else {
                    const wx = x + bw * 0.2;
                    const wy = y + fh * 0.24;
                    const ww = bw * 0.6;
                    const wh = fh * 0.56;
                    g.fillRect(wx, wy, ww, wh);
                    // a drawn curtain on some windows
                    if (dimness[i] < 0.7) {
                        g.fillStyle = 'rgba(0,0,0,0.55)';
                        g.fillRect(wx, wy, ww * 0.45, wh);
                    }
                }
                g.globalAlpha = 1;
            }
        }
        g.fillStyle = style.wallGlow;
        g.fillRect(0, S - 2, 2, 2);
    });
    return { map, emissive };
}

const STYLES = {
    sandstone: {
        wall: '#d2a878', slab: '#b08658', frame: '#ecd2ad', recess: '#2b2620', wallGlow: '#1c150d',
        windowColors: ['#ffb066', '#ffc98a', '#ff9a4d'], lit: 0.42, balcony: true,
    },
    stucco: {
        wall: '#e6cfae', slab: '#c9ab84', frame: '#f6e6cc', recess: '#2a2a2c', wallGlow: '#1b1812',
        windowColors: ['#ffc07a', '#ffd6a0', '#ffa860'], lit: 0.5, balcony: false,
    },
    terracotta: {
        wall: '#c07a52', slab: '#9c5c3a', frame: '#dda57c', recess: '#2a221c', wallGlow: '#1a110a',
        windowColors: ['#ff9e55', '#ffbb77'], lit: 0.35, balcony: true,
    },
    glass: {
        glass: true, wall: '#1d2c46', slab: '#4c5b72', mullion: '#5d6d86', wallGlow: '#03060d',
        windowColors: ['#ffb070', '#7fd6cc', '#ffc890', '#5fbfb6'], floorLit: 0.5,
    },
};
const ledEdge = new THREE.MeshBasicMaterial({ color: hdr(0x2fd6c4, 1.8) });
const ledCrown = new THREE.MeshBasicMaterial({ color: hdr(0xff7a3a, 2) });
const aviation = new THREE.MeshBasicMaterial({ color: hdr(0xff2030, 6) });
const VARIANTS = [
    { w: 16, d: 14, h: 24, style: 'sandstone', seed: 3 },
    { w: 14, d: 12, h: 38, style: 'stucco', seed: 5 },
    { w: 18, d: 16, h: 52, style: 'terracotta', seed: 9 },
    { w: 13, d: 13, h: 76, style: 'sandstone', seed: 21 },
    { w: 15, d: 15, h: 126, style: 'glass', seed: 13, tower: true },
    { w: 17, d: 17, h: 178, style: 'glass', seed: 17, tower: true },
];
const placed = VARIANTS.map(() => []);
const COLUMNS = [44, 72, 104, 140, 182, 230, 285];
for (let z = -TILE / 2; z < TILE / 2; z += 34) {
    COLUMNS.forEach((cx, ci) => {
        if (srand() < 0.14) return;
        let v = ci < 2 ? Math.floor(srand() * 2) : Math.floor(srand() * 4);
        if (ci >= 2 && srand() < 0.1 + ci * 0.03) v = srand() < 0.6 ? 4 : 5;
        placed[v].push({ x: cx + sr(-4, 4), z: z + sr(-6, 6), ry: srand() < 0.25 ? sr(-0.3, 0.3) : 0, tint: sr(0.86, 1.06) });
    });
}

// box whose side faces map the facade at true scale; top/bottom sample the plain corner
function facadeBox(w, h, d) {
    const geo = new THREE.BoxGeometry(w, h, d);
    geo.translate(0, h / 2, 0);
    const uv = geo.attributes.uv;
    for (let face = 0; face < 6; face++) {
        for (let k = 0; k < 4; k++) {
            const i = face * 4 + k;
            if (face === 2 || face === 3) {
                uv.setXY(i, 0.001, 0.999);
            } else {
                const span = face < 2 ? d : w;
                uv.setXY(i, uv.getX(i) * (span / FACADE_U), uv.getY(i) * (h / FACADE_V));
            }
        }
    }
    return geo;
}

const shopTex = canvasTex(256, 32, (g) => {
    g.fillStyle = '#0b0a09';
    g.fillRect(0, 0, 256, 32);
    const r = seeded(77);
    for (let x = 4; x < 256; x += 32) {
        const warm = ['#ff9a4d', '#ffb870', '#ff7a3a', '#ffc890'][Math.floor(r() * 4)];
        const grad = g.createLinearGradient(0, 8, 0, 32);
        grad.addColorStop(0, warm);
        grad.addColorStop(1, 'rgba(255,200,140,0.35)');
        g.fillStyle = grad;
        g.fillRect(x, 9, 24, 23);
        g.fillStyle = '#16120e';
        g.fillRect(x + 11, 9, 2, 23);
    }
    g.fillStyle = 'rgba(255,140,70,0.9)';
    g.fillRect(0, 3, 256, 2);
}, true);
const shopMat = new THREE.MeshStandardMaterial({ color: 0x2a241e, emissive: 0xffffff, emissiveMap: shopTex, emissiveIntensity: 0.9, roughness: 0.6 });
const capMat = new THREE.MeshStandardMaterial({ color: 0x3a3632, roughness: 0.9 });
const towerEdges = [];
const towerBands = [];
const towerTops = [];
const tintColor = new THREE.Color();
VARIANTS.forEach((v) => {
    const style = STYLES[v.style];
    const tex = facadeTextures(style, v.seed);
    const material = new THREE.MeshStandardMaterial({
        map: tex.map,
        emissive: 0xffffff,
        emissiveMap: tex.emissive,
        emissiveIntensity: style.glass ? 1.1 : 1.25,
        roughness: style.glass ? 0.18 : 0.88,
        metalness: style.glass ? 0.75 : 0.02,
        envMapIntensity: style.glass ? 1.4 : 0.6,
    });
    const ms = [];
    OFFSETS.forEach((off) => placed[VARIANTS.indexOf(v)].forEach((b) => {
        ms.push({ m: mat4(b.x, 0, b.z + off, 1, 1, 1, 0, b.ry), tint: b.tint, b, off });
    }));
    const mesh = instanced(facadeBox(v.w, v.h, v.d), material, ms.map((e) => e.m));
    ms.forEach((e, i) => mesh.setColorAt(i, tintColor.setScalar(e.tint)));
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;

    // rooftop cornice / parapet
    const cap = new THREE.BoxGeometry(v.w + 0.4, 0.7, v.d + 0.4);
    cap.translate(0, v.h + 0.35, 0);
    instanced(cap, style.glass ? poleMat : capMat, ms.map((e) => e.m));

    // lit shopfront podium on the low and mid-rise blocks
    if (!v.tower) {
        const podium = new THREE.BoxGeometry(v.w + 0.6, 4.2, v.d + 0.6);
        podium.translate(0, 2.1, 0);
        const pu = podium.attributes.uv;
        for (let face = 0; face < 6; face++) {
            for (let k = 0; k < 4; k++) {
                const i = face * 4 + k;
                const span = face < 2 ? v.d : v.w;
                pu.setXY(i, face === 2 || face === 3 ? 0 : pu.getX(i) * (span / 8), pu.getY(i));
            }
        }
        instanced(podium, shopMat, ms.map((e) => e.m));
    }

    if (v.tower) {
        ms.forEach(({ b, off }) => {
            [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => {
                const lx = (sx * v.w) / 2;
                const lz = (sz * v.d) / 2;
                const cos = Math.cos(b.ry);
                const sin = Math.sin(b.ry);
                towerEdges.push(mat4(b.x + lx * cos + lz * sin, v.h / 2, b.z + off - lx * sin + lz * cos, 0.22, v.h, 0.22, 0, b.ry));
            });
            for (let y = 42; y < v.h - 10; y += 42) towerBands.push(mat4(b.x, y, b.z + off, v.w + 0.3, 0.22, v.d + 0.3, 0, b.ry));
            towerBands.push(mat4(b.x, v.h + 0.7, b.z + off, v.w + 0.6, 0.45, v.d + 0.6, 0, b.ry));
            towerTops.push(mat4(b.x, v.h + 4.6, b.z + off, 0.6, 0.6, 0.6));
        });
        const spire = new THREE.CylinderGeometry(0.15, 0.5, 4, 6);
        spire.translate(0, v.h + 2.6, 0);
        instanced(spire, poleMat, ms.map((e) => e.m));
    }
});
instanced(new THREE.BoxGeometry(1, 1, 1), ledEdge, towerEdges);
instanced(new THREE.BoxGeometry(1, 1, 1), ledCrown, towerBands);
instanced(bulbGeo, aviation, towerTops);

// a slender lit monument in the gardens (generic obelisk)
const obelisks = OFFSETS.map((off) => mat4(4, 0, 150 + off));
const obeliskGeo = new THREE.CylinderGeometry(0.5, 2.4, 46, 4, 1);
obeliskGeo.translate(0, 23, 0);
instanced(obeliskGeo, new THREE.MeshStandardMaterial({ color: 0xe0d8c8, emissive: 0x4a3a24, roughness: 0.5 }), obelisks);
instanced(bulbGeo, new THREE.MeshBasicMaterial({ color: hdr(0xffffff, 8) }), OFFSETS.map((off) => mat4(4, 46.5, 150 + off, 0.5, 0.5, 0.5)));
instanced(poolGeo, glowMat(warmPool, 0xffffff, 0.8), OFFSETS.map((off) => mat4(4, 0.2, 150 + off, 14, 1, 14)));

// pier with a small lit pavilion
OFFSETS.forEach((off) => {
    const pier = new THREE.Mesh(new THREE.BoxGeometry(44, 0.8, 6), new THREE.MeshStandardMaterial({ color: 0x8a7a66, emissive: 0x241a10, roughness: 0.8 }));
    pier.position.set(-34, 0.2, 300 + off);
    world.add(pier);
    const pav = new THREE.Mesh(new THREE.CylinderGeometry(5, 5, 4, 20), new THREE.MeshStandardMaterial({ color: 0x1a1c24, emissive: 0xffc27a, emissiveIntensity: 0.9, roughness: 0.5 }));
    pav.position.set(-58, 2.4, 300 + off);
    world.add(pav);
    const dome2 = new THREE.Mesh(new THREE.SphereGeometry(5.4, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xe9e1d0, emissive: 0x3a2a18, roughness: 0.45 }));
    dome2.position.set(-58, 4.4, 300 + off);
    world.add(dome2);
});
instanced(bulbGeo, bulbWarm, along(TILE, () => [-18, -26, -34, -42, -50].flatMap((x) => [mat4(x, 2.4, 297.4, 0.2, 0.2, 0.2), mat4(x, 2.4, 302.6, 0.2, 0.2, 0.2)])));
instanced(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), glowMat(streakTex, hdr(0xffc27a, 1.6), 0.6),
    along(TILE, () => [-30, -45, -58].map((x) => mat4(x, -0.55, 318, 2.2, 1, 26))));

// a tall water-jet fountain out at sea
const fountains = [];
OFFSETS.forEach((off) => {
    const g = new THREE.Group();
    g.position.set(-170, -0.5, -200 + off);
    const jet = new THREE.Mesh(
        new THREE.CylinderGeometry(0.5, 2.6, 90, 16, 1, true),
        new THREE.MeshBasicMaterial({ color: hdr(0xd8ecff, 1.3), transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }),
    );
    jet.position.y = 45;
    const core = new THREE.Mesh(
        new THREE.CylinderGeometry(0.25, 0.9, 92, 10, 1, true),
        new THREE.MeshBasicMaterial({ color: hdr(0xffffff, 2.2), transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }),
    );
    core.position.y = 46;
    const spray = new THREE.Mesh(new THREE.SphereGeometry(7, 16, 10), new THREE.MeshBasicMaterial({ color: hdr(0xd8ecff, 0.8), transparent: true, opacity: 0.18, depthWrite: false, blending: THREE.AdditiveBlending }));
    spray.position.y = 90;
    spray.scale.set(1, 0.55, 1);
    const reflection = new THREE.Mesh(new THREE.PlaneGeometry(6, 140).rotateX(-Math.PI / 2), glowMat(streakTex, hdr(0xd8ecff, 1.2), 0.45));
    reflection.position.set(0, 0.05, 70);
    g.add(jet, core, spray, reflection);
    world.add(g);
    fountains.push({ jet, core, spray });
});

// boats bobbing with navigation lights
const boats = [];
const boatBase = Array.from({ length: 8 }, () => ({ x: sr(-420, -40), z: sr(-480, 480), ry: sr(0, Math.PI), s: sr(0.8, 1.6) }));
const hullMat = new THREE.MeshStandardMaterial({ color: 0xe8ecf0, roughness: 0.5, emissive: 0x15181d });
OFFSETS.forEach((off) => boatBase.forEach((b) => {
    const g = new THREE.Group();
    g.position.set(b.x, -0.4, b.z + off);
    g.rotation.y = b.ry;
    g.scale.setScalar(b.s);
    const hull = new THREE.Mesh(new THREE.BoxGeometry(3, 1.2, 9), hullMat);
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.2, 3.5), new THREE.MeshStandardMaterial({ color: 0x1a1c22, emissive: 0xffd9a6, emissiveIntensity: 0.8 }));
    cabin.position.set(0, 1.2, 0.8);
    const mast = new THREE.Mesh(new THREE.SphereGeometry(0.18, 6, 4), new THREE.MeshBasicMaterial({ color: hdr(0xffffff, 6) }));
    mast.position.set(0, 2.6, 0.8);
    const port = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 4), new THREE.MeshBasicMaterial({ color: hdr(0xff2030, 5) }));
    port.position.set(-1.5, 0.7, -3.5);
    const star = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 4), new THREE.MeshBasicMaterial({ color: hdr(0x20ff60, 5) }));
    star.position.set(1.5, 0.7, -3.5);
    const refl = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 22).rotateX(-Math.PI / 2), glowMat(streakTex, hdr(0xffe0b0, 1.2), 0.4));
    refl.position.set(0, 0.42, 12);
    g.add(hull, cabin, mast, port, star, refl);
    world.add(g);
    boats.push({ g, phase: srand() * 6 });
}));

// ---------- occasional fireworks over the sea ----------
const FW_COLORS = [[0.3, 4, 1.2], [4, 3, 1], [4, 4, 4], [3.5, 0.8, 3], [1, 2.5, 4]];
const fireworks = [];
let fireworkTimer = 2;
function launchFirework(origin) {
    const n = 110;
    const pos = new Float32Array(n * 3);
    const col = new Float32Array(n * 3);
    const vel = [];
    const c = FW_COLORS[Math.floor(Math.random() * FW_COLORS.length)];
    for (let i = 0; i < n; i++) {
        const u = Math.random() * 2 - 1;
        const a = Math.random() * Math.PI * 2;
        const r = Math.sqrt(1 - u * u);
        const sp = 26 + Math.random() * 10;
        vel.push(new THREE.Vector3(r * Math.cos(a) * sp, u * sp, r * Math.sin(a) * sp));
        col.set(c, i * 3);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({ size: 2.4, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    pts.position.copy(origin);
    scene.add(pts);
    fireworks.push({ pts, vel, life: 0 });
}
function updateFireworks(dt, dronePos) {
    fireworkTimer -= dt;
    if (fireworkTimer <= 0) {
        fireworkTimer = sr(2.5, 5.5);
        launchFirework(new THREE.Vector3(sr(-520, -160), sr(70, 130), dronePos.z - sr(320, 650)));
    }
    for (let i = fireworks.length - 1; i >= 0; i--) {
        const f = fireworks[i];
        f.life += dt;
        const p = f.pts.geometry.attributes.position;
        f.vel.forEach((v, j) => {
            v.y -= 9 * dt;
            v.multiplyScalar(1 - 0.9 * dt);
            p.setXYZ(j, p.getX(j) + v.x * dt, p.getY(j) + v.y * dt, p.getZ(j) + v.z * dt);
        });
        p.needsUpdate = true;
        f.pts.material.opacity = Math.max(0, 1 - f.life / 2.4);
        if (f.life > 2.4) {
            scene.remove(f.pts);
            f.pts.geometry.dispose();
            f.pts.material.dispose();
            fireworks.splice(i, 1);
        }
    }
}

function animateWorld(dt, t) {
    updateTraffic(t);
    updateFireworks(dt, drone.pos);
    aviation.color.copy(Math.sin(t * 3) > 0.2 ? hdr(0xff2030, 6) : hdr(0x400008, 1));
    waterStreaks.material.opacity = 0.42 + Math.sin(t * 2.3) * 0.08;
    fountains.forEach((f, i) => {
        const pulse = 0.93 + Math.sin(t * 1.7 + i) * 0.07;
        f.jet.scale.set(1, pulse, 1);
        f.core.scale.set(1, pulse, 1);
        f.spray.position.y = 90 * pulse;
    });
    boats.forEach((b) => {
        b.g.position.y = -0.4 + Math.sin(t * 1.4 + b.phase) * 0.15;
        b.g.rotation.z = Math.sin(t * 1.1 + b.phase) * 0.04;
    });
}

// ---------- the drone ----------
function buildDrone() {
    const g = new THREE.Group();
    const dark = new THREE.MeshStandardMaterial({ color: 0x23262d, metalness: 0.55, roughness: 0.38 });
    const shell = new THREE.MeshStandardMaterial({ color: 0xe9edf2, metalness: 0.15, roughness: 0.32 });
    const carbon = new THREE.MeshStandardMaterial({ color: 0x14161b, metalness: 0.3, roughness: 0.55 });
    const metal = new THREE.MeshStandardMaterial({ color: 0xa3acb6, metalness: 0.92, roughness: 0.22 });
    const accent = new THREE.MeshStandardMaterial({ color: 0xff7a1a, metalness: 0.3, roughness: 0.4 });
    const led = (color) => new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 9 });

    g.add(new THREE.Mesh(new RoundedBoxGeometry(0.62, 0.2, 0.95, 4, 0.08), dark));
    const top = new THREE.Mesh(new RoundedBoxGeometry(0.46, 0.1, 0.72, 4, 0.05), shell);
    top.position.y = 0.13;
    g.add(top);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.47, 0.02, 0.16), accent);
    stripe.position.set(0, 0.185, 0.16);
    g.add(stripe);

    const props = [];
    const up = new THREE.Vector3(0, 1, 0);
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz], i) => {
        const end = new THREE.Vector3(sx * 0.64, 0.03, sz * 0.6);
        const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, end.length(), 10), carbon);
        arm.position.copy(end).multiplyScalar(0.5);
        arm.quaternion.setFromUnitVectors(up, end.clone().normalize());
        g.add(arm);

        const motor = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.085, 0.1, 18), metal);
        motor.position.set(end.x, 0.08, end.z);
        g.add(motor);

        const hub = new THREE.Group();
        hub.position.set(end.x, 0.145, end.z);
        g.add(hub);
        const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.035, 12), dark);
        hub.add(cap);
        hub.add(new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.006, 0.055), carbon));
        const blur = new THREE.Mesh(
            new THREE.CircleGeometry(0.33, 36),
            new THREE.MeshBasicMaterial({ color: 0xd8dee6, transparent: true, opacity: 0.13, depthWrite: false, side: THREE.DoubleSide }),
        );
        blur.rotation.x = -Math.PI / 2;
        hub.add(blur);
        props.push({ hub, dir: i === 0 || i === 3 ? 1 : -1 });

        const guard = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.012, 6, 44), carbon);
        guard.rotation.x = Math.PI / 2;
        guard.position.copy(hub.position);
        g.add(guard);

        const light = new THREE.Mesh(new THREE.SphereGeometry(0.028, 10, 8), led(sz < 0 ? 0x8ff6ff : 0xff2a3a));
        light.position.set(end.x, 0.01, end.z);
        g.add(light);
    });

    const gimbal = new THREE.Mesh(new THREE.SphereGeometry(0.085, 20, 14), dark);
    gimbal.position.set(0, -0.11, -0.42);
    g.add(gimbal);
    const lens = new THREE.Mesh(
        new THREE.CylinderGeometry(0.04, 0.045, 0.03, 18),
        new THREE.MeshStandardMaterial({ color: 0x0a1a2a, metalness: 1, roughness: 0.05 }),
    );
    lens.rotation.x = Math.PI / 2;
    lens.position.set(0, -0.11, -0.5);
    g.add(lens);

    [-1, 1].forEach((sx) => {
        [-1, 1].forEach((sz) => {
            const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.2, 6), carbon);
            leg.position.set(sx * 0.2, -0.18, sz * 0.25);
            g.add(leg);
        });
        const skid = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.68, 8), carbon);
        skid.rotation.x = Math.PI / 2;
        skid.position.set(sx * 0.2, -0.28, 0);
        g.add(skid);
    });

    g.traverse((o) => {
        if (o.isMesh && !o.material.transparent) o.castShadow = true;
    });
    g.scale.setScalar(1.5);
    return { group: g, props };
}

const droneModel = buildDrone();
scene.add(droneModel.group);

// ---------- portals ----------
const RING_COLORS = { normal: 0x7fc8d6, target: 0xf2b36b, gold: 0xe9cf7a, miss: 0xd9606e };
const ringGeo = new THREE.TorusGeometry(1, 0.045, 18, 120);
const trimGeo = new THREE.TorusGeometry(1.13, 0.012, 6, 120);
const markerGeo = new THREE.BoxGeometry(0.12, 0.12, 0.12);
const discGeo = new THREE.CircleGeometry(1, 64);
const portalTex = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(64, 64, 4, 64, 64, 64);
    grad.addColorStop(0, 'rgba(255,255,255,0)');
    grad.addColorStop(0.7, 'rgba(255,255,255,0.08)');
    grad.addColorStop(0.97, 'rgba(255,255,255,0.55)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
})();

function makeRing(gold) {
    const color = gold ? RING_COLORS.gold : RING_COLORS.normal;
    const mat = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: color, emissiveIntensity: 1.8, metalness: 0.6, roughness: 0.3 });
    const trimMat = new THREE.MeshStandardMaterial({ color: 0x1b1f27, metalness: 0.9, roughness: 0.25 });
    const discMat = new THREE.MeshBasicMaterial({
        map: portalTex, color, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    });
    const group = new THREE.Group();
    const spin = new THREE.Group();
    group.add(spin);
    spin.add(new THREE.Mesh(ringGeo, mat), new THREE.Mesh(trimGeo, trimMat));
    for (let i = 0; i < 4; i++) {
        const marker = new THREE.Mesh(markerGeo, mat);
        const a = (i / 4) * Math.PI * 2;
        marker.position.set(Math.cos(a) * 1.13, Math.sin(a) * 1.13, 0);
        marker.rotation.z = a + Math.PI / 4;
        spin.add(marker);
    }
    group.add(new THREE.Mesh(discGeo, discMat));
    return { group, spin, mat, discMat, trimMat };
}

// ---------- audio ----------
let actx = null;
let hum = null;
let soundOn = store.get(SOUND_KEY) !== 'off';

function ensureAudio() {
    if (!soundOn) return;
    try {
        actx = actx || new (window.AudioContext || window.webkitAudioContext)();
        if (actx.state === 'suspended') actx.resume();
        if (!hum) {
            const gain = actx.createGain();
            gain.gain.value = 0;
            const filter = actx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.value = 900;
            const oscs = [180, 183.5].map((f) => {
                const o = actx.createOscillator();
                o.type = 'sawtooth';
                o.frequency.value = f;
                o.connect(filter);
                o.start();
                return o;
            });
            filter.connect(gain).connect(actx.destination);
            hum = { gain, oscs };
        }
    } catch (_) {
        actx = null;
    }
}

function tone(freq, dur, { type = 'sine', vol = 0.08, to = null, delay = 0 } = {}) {
    if (!soundOn || !actx) return;
    const t0 = actx.currentTime + delay;
    const o = actx.createOscillator();
    const g = actx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(actx.destination);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
}

function sfx(name) {
    switch (name) {
        case 'pass': tone(880, 0.25, { to: 1320 }); break;
        case 'perfect': [988, 1319, 1976].forEach((f, i) => tone(f, 0.22, { delay: i * 0.06 })); break;
        case 'gold': [784, 1175, 1568, 2093].forEach((f, i) => tone(f, 0.25, { delay: i * 0.06, type: 'triangle' })); break;
        case 'miss': tone(160, 0.4, { type: 'sawtooth', to: 50, vol: 0.12 }); break;
        case 'start': [523, 659, 784].forEach((f, i) => tone(f, 0.2, { delay: i * 0.08 })); break;
        default: break;
    }
}

function setHum(level) {
    if (!hum || !actx) return;
    hum.gain.gain.setTargetAtTime(soundOn ? level : 0, actx.currentTime, 0.2);
}

const soundBtn = $('sound-btn');
function renderSound() {
    soundBtn.textContent = soundOn ? 'sound on' : 'sound off';
    soundBtn.setAttribute('aria-pressed', String(soundOn));
}
soundBtn.addEventListener('click', () => {
    soundOn = !soundOn;
    store.set(SOUND_KEY, soundOn ? 'on' : 'off');
    renderSound();
    ensureAudio();
    if (!soundOn) setHum(0);
});
renderSound();

// ---------- game state ----------
const MAX_SHIELDS = 3;
const state = {
    mode: 'title',
    score: 0,
    combo: 0,
    shields: MAX_SHIELDS,
    best: Number(store.get(BEST_KEY)) || 0,
    speed: 14,
    endTimer: 0,
    shake: 0,
};
const drone = { pos: new THREE.Vector3(0, 10, 0), vel: new THREE.Vector2(), target: new THREE.Vector2(0, 10) };
const rings = [];
let lastRing = { x: 0, y: 10, z: -40 };
const keys = new Set();

function clearRings() {
    rings.forEach((r) => {
        scene.remove(r.group);
        r.mat.dispose();
        r.discMat.dispose();
        r.trimMat.dispose();
    });
    rings.length = 0;
}

function spawnRing() {
    const spread = Math.min(1, 0.4 + state.score * 0.06);
    const x = clamp(lastRing.x + rand(-7, 7) * spread, -13, 13);
    const y = clamp(lastRing.y + rand(-4, 4) * spread, 6, 18);
    const z = lastRing.z - rand(46, 56);
    const gold = state.score >= 3 && Math.random() < 0.13;
    const radius = (gold ? 0.85 : 1) * Math.max(2.4, 3.4 - state.score * 0.03);
    const ring = makeRing(gold);
    ring.group.position.set(x, y, z);
    ring.group.scale.setScalar(radius);
    scene.add(ring.group);
    rings.push({ ...ring, x, y, z, radius, gold, done: false, missed: false, fade: 0 });
    lastRing = { x, y, z };
}

const hud = $('hud');
const hudScore = $('hud-score');
const hudCombo = $('hud-combo');
const hudSpeed = $('hud-speed');
const shieldCells = [...document.querySelectorAll('#hud-shields .cells i')];
const popups = $('popups');

function renderHud() {
    hudScore.textContent = state.score;
    hudCombo.textContent = state.combo >= 5 ? 'x2' : '';
    shieldCells.forEach((cell, i) => cell.classList.toggle('off', i >= state.shields));
    $('hud-shields').setAttribute('aria-label', `${state.shields} shield${state.shields === 1 ? '' : 's'} left`);
}

const tmpV = new THREE.Vector3();
function popup(text, cls, worldPos) {
    tmpV.copy(worldPos).project(camera);
    const el = document.createElement('div');
    el.className = `popup ${cls}`;
    el.textContent = text;
    el.style.left = `${(tmpV.x * 0.5 + 0.5) * window.innerWidth}px`;
    el.style.top = `${(-tmpV.y * 0.5 + 0.5) * window.innerHeight}px`;
    popups.appendChild(el);
    setTimeout(() => el.remove(), 1000);
}

function startRun() {
    ensureAudio();
    clearRings();
    Object.assign(state, { mode: 'play', score: 0, combo: 0, shields: MAX_SHIELDS, speed: 22, endTimer: 0 });
    drone.target.set(drone.pos.x, drone.pos.y);
    lastRing = { x: drone.pos.x, y: clamp(drone.pos.y, 6, 18), z: drone.pos.z - 30 };
    for (let i = 0; i < 6; i++) spawnRing();
    $('start-panel').hidden = true;
    $('over-panel').hidden = true;
    hud.hidden = false;
    renderHud();
    sfx('start');
    renderer.domElement.focus?.();
}

function endRun() {
    state.mode = 'over';
    const isBest = state.score > state.best;
    if (isBest) {
        state.best = state.score;
        store.set(BEST_KEY, String(state.best));
    }
    $('final-score').textContent = state.score;
    const bestEl = $('over-best');
    bestEl.textContent = isBest ? 'New best score!' : `Best score: ${state.best}`;
    bestEl.classList.toggle('new', isBest);
    hud.hidden = true;
    $('over-panel').hidden = false;
    $('retry-btn').focus();
}

function checkRing(ring) {
    ring.done = true;
    const d = Math.hypot(drone.pos.x - ring.x, drone.pos.y - ring.y);
    const at = new THREE.Vector3(ring.x, ring.y + ring.radius * 0.6, ring.z);
    if (d <= ring.radius - 0.8) {
        state.combo += 1;
        let pts = ring.gold ? 3 : 1;
        const perfect = d < ring.radius * 0.3;
        if (perfect) pts += 1;
        if (state.combo >= 5) pts *= 2;
        state.score += pts;
        popup(perfect ? `Perfect +${pts}` : `+${pts}`, ring.gold ? 'gold' : perfect ? 'perfect' : '', at);
        sfx(ring.gold ? 'gold' : perfect ? 'perfect' : 'pass');
    } else {
        ring.missed = true;
        ring.mat.emissive.setHex(RING_COLORS.miss);
        ring.discMat.color.setHex(RING_COLORS.miss);
        state.combo = 0;
        state.shields = Math.max(0, state.shields - 1);
        state.shake = reduceMotion ? 0 : 0.45;
        popup('Miss', 'miss', at);
        sfx('miss');
        document.body.classList.remove('hit');
        void document.body.offsetWidth;
        document.body.classList.add('hit');
        if (state.shields === 0 && state.endTimer <= 0) state.endTimer = 0.9;
    }
    renderHud();
}

// ---------- input ----------
function steerFromPointer(clientX, clientY) {
    const nx = (clientX / window.innerWidth) * 2 - 1;
    const ny = -((clientY / window.innerHeight) * 2 - 1);
    drone.target.set(clamp(nx * 16, -16, 16), clamp(11 + ny * 9, 3.5, 21));
}
host.addEventListener('pointermove', (e) => {
    if (state.mode === 'play') steerFromPointer(e.clientX, e.clientY);
});
host.addEventListener('pointerdown', (e) => {
    if (state.mode === 'play') steerFromPointer(e.clientX, e.clientY);
});

const KEYMAP = {
    ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
    ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down',
};
window.addEventListener('keydown', (e) => {
    if (KEYMAP[e.code] && state.mode === 'play') {
        keys.add(KEYMAP[e.code]);
        e.preventDefault();
    }
});
window.addEventListener('keyup', (e) => {
    if (KEYMAP[e.code]) keys.delete(KEYMAP[e.code]);
});

$('start-btn').addEventListener('click', startRun);
$('retry-btn').addEventListener('click', startRun);
$('best-start').textContent = state.best;

// ---------- post-processing ----------
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.6, 0.45, 1.25);
composer.addPass(bloom);
composer.addPass(new OutputPass());

function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h);
    composer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

// ---------- frame loop ----------
const clock = new THREE.Clock();
const camTarget = new THREE.Vector3();
const lookAt = new THREE.Vector3();
const euler = new THREE.Euler();
camera.position.set(0, 13, 10);

function update(dt, t) {
    const playing = state.mode === 'play';
    if (playing) {
        state.speed = Math.min(44, 22 + state.score * 0.45);
        const kx = (keys.has('right') ? 1 : 0) - (keys.has('left') ? 1 : 0);
        const ky = (keys.has('up') ? 1 : 0) - (keys.has('down') ? 1 : 0);
        if (kx || ky) {
            drone.target.x = clamp(drone.target.x + kx * 16 * dt, -16, 16);
            drone.target.y = clamp(drone.target.y + ky * 12 * dt, 3.5, 21);
        }
    } else {
        state.speed += ((state.mode === 'over' ? 8 : 14) - state.speed) * Math.min(1, dt * 1.5);
        drone.target.set(Math.sin(t * 0.35) * 6, 10 + Math.sin(t * 0.6) * 2);
    }

    // springy lateral/vertical response, constant forward speed
    const ax = (drone.target.x - drone.pos.x) * 3 - drone.vel.x;
    const ay = (drone.target.y - drone.pos.y) * 3 - drone.vel.y;
    drone.vel.x += ax * Math.min(1, dt * 4);
    drone.vel.y += ay * Math.min(1, dt * 4);
    drone.pos.x += drone.vel.x * dt;
    drone.pos.y += drone.vel.y * dt;
    const prevZ = drone.pos.z;
    drone.pos.z -= state.speed * dt;

    const g = droneModel.group;
    g.position.copy(drone.pos);
    g.position.y += Math.sin(t * 5) * 0.04;
    euler.set(-0.2 + clamp(drone.vel.y * 0.025, -0.25, 0.25), clamp(-drone.vel.x * 0.02, -0.25, 0.25), clamp(-drone.vel.x * 0.06, -0.6, 0.6));
    g.quaternion.slerp(new THREE.Quaternion().setFromEuler(euler), Math.min(1, dt * 6));
    droneModel.props.forEach((p) => { p.hub.rotation.y += p.dir * 70 * dt; });

    if (playing) {
        rings.forEach((ring) => {
            if (!ring.done && prevZ > ring.z && drone.pos.z <= ring.z) checkRing(ring);
        });
        if (state.endTimer > 0) {
            state.endTimer -= dt;
            if (state.endTimer <= 0) endRun();
        }
        while (lastRing.z > drone.pos.z - 420) spawnRing();
    }

    const next = rings.find((r) => !r.done);
    rings.forEach((ring) => {
        ring.spin.rotation.z += dt * (ring.gold ? 1.4 : 0.6);
        if (!ring.missed && !ring.done) {
            const hex = ring.gold ? RING_COLORS.gold : ring === next ? RING_COLORS.target : RING_COLORS.normal;
            ring.mat.emissive.setHex(hex);
            ring.discMat.color.setHex(hex);
            ring.mat.emissiveIntensity = ring === next ? 2.4 + Math.sin(t * 3) * 0.35 : 1.6;
        }
        if (ring.done) {
            ring.fade = Math.min(1, ring.fade + dt * 2.2);
            ring.group.scale.setScalar(ring.radius * (1 + ring.fade * 0.6));
            ring.mat.emissiveIntensity = 1.8 * (1 - ring.fade);
            ring.discMat.opacity = 0.16 * (1 - ring.fade);
        }
    });
    for (let i = rings.length - 1; i >= 0; i--) {
        const r = rings[i];
        if (r.z > drone.pos.z + 30) {
            scene.remove(r.group);
            r.mat.dispose();
            r.discMat.dispose();
            r.trimMat.dispose();
            rings.splice(i, 1);
        }
    }

    // chase camera
    camTarget.set(drone.pos.x * 0.85, drone.pos.y + 2.3, drone.pos.z + 8.5);
    camera.position.lerp(camTarget, 1 - Math.exp(-dt * 5));
    if (state.shake > 0) {
        state.shake = Math.max(0, state.shake - dt);
        camera.position.x += (Math.random() - 0.5) * state.shake * 0.8;
        camera.position.y += (Math.random() - 0.5) * state.shake * 0.8;
    }
    lookAt.set(drone.pos.x, drone.pos.y + 0.6, drone.pos.z - 14);
    camera.lookAt(lookAt);
    const fov = 60 + (state.speed - 22) * 0.35;
    if (Math.abs(camera.fov - fov) > 0.05) {
        camera.fov += (fov - camera.fov) * Math.min(1, dt * 3);
        camera.updateProjectionMatrix();
    }

    // keep the world, sky and lights centred on the drone
    world.position.z = Math.round(drone.pos.z / TILE) * TILE;
    skyGroup.position.set(drone.pos.x, 0, drone.pos.z);
    moonLight.position.set(drone.pos.x - 60, drone.pos.y + 80, drone.pos.z - 120);
    moonLight.target.position.copy(drone.pos);
    droneGlow.position.set(drone.pos.x, drone.pos.y - 1.5, drone.pos.z + 1);
    animateWorld(dt, t);
    fillLight.position.set(drone.pos.x, drone.pos.y + 5, drone.pos.z + 12);
    fillLight.target.position.copy(drone.pos);

    hudSpeed.textContent = Math.round(state.speed * 3.6);
    setHum(playing ? 0.018 + (state.speed - 22) * 0.0006 : 0.008);
    if (hum) hum.oscs.forEach((o, i) => o.frequency.setTargetAtTime(170 + state.speed * 1.6 + i * 3.5, actx.currentTime, 0.3));
}

function loop() {
    const dt = Math.min(clock.getDelta(), 0.05);
    update(dt, clock.elapsedTime);
    composer.render();
}
renderer.setAnimationLoop(loop);

document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        renderer.setAnimationLoop(null);
        if (actx) actx.suspend();
    } else {
        clock.getDelta();
        renderer.setAnimationLoop(loop);
        if (actx && soundOn) actx.resume();
    }
});
