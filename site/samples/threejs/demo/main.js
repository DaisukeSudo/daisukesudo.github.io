import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------- renderer / scene / camera ----------

const canvas = document.querySelector('.stage');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
const FOG_COLOR = new THREE.Color(0x2b1d46);
scene.fog = new THREE.FogExp2(FOG_COLOR, 0.0026);

const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 3000);
camera.position.set(-3.2, 3.4, 16);

const controls = new OrbitControls(camera, canvas);
controls.target.set(0, 1.7, 0);
controls.enableDamping = true;
controls.enablePan = false;
controls.minDistance = 7;
controls.maxDistance = 34;
controls.minPolarAngle = 0.25;
controls.maxPolarAngle = Math.PI * 0.485;
controls.autoRotate = !reduceMotion;
controls.autoRotateSpeed = 0.3;

const SUN_DIR = new THREE.Vector3(0.78, 0.075, -0.62).normalize();
const uniforms = { time: { value: 0 } };

// ---------- sky ----------

const NOISE_GLSL = /* glsl */ `
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x),
               mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
  }
  float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; }
    return v;
  }
`;

const sky = new THREE.Mesh(
  new THREE.SphereGeometry(1400, 48, 24),
  new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: { ...uniforms, sunDir: { value: SUN_DIR } },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 sunDir;
      uniform float time;
      varying vec3 vDir;
      ${NOISE_GLSL}
      void main() {
        vec3 d = normalize(vDir);
        float h = d.y;
        float sunAmt = max(dot(d, sunDir), 0.0);

        vec3 zenith  = vec3(0.004, 0.006, 0.03);
        vec3 mid     = vec3(0.035, 0.022, 0.11);
        vec3 horizon = vec3(0.16, 0.06, 0.18);
        vec3 sunCol  = vec3(1.0, 0.36, 0.1);

        vec3 hor = mix(horizon, sunCol, pow(sunAmt, 12.0));
        float t = clamp(h, 0.0, 1.0);
        vec3 col = mix(hor, mid, smoothstep(0.0, 0.2, t));
        col = mix(col, zenith, smoothstep(0.18, 0.75, t));

        // wispy clouds near the horizon
        if (h > 0.0) {
          vec2 uv = d.xz / (h + 0.06);
          float c = fbm(uv * 0.55 + vec2(time * 0.006, time * 0.002));
          c = smoothstep(0.52, 0.86, c) * smoothstep(0.0, 0.05, h) * (1.0 - smoothstep(0.2, 0.55, h));
          vec3 cloud = mix(vec3(0.07, 0.035, 0.12), vec3(0.7, 0.24, 0.16), pow(sunAmt, 14.0));
          col = mix(col, cloud, c * 0.8);
        }

        // sun disc & glow
        col += sunCol * pow(sunAmt, 40.0) * 0.6;
        col += vec3(1.0, 0.6, 0.35) * pow(sunAmt, 600.0) * 2.0;
        col += vec3(1.0, 0.88, 0.7) * smoothstep(0.99965, 0.99985, sunAmt) * 10.0;

        // below the horizon
        col = mix(col, horizon * 0.25, 1.0 - smoothstep(-0.04, 0.0, h));
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  }),
);
scene.add(sky);

// ---------- stars ----------

const createStars = (count) => {
  const positions = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const phases = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const y = 0.06 + Math.random() * 0.94;
    const a = Math.random() * Math.PI * 2;
    const r = Math.sqrt(1 - y * y);
    positions.set([Math.cos(a) * r * 1200, y * 1200, Math.sin(a) * r * 1200], i * 3);
    sizes[i] = 0.6 + Math.random() ** 3 * 2.6;
    phases[i] = Math.random() * Math.PI * 2;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));

  return new THREE.Points(
    geometry,
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { ...uniforms, pixelRatio: { value: renderer.getPixelRatio() }, sunDir: { value: SUN_DIR } },
      vertexShader: /* glsl */ `
        attribute float aSize;
        attribute float aPhase;
        uniform float time;
        uniform float pixelRatio;
        uniform vec3 sunDir;
        varying float vAlpha;
        void main() {
          vec3 dir = normalize(position);
          float twinkle = 0.6 + 0.4 * sin(time * (1.0 + aPhase * 0.3) + aPhase * 7.0);
          vAlpha = twinkle * smoothstep(0.05, 0.35, dir.y) * (1.0 - pow(max(dot(dir, sunDir), 0.0), 6.0));
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = aSize * pixelRatio * 1.6;
        }
      `,
      fragmentShader: /* glsl */ `
        varying float vAlpha;
        void main() {
          float d = length(gl_PointCoord - 0.5);
          float a = smoothstep(0.5, 0.0, d) * vAlpha;
          gl_FragColor = vec4(vec3(1.0, 0.95, 0.88) * a * 1.4, 1.0);
        }
      `,
    }),
  );
};
const stars = createStars(1400);
scene.add(stars);

