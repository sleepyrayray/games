import './style.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

const app = document.querySelector('#app');

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x02030a);
scene.fog = new THREE.FogExp2(0x02030a, 0.018);

const camera = new THREE.PerspectiveCamera(
  55,
  window.innerWidth / window.innerHeight,
  0.1,
  1000,
);
camera.position.set(0, 2.4, 9);

const renderer = new THREE.WebGLRenderer({
  antialias: true,
  powerPreference: 'high-performance',
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
app.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.enablePan = false;
controls.minDistance = 4;
controls.maxDistance = 13;
controls.target.set(0, 0, 0);

const ambientLight = new THREE.AmbientLight(0x8ca7ff, 0.35);
scene.add(ambientLight);

const keyLight = new THREE.PointLight(0xdde7ff, 4, 40);
keyLight.position.set(4, 5, 5);
scene.add(keyLight);

const starField = createStarField(1200, 90, 0xffffff, 0.85, 0.045);
const dustField = createStarField(500, 55, 0x7f8fbf, 0.2, 0.018);
scene.add(starField, dustField);

const cometGroup = new THREE.Group();
scene.add(cometGroup);

const nucleusGeometry = new THREE.IcosahedronGeometry(0.46, 2);
const nucleusMaterial = new THREE.MeshStandardMaterial({
  color: 0xcbd9e7,
  roughness: 0.8,
  metalness: 0.05,
  emissive: 0x101827,
  emissiveIntensity: 0.25,
});
const nucleus = new THREE.Mesh(nucleusGeometry, nucleusMaterial);
nucleus.scale.set(1, 0.82, 1.15);
cometGroup.add(nucleus);

const glowGeometry = new THREE.SphereGeometry(0.95, 32, 32);
const glowMaterial = new THREE.MeshBasicMaterial({
  color: 0x88d7ff,
  transparent: true,
  opacity: 0.18,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
});
const glow = new THREE.Mesh(glowGeometry, glowMaterial);
cometGroup.add(glow);

const clock = new THREE.Clock();

function createStarField(count, radius, color, opacity, size) {
  const positions = new Float32Array(count * 3);

  for (let i = 0; i < count; i += 1) {
    const stride = i * 3;
    const distance = THREE.MathUtils.randFloat(radius * 0.35, radius);
    const theta = THREE.MathUtils.randFloat(0, Math.PI * 2);
    const phi = Math.acos(THREE.MathUtils.randFloatSpread(2));

    positions[stride] = distance * Math.sin(phi) * Math.cos(theta);
    positions[stride + 1] = distance * Math.sin(phi) * Math.sin(theta);
    positions[stride + 2] = distance * Math.cos(phi);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  const material = new THREE.PointsMaterial({
    color,
    opacity,
    size,
    sizeAttenuation: true,
    transparent: true,
    depthWrite: false,
  });

  return new THREE.Points(geometry, material);
}

function animate() {
  const elapsed = clock.getElapsedTime();

  nucleus.rotation.x = elapsed * 0.16;
  nucleus.rotation.y = elapsed * 0.22;
  glow.scale.setScalar(1 + Math.sin(elapsed * 1.4) * 0.035);
  starField.rotation.y = elapsed * 0.006;
  dustField.rotation.y = elapsed * 0.012;

  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

function handleResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();

  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
}

window.addEventListener('resize', handleResize);

animate();
