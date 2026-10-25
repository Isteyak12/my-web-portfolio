import * as THREE from 'three';

const container = document.getElementById('model-container');
const portal = container.closest('a');

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
camera.position.set(0, 0, 4.2);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
container.appendChild(renderer.domElement);

function faceTexture(draw) {
    const c = document.createElement('canvas');
    c.width = c.height = 16;
    const g = c.getContext('2d');
    draw(g);
    const t = new THREE.CanvasTexture(c);
    t.magFilter = THREE.NearestFilter;
    t.minFilter = THREE.NearestFilter;
    t.generateMipmaps = false;
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
}

function nightSky(g) {
    for (let y = 0; y < 16; y++) {
        g.fillStyle = `hsl(${285 - y * 6}, 70%, ${12 + y * 2.6}%)`;
        g.fillRect(0, y, 16, 1);
    }
}

const cupFace = faceTexture((g) => {
    nightSky(g);
    g.fillStyle = '#f3eee8';
    g.fillRect(4, 8, 7, 6);
    g.fillRect(11, 9, 2, 1);
    g.fillRect(12, 10, 1, 2);
    g.fillRect(11, 12, 2, 1);
    g.fillStyle = '#6b4128';
    g.fillRect(5, 8, 5, 1);
    g.fillStyle = 'rgba(255,255,255,0.75)';
    g.fillRect(6, 4, 1, 2);
    g.fillRect(7, 3, 1, 1);
    g.fillRect(8, 5, 1, 2);
    g.fillRect(9, 4, 1, 1);
});

const rainFace = faceTexture((g) => {
    nightSky(g);
    g.fillStyle = '#a8c4ff';
    for (const [x, y] of [[2, 1], [6, 4], [11, 2], [14, 7], [3, 9], [9, 10], [13, 12], [5, 13]]) {
        g.fillRect(x, y, 1, 2);
    }
    g.fillStyle = '#ff5fb4';
    g.fillRect(0, 15, 16, 1);
});

const neonFace = faceTexture((g) => {
    g.fillStyle = '#14081f';
    g.fillRect(0, 0, 16, 16);
    g.fillStyle = '#48e2ff';
    g.fillRect(1, 1, 14, 1);
    g.fillRect(1, 14, 14, 1);
    g.fillRect(1, 1, 1, 14);
    g.fillRect(14, 1, 1, 14);
    g.fillStyle = '#ff5fb4';
    for (let i = 0; i < 5; i++) g.fillRect(6, 3 + i, 1 + i, 1);
    for (let i = 0; i < 4; i++) g.fillRect(6, 8 + i, 4 - i, 1);
});

const cube = new THREE.Mesh(
    new THREE.BoxGeometry(1.6, 1.6, 1.6),
    [cupFace, rainFace, neonFace, neonFace, cupFace, rainFace].map((map) => new THREE.MeshBasicMaterial({ map })),
);
scene.add(cube);

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
let speed = 0.01;
let targetSpeed = 0.01;
let scale = 1;
let targetScale = 1;

portal.addEventListener('pointerenter', () => { targetSpeed = 0.045; targetScale = 1.12; });
portal.addEventListener('pointerleave', () => { targetSpeed = 0.01; targetScale = 1; });
portal.addEventListener('focus', () => { targetScale = 1.12; });
portal.addEventListener('blur', () => { targetScale = 1; });

function resize() {
    const w = container.clientWidth;
    const h = container.clientHeight;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

function animate() {
    speed += (targetSpeed - speed) * 0.08;
    scale += (targetScale - scale) * 0.12;
    if (!reduceMotion) {
        cube.rotation.x += speed * 0.8;
        cube.rotation.y += speed;
    }
    cube.scale.setScalar(scale);
    renderer.render(scene, camera);
}

new IntersectionObserver(([entry]) => {
    renderer.setAnimationLoop(entry.isIntersecting ? animate : null);
}).observe(container);