// ---------- mountains ----------

const sunAzimuth = Math.atan2(SUN_DIR.z, SUN_DIR.x);

const createMountains = ({ radius, minH, maxH, color, seed }) => {
  const segments = 360;
  const positions = [];
  const indices = [];
  for (let i = 0; i <= segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    const ridge =
      0.5 * Math.abs(Math.sin(a * 3 + seed)) +
      0.3 * Math.abs(Math.sin(a * 7.3 + seed * 2.1)) +
      0.2 * Math.abs(Math.sin(a * 17.1 + seed * 3.7)) +
      0.08 * Math.sin(a * 41 + seed);
    // leave a valley where the sun sets
    const diff = Math.abs(Math.atan2(Math.sin(a - sunAzimuth), Math.cos(a - sunAzimuth)));
    const valley = 0.45 + 0.55 * THREE.MathUtils.smoothstep(diff, 0.0, 0.7);
    const h = (minH + (maxH - minH) * ridge) * valley;
    const x = Math.cos(a) * radius;
    const z = Math.sin(a) * radius;
    positions.push(x, -4, z, x, h, z);
    if (i < segments) {
      const k = i * 2;
      indices.push(k, k + 2, k + 1, k + 1, k + 2, k + 3);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  return new THREE.Mesh(
    geometry,
    new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }),
  );
};

scene.add(createMountains({ radius: 420, minH: 14, maxH: 46, color: 0x1a1230, seed: 1.7 }));
scene.add(createMountains({ radius: 300, minH: 6, maxH: 26, color: 0x0f0a1d, seed: 4.2 }));

// ---------- water ----------

const waterShader = {
  name: 'NeonWaterShader',
  uniforms: {
    color: { value: null },
    tDiffuse: { value: null },
    textureMatrix: { value: null },
    time: uniforms.time,
  },
  vertexShader: /* glsl */ `
    uniform mat4 textureMatrix;
    varying vec4 vUv;
    varying vec3 vWorld;
    void main() {
      vUv = textureMatrix * vec4(position, 1.0);
      vec4 wp = modelMatrix * vec4(position, 1.0);
      vWorld = wp.xyz;
      gl_Position = projectionMatrix * viewMatrix * wp;
    }
  `,
  fragmentShader: /* glsl */ `
    uniform vec3 color;
    uniform sampler2D tDiffuse;
    uniform float time;
    varying vec4 vUv;
    varying vec3 vWorld;
    void main() {
      vec2 p = vWorld.xz;
      vec2 ripple = vec2(
        sin(p.x * 0.9 + time * 1.2) + 0.6 * sin(p.y * 1.7 - time * 0.9) + 0.3 * sin((p.x + p.y) * 3.1 + time * 2.0),
        cos(p.y * 1.1 + time * 1.0) + 0.6 * cos(p.x * 1.5 - time * 1.3) + 0.3 * sin((p.x - p.y) * 2.9 - time * 1.7)
      );
      float dist = length(vWorld.xz - cameraPosition.xz);
      vec4 uv = vUv;
      uv.xy += ripple * 0.0055 * uv.w / (1.0 + dist * 0.04);
      vec3 refl = texture2DProj(tDiffuse, uv).rgb;

      vec3 v = normalize(cameraPosition - vWorld);
      float fresnel = 0.35 + 0.65 * pow(1.0 - max(v.y, 0.0), 4.0);
      gl_FragColor = vec4(refl * color * fresnel, 1.0);
    }
  `,
};

const water = new Reflector(new THREE.PlaneGeometry(4000, 4000), {
  shader: waterShader,
  color: 0xb4b0c8,
  clipBias: 0.003,
  textureWidth: window.innerWidth * renderer.getPixelRatio(),
  textureHeight: window.innerHeight * renderer.getPixelRatio(),
});
water.rotation.x = -Math.PI / 2;
// Reflector は uniforms を複製するので、time だけ共有のものに差し替える
water.material.uniforms.time = uniforms.time;
scene.add(water);

// ---------- cube ----------

const cubeGroup = new THREE.Group();
cubeGroup.position.set(0, 3.0, 0);
scene.add(cubeGroup);

