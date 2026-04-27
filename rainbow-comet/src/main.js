import './style.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

const app = document.querySelector('#app');

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x02030a);
scene.fog = new THREE.FogExp2(0x02030a, 0.018);

const TAIL_FLOW_SPEED = 0.075;
const RAINBOW_CYCLE_SPEED = 0.018;

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
controls.enableZoom = false;
controls.minAzimuthAngle = -0.55;
controls.maxAzimuthAngle = 0.55;
controls.minPolarAngle = 1.08;
controls.maxPolarAngle = 1.78;
updateCameraFraming();

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

const glowTexture = createGlowTexture();
const glow = createGlowSprite(glowTexture, 0x88d7ff, 0.38, 2.15);
cometGroup.add(glow);

const innerGlow = createGlowSprite(glowTexture, 0xf3fbff, 0.28, 1.05);
cometGroup.add(innerGlow);

const tailJetGlow = createGlowSprite(glowTexture, 0x88d7ff, 0.32, 1);
tailJetGlow.position.x = -0.58;
tailJetGlow.scale.set(1.74, 0.76, 1);
cometGroup.add(tailJetGlow);

const nucleusGeometry = createNucleusGeometry();
const nucleusMaterial = new THREE.MeshStandardMaterial({
  color: 0xffffff,
  vertexColors: true,
  roughness: 0.74,
  metalness: 0.04,
  flatShading: true,
  emissive: 0x102032,
  emissiveIntensity: 0.32,
});
const nucleus = new THREE.Mesh(nucleusGeometry, nucleusMaterial);
nucleus.scale.set(1, 0.86, 1.18);
cometGroup.add(nucleus);

const headLight = new THREE.PointLight(0x88d7ff, 3.5, 12, 2);
headLight.position.set(0.1, 0.05, 0.2);
cometGroup.add(headLight);

const rimLight = new THREE.PointLight(0xf3fbff, 1.15, 5, 2);
rimLight.position.set(0.75, 0.5, 1.05);
cometGroup.add(rimLight);

const tailParticleSystem = createCometTail(3000);
cometGroup.add(tailParticleSystem);

const clock = new THREE.Clock();
const tailColor = new THREE.Color();
const headHighlightColor = new THREE.Color();
const whiteColor = new THREE.Color(0xffffff);

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

function createNucleusGeometry() {
  const geometry = new THREE.IcosahedronGeometry(0.48, 3);
  const positions = geometry.attributes.position;
  const colors = [];
  const vertex = new THREE.Vector3();
  const direction = new THREE.Vector3();
  const color = new THREE.Color();

  for (let i = 0; i < positions.count; i += 1) {
    vertex.fromBufferAttribute(positions, i);
    direction.copy(vertex).normalize();

    const ridge =
      Math.sin(direction.x * 8.2 + direction.y * 4.6) * 0.055 +
      Math.sin(direction.z * 9.7 + direction.x * 5.1) * 0.04;
    const chip = (((i * 17) % 29) / 29 - 0.5) * 0.05;
    const radius = vertex.length() * (1 + ridge + chip);

    vertex.copy(direction).multiplyScalar(radius);
    positions.setXYZ(i, vertex.x, vertex.y * 0.88, vertex.z * 1.16);

    const lightness = THREE.MathUtils.clamp(0.56 + ridge * 1.7 + direction.y * 0.08, 0.38, 0.76);
    const saturation = THREE.MathUtils.clamp(0.22 + Math.abs(ridge) * 1.35, 0.18, 0.42);
    color.setHSL(0.57, saturation, lightness);
    colors.push(color.r, color.g, color.b);
  }

  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();

  return geometry;
}

function createGlowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;

  const context = canvas.getContext('2d');
  const gradient = context.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
  gradient.addColorStop(0.18, 'rgba(196, 247, 255, 0.7)');
  gradient.addColorStop(0.46, 'rgba(91, 190, 255, 0.22)');
  gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

  context.fillStyle = gradient;
  context.fillRect(0, 0, 128, 128);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;

  return texture;
}

