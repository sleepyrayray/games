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
controls.target.set(0.2, 0, 0);

const ambientLight = new THREE.AmbientLight(0x8ca7ff, 0.35);
scene.add(ambientLight);

const keyLight = new THREE.PointLight(0xdde7ff, 4, 40);
keyLight.position.set(4, 5, 5);
scene.add(keyLight);

const starField = createStarField(1200, 90, 0xffffff, 0.85, 0.045);
const dustField = createStarField(500, 55, 0x7f8fbf, 0.2, 0.018);
scene.add(starField, dustField);

const cometGroup = new THREE.Group();
cometGroup.position.x = 2.25;
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

const headLight = new THREE.PointLight(0x88d7ff, 3.5, 12, 2);
headLight.position.set(0.1, 0.05, 0.2);
cometGroup.add(headLight);

const tailParticleSystem = createCometTail(2400);
cometGroup.add(tailParticleSystem);

const clock = new THREE.Clock();
const tailColor = new THREE.Color();

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

function createCometTail(count) {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const seeds = new Float32Array(count * 3);
  const phases = new Float32Array(count);
  const sizes = new Float32Array(count);

  for (let i = 0; i < count; i += 1) {
    const positionStride = i * 3;
    const angle = THREE.MathUtils.randFloat(0, Math.PI * 2);
    const radius = Math.sqrt(Math.random());

    positions[positionStride] = 0;
    positions[positionStride + 1] = 0;
    positions[positionStride + 2] = 0;

    seeds[positionStride] = Math.cos(angle) * radius;
    seeds[positionStride + 1] = Math.sin(angle) * radius;
    seeds[positionStride + 2] = Math.random();

    phases[i] = Math.random();
    sizes[i] = THREE.MathUtils.randFloat(2.5, 8.5);
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 3));
  geometry.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
  geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(0xff4a5f) },
      uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
      uTime: { value: 0 },
    },
    vertexShader: `
      attribute vec3 aSeed;
      attribute float aPhase;
      attribute float aSize;

      uniform float uPixelRatio;
      uniform float uTime;

      varying float vAlpha;

      void main() {
        float progress = fract(aPhase + uTime * 0.075);
        float stream = pow(progress, 0.72);
        float tailLength = 8.8;
        float tailWidth = mix(0.05, 1.08, stream);
        float tailLift = sin(uTime * 0.75 + aSeed.z * 6.2831853 + stream * 8.0) * 0.055 * stream;

        vec3 transformed = position;
        transformed.x = -0.52 - stream * tailLength;
        transformed.y = aSeed.x * tailWidth + tailLift;
        transformed.z = aSeed.y * tailWidth * 0.72;

        float fadeIn = smoothstep(0.0, 0.07, progress);
        float fadeOut = 1.0 - smoothstep(0.74, 1.0, progress);
        vAlpha = fadeIn * fadeOut * mix(0.36, 0.1, stream);

        vec4 mvPosition = modelViewMatrix * vec4(transformed, 1.0);
        gl_PointSize = aSize * (1.1 - stream * 0.52) * uPixelRatio * (48.0 / -mvPosition.z);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;

      varying float vAlpha;

      void main() {
        float distanceFromCenter = distance(gl_PointCoord, vec2(0.5));
        float softParticle = smoothstep(0.5, 0.0, distanceFromCenter);
        float hotCore = smoothstep(0.18, 0.0, distanceFromCenter);
        vec3 color = mix(uColor, vec3(1.0), hotCore * 0.16);

        gl_FragColor = vec4(color, softParticle * vAlpha);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  const particles = new THREE.Points(geometry, material);
  particles.frustumCulled = false;

  return particles;
}

function animate() {
  const elapsed = clock.getElapsedTime();
  const rainbowHue = (elapsed * 0.025) % 1;

  tailColor.setHSL(rainbowHue, 0.92, 0.62);
  tailParticleSystem.material.uniforms.uColor.value.copy(tailColor);
  tailParticleSystem.material.uniforms.uTime.value = elapsed;
  glow.material.color.copy(tailColor);
  headLight.color.copy(tailColor);
  nucleus.material.emissive.copy(tailColor).multiplyScalar(0.16);

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
  tailParticleSystem.material.uniforms.uPixelRatio.value = Math.min(window.devicePixelRatio, 2);
}

window.addEventListener('resize', handleResize);

animate();