const cubeUniforms = { time: uniforms.time, pulse: { value: 0 } };
const cube = new THREE.Mesh(
  new THREE.BoxGeometry(2.6, 2.6, 2.6),
  new THREE.ShaderMaterial({
    uniforms: cubeUniforms,
    vertexShader: /* glsl */ `
      varying vec3 vNormal;
      varying vec3 vWorldNormal;
      varying vec3 vViewDir;
      varying vec2 vUv;
      void main() {
        vNormal = normal;
        vUv = uv;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldNormal = normalize(mat3(modelMatrix) * normal);
        vViewDir = normalize(cameraPosition - wp.xyz);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float time;
      uniform float pulse;
      varying vec3 vNormal;
      varying vec3 vWorldNormal;
      varying vec3 vViewDir;
      varying vec2 vUv;

      vec3 faceColor(vec3 n) {
        vec3 a = abs(n);
        if (a.y > 0.5) return n.y > 0.0 ? vec3(0.12, 1.0, 0.32) : vec3(1.0, 0.6, 0.08);
        if (a.x > 0.5) return n.x > 0.0 ? vec3(0.08, 0.9, 0.95) : vec3(0.1, 0.22, 1.0);
        return n.z > 0.0 ? vec3(1.0, 0.12, 0.55) : vec3(0.6, 0.15, 1.0);
      }

      void main() {
        vec3 base = faceColor(vNormal);
        float e = min(min(vUv.x, 1.0 - vUv.x), min(vUv.y, 1.0 - vUv.y));
        float edge = smoothstep(0.03, 0.0, e);
        float inner = smoothstep(0.32, 0.0, e);
        float fresnel = pow(1.0 - max(dot(vWorldNormal, vViewDir), 0.0), 2.0);
        float scan = 0.025 * sin(vUv.y * 60.0 - time * 3.0);

        vec3 col = base * (0.28 + 0.3 * inner + 0.3 * fresnel + scan);
        col += mix(base, vec3(1.0), 0.2) * edge * (2.0 + pulse * 3.0);
        col += base * pulse * 0.6;
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  }),
);
cube.rotation.set(0.42, Math.PI / 4, 0);
cubeGroup.add(cube);

// soft light on the water just below the cube
const halo = new THREE.Mesh(
  new THREE.CircleGeometry(6, 64),
  new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: cubeUniforms,
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float pulse;
      varying vec2 vUv;
      void main() {
        vec2 p = vUv - 0.5;
        float r = length(p) * 2.0;
        float a = pow(1.0 - clamp(r, 0.0, 1.0), 3.0) * (0.22 + pulse * 0.4);
        vec3 col = mix(vec3(0.15, 0.3, 1.0), vec3(1.0, 0.2, 0.6), smoothstep(-0.4, 0.4, p.x));
        gl_FragColor = vec4(col * a, 1.0);
      }
    `,
  }),
);
halo.rotation.x = -Math.PI / 2;
halo.position.y = 0.02;
scene.add(halo);

// ---------- orbit rings ----------