function createGlowSprite(texture, color, opacity, scale) {
  const material = new THREE.SpriteMaterial({
    map: texture,
    color,
    opacity,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: false,
  });

  const sprite = new THREE.Sprite(material);
  sprite.scale.setScalar(scale);

  return sprite;
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
    sizes[i] = THREE.MathUtils.randFloat(2.2, 8.2);
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 3));
  geometry.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
  geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uFlowSpeed: { value: TAIL_FLOW_SPEED },
      uHueSpeed: { value: RAINBOW_CYCLE_SPEED },
      uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
      uTime: { value: 0 },
    },
    vertexShader: `
      attribute vec3 aSeed;
      attribute float aPhase;
      attribute float aSize;

      uniform float uFlowSpeed;
      uniform float uHueSpeed;
      uniform float uPixelRatio;
      uniform float uTime;

      varying float vAlpha;
      varying vec3 vColor;

      vec3 hslToRgb(vec3 hsl) {
        vec3 rgb = clamp(abs(mod(hsl.x * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
        return hsl.z + hsl.y * (rgb - 0.5) * (1.0 - abs(2.0 * hsl.z - 1.0));
      }

      void main() {
        float progress = fract(aPhase + uTime * uFlowSpeed);
        float stream = pow(progress, 0.72);
        float tailLength = 9.35;
        float tailWidth = mix(0.16, 0.96, smoothstep(0.0, 0.86, stream));
        float dissolve = 1.0 - smoothstep(0.68, 1.0, stream);
        float drift = sin(uTime * 0.62 + aSeed.z * 6.2831853 + stream * 9.0);
        float crossDrift = cos(uTime * 0.47 + aSeed.z * 8.0 + stream * 5.5);
        float birthHue = fract(uTime * uHueSpeed - progress * (uHueSpeed / uFlowSpeed) + aSeed.z * 0.018);
        float headSpread = mix(0.42, 1.0, smoothstep(0.0, 0.24, stream));

        vec3 transformed = position;
        transformed.x = -0.28 - stream * tailLength;
        transformed.y = aSeed.x * tailWidth * headSpread + drift * 0.12 * stream * dissolve;
        transformed.z = aSeed.y * tailWidth * 0.62 * headSpread + crossDrift * 0.08 * stream * dissolve;

        float fadeIn = smoothstep(0.0, 0.008, progress);
        float fadeOut = 1.0 - smoothstep(0.58, 1.0, progress);
        float particleVariation = mix(0.78, 1.18, aSeed.z);
        vAlpha = fadeIn * fadeOut * mix(0.32, 0.07, stream) * particleVariation;
        vColor = hslToRgb(vec3(birthHue, 0.92, 0.62));

        vec4 mvPosition = modelViewMatrix * vec4(transformed, 1.0);
        gl_PointSize = aSize * mix(1.12, 0.34, stream) * uPixelRatio * (52.0 / -mvPosition.z);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      varying float vAlpha;
      varying vec3 vColor;

      void main() {
        float distanceFromCenter = distance(gl_PointCoord, vec2(0.5));
        float softParticle = smoothstep(0.5, 0.0, distanceFromCenter);
        float hotCore = smoothstep(0.18, 0.0, distanceFromCenter);
        vec3 color = mix(vColor, vec3(1.0), hotCore * 0.16);

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
  const rainbowHue = (elapsed * RAINBOW_CYCLE_SPEED) % 1;

  tailColor.setHSL(rainbowHue, 0.92, 0.62);
  headHighlightColor.copy(tailColor).lerp(whiteColor, 0.48);
  tailParticleSystem.material.uniforms.uTime.value = elapsed;
  glow.material.color.copy(tailColor);
  innerGlow.material.color.copy(headHighlightColor);
  tailJetGlow.material.color.copy(tailColor);
  headLight.color.copy(headHighlightColor);
  rimLight.color.copy(headHighlightColor);
  nucleus.material.emissive.copy(tailColor).multiplyScalar(0.16);

  nucleus.rotation.x = elapsed * 0.16;
  nucleus.rotation.y = elapsed * 0.22;
  glow.scale.setScalar(2.15 * (1 + Math.sin(elapsed * 1.4) * 0.035));
  innerGlow.scale.setScalar(1.05 * (1 + Math.sin(elapsed * 1.7 + 0.6) * 0.025));
  tailJetGlow.scale.set(
    1.74 * (1 + Math.sin(elapsed * 1.25 + 0.35) * 0.03),
    0.76 * (1 + Math.sin(elapsed * 1.25 + 0.35) * 0.03),
    1,
  );
  rimLight.intensity = 1.15 + Math.sin(elapsed * 1.55) * 0.12;
  starField.rotation.y = elapsed * 0.006;
  dustField.rotation.y = elapsed * 0.012;

  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

function updateCameraFraming() {
  const aspect = window.innerWidth / window.innerHeight;
  const isNarrow = aspect < 0.7;
  const isCompact = aspect >= 0.7 && aspect < 1;

  if (isNarrow) {
    camera.position.set(0, 3.1, 24);
    controls.target.set(-1.8, 0, 0);
    return;
  }

  if (isCompact) {
    camera.position.set(0, 2.8, 16);
    controls.target.set(-1.35, 0, 0);
    return;
  }

  camera.position.set(0, 2.55, 11.8);
  controls.target.set(-1, 0, 0);
}

function handleResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  updateCameraFraming();

  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  tailParticleSystem.material.uniforms.uPixelRatio.value = Math.min(window.devicePixelRatio, 2);
}

window.addEventListener('resize', handleResize);

animate();