const createRing = ({ radius, color, speed, dir, tiltX, tiltZ }) => {
  const mesh = new THREE.Mesh(
    new THREE.TorusGeometry(radius, 0.022, 8, 512),
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { time: uniforms.time, color: { value: new THREE.Color(color) }, speed: { value: speed }, dir: { value: dir } },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float time;
        uniform vec3 color;
        uniform float speed;
        uniform float dir;
        varying vec2 vUv;
        void main() {
          float a = fract(dir * vUv.x - time * speed);
          float i = 0.06 + pow(a, 5.0) * 1.4 + pow(a, 60.0) * 4.0;
          gl_FragColor = vec4(color * i, 1.0);
        }
      `,
    }),
  );
  mesh.rotation.set(Math.PI / 2 + tiltX, 0, tiltZ);
  return mesh;
};

const rings = [
  createRing({ radius: 4.6, color: 0xffc89a, speed: 0.07, dir: 1, tiltX: 0.2, tiltZ: -0.16 }),
  createRing({ radius: 3.7, color: 0x9ab8ff, speed: 0.1, dir: -1, tiltX: -0.38, tiltZ: 0.3 }),
];
rings.forEach((ring) => cubeGroup.add(ring));

// ---------- sparkles ----------

const createSparkles = (count) => {
  const geometry = new THREE.BufferGeometry();
  const seeds = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) {
    seeds.set([
      2.4 + Math.random() * 4.5, // radius
      Math.random() * Math.PI * 2, // angle
      (Math.random() - 0.5) * 5, // height
      (0.05 + Math.random() * 0.25) * (Math.random() < 0.5 ? -1 : 1), // speed
    ], i * 4);
  }
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
  geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 4));
  const points = new THREE.Points(
    geometry,
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { time: uniforms.time, scale: { value: 1 } },
      vertexShader: /* glsl */ `
        attribute vec4 aSeed;
        uniform float time;
        uniform float scale;
        varying float vAlpha;
        void main() {
          float a = aSeed.y + time * aSeed.w;
          vec3 p = vec3(cos(a) * aSeed.x, aSeed.z + sin(time * 0.6 + aSeed.y * 3.0) * 0.3, sin(a) * aSeed.x);
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          vAlpha = 0.4 + 0.6 * sin(time * 2.0 + aSeed.y * 11.0) * 0.5 + 0.3;
          gl_PointSize = scale * 0.045 / -mv.z;
        }
      `,
      fragmentShader: /* glsl */ `
        varying float vAlpha;
        void main() {
          float d = length(gl_PointCoord - 0.5);
          float a = smoothstep(0.5, 0.0, d) * vAlpha;
          gl_FragColor = vec4(vec3(1.0, 0.78, 0.55) * a * 0.9, 1.0);
        }
      `,
    }),
  );
  points.frustumCulled = false;
  return points;
};
const sparkles = createSparkles(160);
cubeGroup.add(sparkles);

// ---------- ripples on the water ----------

const ripples = [];
const rippleGeometry = new THREE.RingGeometry(0.96, 1, 128);

const spawnRipple = (strength = 1) => {
  const mesh = new THREE.Mesh(
    rippleGeometry,
    new THREE.MeshBasicMaterial({
      color: new THREE.Color(0.45, 0.55, 1.0).multiplyScalar(0.7 * strength),
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      fog: false,
    }),
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(cubeGroup.position.x, 0.03, cubeGroup.position.z);
  scene.add(mesh);
  ripples.push({ mesh, age: 0, life: 3.2, strength });
};

const updateRipples = (dt) => {
  for (let i = ripples.length - 1; i >= 0; i--) {
    const r = ripples[i];
    r.age += dt;
    const t = r.age / r.life;
    if (t >= 1) {
      scene.remove(r.mesh);
      r.mesh.material.dispose();
      ripples.splice(i, 1);
      continue;
    }
    const s = 1.6 + t * 16;
    r.mesh.scale.set(s, s, s);
    r.mesh.material.opacity = (1 - t) ** 2;
  }
};

// ---------- interaction ----------

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let spin = 0;
let downAt = null;

canvas.addEventListener('pointerdown', (e) => {
  downAt = { x: e.clientX, y: e.clientY };
});

canvas.addEventListener('pointerup', (e) => {
  if (!downAt || Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 6) return;
  pointer.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
  raycaster.setFromCamera(pointer, camera);
  if (raycaster.intersectObject(cube).length) {
    cubeUniforms.pulse.value = 1;
    spin = 6;
    spawnRipple(1);
    setTimeout(() => spawnRipple(0.6), 180);
  }
});

canvas.addEventListener('pointermove', (e) => {
  if (e.pointerType !== 'mouse') return;
  pointer.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
  raycaster.setFromCamera(pointer, camera);
  canvas.style.cursor = raycaster.intersectObject(cube).length ? 'pointer' : '';
});

// ---------- post processing ----------

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.75, 0.5, 0.55);
composer.addPass(bloom);
composer.addPass(new OutputPass());

// ---------- resize ----------

const resize = () => {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const pr = renderer.getPixelRatio();
  renderer.setSize(w, h, false);
  composer.setSize(w, h);
  camera.aspect = w / h;
  // keep the cube framed on portrait screens
  camera.fov = w / h < 0.8 ? 58 : 42;
  camera.updateProjectionMatrix();
  water.getRenderTarget().setSize(w * pr, h * pr);
  sparkles.material.uniforms.scale.value = (h * pr) / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2)) * 1.2;
};
window.addEventListener('resize', resize);
resize();

// ---------- loop ----------

const clock = new THREE.Clock();
let nextAutoRipple = 2;

renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.1);
  const t = clock.elapsedTime;
  uniforms.time.value = t;

  cubeGroup.position.y = 3.0 + Math.sin(t * 0.8) * 0.22;
  spin *= Math.exp(-dt * 1.6);
  cube.rotation.y += dt * (reduceMotion ? 0.05 : 0.22 + spin);
  rings[0].rotation.z += dt * 0.05;
  rings[1].rotation.z -= dt * 0.07;
  cubeUniforms.pulse.value *= Math.exp(-dt * 2.2);

  if (!reduceMotion && t > nextAutoRipple) {
    spawnRipple(0.35);
    nextAutoRipple = t + 4.5;
  }
  updateRipples(dt);

  controls.update();
  composer.render();
});
