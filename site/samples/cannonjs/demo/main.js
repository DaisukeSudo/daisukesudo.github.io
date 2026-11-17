import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

// ref: https://github.com/pmndrs/cannon-es/blob/master/examples/raycast_vehicle.html

const rand = (min, max) => min + Math.random() * (max - min);

// ---------- renderer / scene / camera ----------

const canvas = document.querySelector('.stage');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const FOG_COLOR = new THREE.Color(0x3a2440);
scene.fog = new THREE.Fog(FOG_COLOR, 50, 330);

const camera = new THREE.PerspectiveCamera(55, 1, 0.3, 2500);
camera.position.set(18, 5, 4);

// The car faces -x, so the sun sits ahead of it
const SUN_DIR = new THREE.Vector3(-1, 0.1, 0.32).normalize();

// ---------- sky ----------

const sky = new THREE.Mesh(
  new THREE.SphereGeometry(1200, 48, 24),
  new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: { sunDir: { value: SUN_DIR }, fogColor: { value: FOG_COLOR } },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 sunDir;
      uniform vec3 fogColor;
      varying vec3 vDir;
      void main() {
        vec3 d = normalize(vDir);
        float h = d.y;
        float sunAmt = max(dot(d, sunDir), 0.0);
        vec3 zenith = vec3(0.02, 0.02, 0.07);
        vec3 mid = vec3(0.1, 0.06, 0.2);
        vec3 sunCol = vec3(1.0, 0.42, 0.14);
        vec3 hor = mix(fogColor, sunCol, pow(sunAmt, 6.0) * 0.85);
        vec3 col = mix(hor, mid, smoothstep(0.0, 0.22, h));
        col = mix(col, zenith, smoothstep(0.2, 0.8, h));
        col += sunCol * pow(sunAmt, 60.0) * 0.6;
        col += vec3(1.0, 0.72, 0.45) * pow(sunAmt, 500.0) * 3.0;
        col += vec3(1.0, 0.9, 0.75) * smoothstep(0.9996, 0.9998, sunAmt) * 8.0;
        col = mix(col, fogColor, 1.0 - smoothstep(-0.02, 0.02, h));
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  }),
);
scene.add(sky);

// environment map for metallic surfaces (rendered from the sky)
{
  const envScene = new THREE.Scene();
  envScene.add(sky.clone());
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(envScene, 0, 1, 2000).texture;
  scene.environmentIntensity = 0.7;
  pmrem.dispose();
}

// ---------- lights ----------

scene.add(new THREE.HemisphereLight(0x7c6aa8, 0x3a2224, 1.1));

const sun = new THREE.DirectionalLight(0xffa066, 4.2);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -40, right: 40, top: 40, bottom: -40, near: 1, far: 260 });
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.04;
scene.add(sun, sun.target);

const backLight = new THREE.DirectionalLight(0x7a6cff, 0.7);
backLight.position.set(60, 40, -30);
scene.add(backLight);

// ---------- physics world ----------

const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -9.82, 0) });
world.broadphase = new CANNON.SAPBroadphase(world);
world.allowSleep = true;
world.defaultContactMaterial.friction = 0.3;
world.defaultContactMaterial.restitution = 0.1;

const groundMaterial = new CANNON.Material('ground');
const boxMaterial = new CANNON.Material('box');
const ballMaterial = new CANNON.Material('ball');
const chassisMaterial = new CANNON.Material('chassis');
world.addContactMaterial(new CANNON.ContactMaterial(groundMaterial, ballMaterial, { friction: 0.3, restitution: 0.72 }));
world.addContactMaterial(new CANNON.ContactMaterial(boxMaterial, ballMaterial, { friction: 0.3, restitution: 0.5 }));
world.addContactMaterial(new CANNON.ContactMaterial(groundMaterial, boxMaterial, { friction: 0.6, restitution: 0.12 }));
world.addContactMaterial(new CANNON.ContactMaterial(groundMaterial, chassisMaterial, { friction: 0.1, restitution: 0.05 }));

// ---------- terrain ----------

const GRID = 128;
const CELL = 4;
const HALF = (GRID * CELL) / 2;

const smoothstep = (e0, e1, x) => {
  const t = Math.min(Math.max((x - e0) / (e1 - e0), 0), 1);
  return t * t * (3 - 2 * t);
};

// gentle dunes outside of a flat arena, rising into a wall of dunes at the edge
const WALL = 228;
const heightAt = (x, z) => {
  const r = Math.hypot(x, z);
  const m = Math.max(Math.abs(x), Math.abs(z));
  const ring = smoothstep(42, 95, r);
  const n =
    0.5 +
    0.32 * Math.sin(x * 0.045 + 1.3) * Math.cos(z * 0.038) +
    0.12 * Math.sin(x * 0.11 - z * 0.07) +
    0.06 * Math.sin(z * 0.17 + x * 0.03);
  const edge = smoothstep(165, WALL, m) * (1 - smoothstep(242, HALF, m));
  return (11 * Math.pow(Math.max(n, 0), 1.6) * ring + 22 * edge * (0.7 + 0.3 * n)) * (1 - smoothstep(244, HALF, m));
};

const createGroundTexture = () => {
  const size = 512;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#8a7068';
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 9000; i++) {
    const v = Math.random();
    ctx.fillStyle = v < 0.5 ? `rgba(40,25,25,${rand(0.05, 0.22)})` : `rgba(255,220,200,${rand(0.03, 0.12)})`;
    const s = rand(1, 3.5);
    ctx.fillRect(Math.random() * size, Math.random() * size, s, s);
  }
  for (let i = 0; i < 60; i++) {
    ctx.strokeStyle = `rgba(50,30,30,${rand(0.04, 0.1)})`;
    ctx.lineWidth = rand(1, 3);
    ctx.beginPath();
    const y = Math.random() * size;
    ctx.moveTo(0, y);
    ctx.bezierCurveTo(size * 0.3, y + rand(-30, 30), size * 0.7, y + rand(-30, 30), size, y);
    ctx.stroke();
  }
  const texture = new THREE.CanvasTexture(c);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return texture;
};

const groundMat = new THREE.MeshStandardMaterial({ map: createGroundTexture(), color: 0xb09088, roughness: 0.95 });

{
  // physics: heightfield
  const data = [];
  for (let i = 0; i <= GRID; i++) {
    data.push([]);
    for (let j = 0; j <= GRID; j++) {
      data[i].push(heightAt(i * CELL - HALF, HALF - j * CELL));
    }
  }
  const body = new CANNON.Body({ mass: 0, material: groundMaterial });
  body.addShape(new CANNON.Heightfield(data, { elementSize: CELL }));
  body.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
  body.position.set(-HALF, 0, HALF);
  world.addBody(body);

  // visuals: same grid
  const positions = [];
  const uvs = [];
  const indices = [];
  for (let i = 0; i <= GRID; i++) {
    for (let j = 0; j <= GRID; j++) {
      const x = i * CELL - HALF;
      const z = HALF - j * CELL;
      positions.push(x, data[i][j], z);
      uvs.push(x / 10, z / 10);
    }
  }
  const idx = (i, j) => i * (GRID + 1) + j;
  for (let i = 0; i < GRID; i++) {
    for (let j = 0; j < GRID; j++) {
      indices.push(idx(i, j), idx(i + 1, j), idx(i, j + 1));
      indices.push(idx(i + 1, j), idx(i + 1, j + 1), idx(i, j + 1));
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, groundMat);
  mesh.receiveShadow = true;
  scene.add(mesh);

  // invisible walls keep everything inside the dunes
  [[WALL, 0, 0], [-WALL, 0, 0], [0, WALL, Math.PI / 2], [0, -WALL, Math.PI / 2]].forEach(([x, z, rot]) => {
    const wall = new CANNON.Body({ mass: 0, material: groundMaterial, shape: new CANNON.Box(new CANNON.Vec3(1, 60, WALL)) });
    wall.position.set(x, 30, z);
    wall.quaternion.setFromEuler(0, rot, 0);
    world.addBody(wall);
  });

  // visual ground beyond the heightfield
  const outerGeometry = new THREE.PlaneGeometry(4000, 4000);
  outerGeometry.rotateX(-Math.PI / 2);
  const uv = outerGeometry.attributes.uv;
  for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k) * 400, uv.getY(k) * 400);
  const outer = new THREE.Mesh(outerGeometry, groundMat);
  outer.position.y = -0.4;
  outer.receiveShadow = true;
  scene.add(outer);
}

// ramp
{
  const size = new CANNON.Vec3(5, 0.3, 3.5);
  const body = new CANNON.Body({ mass: 0, material: groundMaterial, shape: new CANNON.Box(size) });
  body.position.set(-30, 0.9, 16);
  body.quaternion.setFromEuler(0, 0, -0.24);
  world.addBody(body);
  const mesh = new THREE.Mesh(
    new RoundedBoxGeometry(size.x * 2, size.y * 2, size.z * 2, 2, 0.1),
    new THREE.MeshStandardMaterial({ color: 0x5c4a52, roughness: 0.7, metalness: 0.2 }),
  );
  mesh.position.copy(body.position);
  mesh.quaternion.copy(body.quaternion);
  mesh.castShadow = mesh.receiveShadow = true;
  scene.add(mesh);
}

// ---------- dynamic objects ----------

const dynamics = []; // { body, mesh, trail? }

const BOX = 1.2;
const boxGeometry = new RoundedBoxGeometry(BOX, BOX, BOX, 2, 0.08);
const boxMats = [0xd9c8bc, 0xcbb5aa, 0xe6d6c8].map(
  (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.05 }),
);
const ballGeometry = new THREE.SphereGeometry(0.7, 32, 16);
const ballMat = new THREE.MeshStandardMaterial({ color: 0xe8dcd4, roughness: 0.25, metalness: 0.3 });

const addBox = (position, { asleep = false } = {}) => {
  const body = new CANNON.Body({
    mass: 8,
    material: boxMaterial,
    shape: new CANNON.Box(new CANNON.Vec3(BOX / 2, BOX / 2, BOX / 2)),
    position: new CANNON.Vec3(position.x, position.y, position.z),
    sleepSpeedLimit: 0.3,
    sleepTimeLimit: 0.5,
  });
  world.addBody(body);
  if (asleep) body.sleep();
  const mesh = new THREE.Mesh(boxGeometry, boxMats[Math.floor(Math.random() * boxMats.length)]);
  mesh.castShadow = mesh.receiveShadow = true;
  scene.add(mesh);
  const item = { body, mesh };
  dynamics.push(item);
  return item;
};

const addBall = (position) => {
  const body = new CANNON.Body({
    mass: 6,
    material: ballMaterial,
    shape: new CANNON.Sphere(0.7),
    position: new CANNON.Vec3(position.x, position.y, position.z),
    linearDamping: 0.05,
    angularDamping: 0.2,
  });
  world.addBody(body);
  const mesh = new THREE.Mesh(ballGeometry, ballMat);
  mesh.castShadow = mesh.receiveShadow = true;
  scene.add(mesh);
  const item = { body, mesh };
  dynamics.push(item);
  return item;
};

// pyramid walls facing the start position
const buildPyramid = (cx, cz, base, angle) => {
  const dir = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
  for (let row = 0; row < base; row++) {
    const count = base - row;
    for (let k = 0; k < count; k++) {
      const offset = (k - (count - 1) / 2) * (BOX + 0.02);
      addBox(new THREE.Vector3(cx + dir.x * offset, BOX / 2 + row * BOX + 0.01, cz + dir.z * offset), { asleep: true });
    }
  }
};

const buildTower = (cx, cz, w, h) => {
  for (let y = 0; y < h; y++) {
    for (let a = 0; a < w; a++) {
      for (let b = 0; b < w; b++) {
        addBox(
          new THREE.Vector3(cx + (a - (w - 1) / 2) * (BOX + 0.02), BOX / 2 + y * BOX + 0.01, cz + (b - (w - 1) / 2) * (BOX + 0.02)),
          { asleep: true },
        );
      }
    }
  }
};

buildPyramid(-24, 0, 6, Math.PI / 2);
buildTower(-38, -16, 3, 4);
buildPyramid(-10, -24, 4, 0.3);
buildPyramid(-14, 24, 4, -0.4);
buildTower(14, -18, 2, 5);

// ---------- trails ----------

const TRAIL_LENGTH = 48;
const trails = [];

const attachTrail = (item, color) => {
  const positions = new Float32Array(TRAIL_LENGTH * 3);
  const colors = new Float32Array(TRAIL_LENGTH * 3);
  const p = item.body.position;
  for (let i = 0; i < TRAIL_LENGTH; i++) positions.set([p.x, p.y, p.z], i * 3);
  const c = new THREE.Color(color);
  for (let i = 0; i < TRAIL_LENGTH; i++) {
    const f = (1 - i / (TRAIL_LENGTH - 1)) ** 2;
    colors.set([c.r * f, c.g * f, c.b * f], i * 3);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const line = new THREE.Line(
    geometry,
    new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  line.frustumCulled = false;
  scene.add(line);
  item.trail = line;
  trails.push(item);
};

const updateTrails = () => {
  for (const item of trails) {
    const attr = item.trail.geometry.attributes.position;
    attr.array.copyWithin(3, 0, (TRAIL_LENGTH - 1) * 3);
    const p = item.body.position;
    attr.array[0] = p.x;
    attr.array[1] = p.y;
    attr.array[2] = p.z;
    attr.needsUpdate = true;
  }
};

// ---------- particles (sparks & dust) ----------

const createParticles = ({ count, blending, fragment }) => {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
  geometry.setAttribute('aLife', new THREE.BufferAttribute(new Float32Array(count), 1));
  geometry.setAttribute('aSize', new THREE.BufferAttribute(new Float32Array(count), 1));
  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending,
    uniforms: { scale: { value: 1 } },
    vertexShader: /* glsl */ `
      attribute float aLife;
      attribute float aSize;
      uniform float scale;
      varying float vLife;
      void main() {
        vLife = aLife;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = aLife > 0.0 ? aSize * scale / -mv.z : 0.0;
      }
    `,
    fragmentShader: fragment,
  });
  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  scene.add(points);

  const state = Array.from({ length: count }, () => ({
    p: new THREE.Vector3(), v: new THREE.Vector3(), age: 0, life: 0, size: 0, grow: 0, drag: 0, gravity: 0,
  }));
  let cursor = 0;

  return {
    material,
    emit(p, v, { life, size, grow = 0, drag = 0, gravity = 0 }) {
      const s = state[cursor];
      cursor = (cursor + 1) % count;
      s.p.copy(p);
      s.v.copy(v);
      Object.assign(s, { age: 0, life, size, grow, drag, gravity });
    },
    update(dt) {
      const pos = geometry.attributes.position.array;
      const life = geometry.attributes.aLife.array;
      const size = geometry.attributes.aSize.array;
      for (let i = 0; i < count; i++) {
        const s = state[i];
        if (s.life <= 0) {
          life[i] = 0;
          continue;
        }
        s.age += dt;
        if (s.age >= s.life) {
          s.life = 0;
          life[i] = 0;
          continue;
        }
        s.v.y -= s.gravity * dt;
        s.v.multiplyScalar(Math.exp(-s.drag * dt));
        s.p.addScaledVector(s.v, dt);
        const g = heightAt(s.p.x, s.p.z);
        if (s.p.y < g) {
          s.p.y = g;
          s.v.y *= -0.35;
        }
        pos[i * 3] = s.p.x;
        pos[i * 3 + 1] = s.p.y;
        pos[i * 3 + 2] = s.p.z;
        life[i] = 1 - s.age / s.life;
        size[i] = s.size + s.grow * s.age;
      }
      geometry.attributes.position.needsUpdate = true;
      geometry.attributes.aLife.needsUpdate = true;
      geometry.attributes.aSize.needsUpdate = true;
    },
  };
};

const sparks = createParticles({
  count: 700,
  blending: THREE.AdditiveBlending,
  fragment: /* glsl */ `
    varying float vLife;
    void main() {
      float d = length(gl_PointCoord - 0.5);
      float a = smoothstep(0.5, 0.0, d) * vLife;
      vec3 col = mix(vec3(1.0, 0.25, 0.05), vec3(1.0, 0.85, 0.5), vLife);
      gl_FragColor = vec4(col * a * 3.0, 1.0);
    }
  `,
});

const dust = createParticles({
  count: 600,
  blending: THREE.NormalBlending,
  fragment: /* glsl */ `
    varying float vLife;
    void main() {
      float d = length(gl_PointCoord - 0.5);
      float a = smoothstep(0.5, 0.05, d) * vLife * vLife * 0.32;
      gl_FragColor = vec4(vec3(0.92, 0.6, 0.42), a);
    }
  `,
});

const tmpV = new THREE.Vector3();
const tmpP = new THREE.Vector3();

const burstSparks = (point, strength) => {
  const n = Math.min(10 + strength * 5, 50);
  for (let i = 0; i < n; i++) {
    tmpV.set(rand(-1, 1), rand(0.3, 1.4), rand(-1, 1)).normalize().multiplyScalar(rand(2, 5 + strength * 0.8));
    sparks.emit(point, tmpV, { life: rand(0.35, 0.9), size: rand(0.08, 0.18), gravity: 14, drag: 1.2 });
  }
  for (let i = 0; i < n / 2; i++) {
    tmpV.set(rand(-1, 1), rand(0.2, 0.8), rand(-1, 1)).multiplyScalar(rand(1, 3));
    dust.emit(point, tmpV, { life: rand(1.2, 2.4), size: rand(0.8, 1.6), grow: 1.6, drag: 1.8, gravity: -0.3 });
  }
};

const contactPoint = (e, body, out) => {
  const c = e.contact;
  const [b, r] = c.bi === body ? [c.bi, c.ri] : [c.bj, c.rj];
  return out.set(b.position.x + r.x, b.position.y + r.y, b.position.z + r.z);
};

// ---------- vehicle ----------

const WHEEL_RADIUS = 0.62;
// lift the shape above the body origin = lower center of mass (harder to roll over)
const COM_OFFSET = 0.35;
const chassisBody = new CANNON.Body({ mass: 150, material: chassisMaterial });
chassisBody.addShape(new CANNON.Box(new CANNON.Vec3(2.1, 0.3, 0.78)), new CANNON.Vec3(0, COM_OFFSET, 0));
chassisBody.position.set(10, 3, 0);
chassisBody.angularDamping = 0.3;
chassisBody.allowSleep = false;
chassisBody.sleepSpeedLimit = 0; // any touch from the car wakes sleeping boxes

const vehicle = new CANNON.RaycastVehicle({ chassisBody });
const wheelOptions = {
  radius: WHEEL_RADIUS,
  directionLocal: new CANNON.Vec3(0, -1, 0),
  suspensionStiffness: 32,
  suspensionRestLength: 0.42,
  frictionSlip: 1.7,
  dampingRelaxation: 2.3,
  dampingCompression: 4.4,
  maxSuspensionForce: 100000,
  rollInfluence: 0.01,
  axleLocal: new CANNON.Vec3(0, 0, 1),
  chassisConnectionPointLocal: new CANNON.Vec3(),
  maxSuspensionTravel: 0.35,
  customSlidingRotationalSpeed: -30,
  useCustomSlidingRotationalSpeed: true,
};
[
  [-1.45, 1.08], // front left
  [-1.45, -1.08], // front right
  [1.45, 1.08], // rear left
  [1.45, -1.08], // rear right
].forEach(([x, z]) => {
  wheelOptions.chassisConnectionPointLocal.set(x, COM_OFFSET, z);
  vehicle.addWheel(wheelOptions);
});
vehicle.addToWorld(world);

chassisBody.addEventListener('collide', (e) => {
  const v = Math.abs(e.contact.getImpactVelocityAlongNormal());
  if (v > 3) burstSparks(contactPoint(e, chassisBody, tmpP), v);
});

// car visuals
const car = new THREE.Group();
scene.add(car);
const carBody = new THREE.Group();
carBody.position.y = COM_OFFSET;
car.add(carBody);
{
  const metal = new THREE.MeshStandardMaterial({ color: 0x2b2c33, metalness: 0.85, roughness: 0.32 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x15161b, metalness: 0.4, roughness: 0.5 });
  const glowOrange = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xff7a2e, emissiveIntensity: 4 });
  const glowWhite = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xfff2e0, emissiveIntensity: 6 });
  const glowRed = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xff2030, emissiveIntensity: 4 });

  const body = new THREE.Mesh(new RoundedBoxGeometry(4.2, 0.6, 1.56, 4, 0.24), metal);
  const deck = new THREE.Mesh(new RoundedBoxGeometry(3.0, 0.22, 1.2, 3, 0.1), dark);
  deck.position.y = 0.38;
  const stripL = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.05, 0.04), glowOrange);
  stripL.position.set(0, 0.05, 0.79);
  const stripR = stripL.clone();
  stripR.position.z = -0.79;
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.1, 0.32), glowWhite);
  head.position.set(-2.11, 0.04, 0.48);
  const head2 = head.clone();
  head2.position.z = -0.48;
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.08, 0.36), glowRed);
  tail.position.set(2.11, 0.06, 0.46);
  const tail2 = tail.clone();
  tail2.position.z = -0.46;
  [body, deck].forEach((m) => { m.castShadow = true; m.receiveShadow = true; });
  carBody.add(body, deck, stripL, stripR, head, head2, tail, tail2);

  const headlight = new THREE.SpotLight(0xfff0dd, 60, 45, 0.45, 0.6, 1.4);
  headlight.position.set(-2.0, 0.1, 0);
  headlight.target.position.set(-12, -1, 0);
  carBody.add(headlight, headlight.target);
}

const wheels = vehicle.wheelInfos.map(() => {
  const group = new THREE.Group();
  const tireGeometry = new THREE.CylinderGeometry(WHEEL_RADIUS, WHEEL_RADIUS, 0.52, 40, 1);
  tireGeometry.rotateX(Math.PI / 2);
  const tire = new THREE.Mesh(tireGeometry, new THREE.MeshStandardMaterial({ color: 0x141418, roughness: 0.85 }));
  const rimGeometry = new THREE.CylinderGeometry(WHEEL_RADIUS * 0.62, WHEEL_RADIUS * 0.62, 0.54, 24, 1);
  rimGeometry.rotateX(Math.PI / 2);
  const rim = new THREE.Mesh(rimGeometry, new THREE.MeshStandardMaterial({ color: 0x9a9aa6, metalness: 0.9, roughness: 0.25 }));
  const spoke = new THREE.Mesh(
    new THREE.BoxGeometry(WHEEL_RADIUS * 1.15, 0.12, 0.56),
    new THREE.MeshStandardMaterial({ color: 0x2a2a30, metalness: 0.6, roughness: 0.4 }),
  );
  const spoke2 = spoke.clone();
  spoke2.rotation.z = Math.PI / 2;
  const ringGeometry = new THREE.TorusGeometry(WHEEL_RADIUS * 0.82, 0.02, 6, 48);
  const ringMat = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xff7a2e, emissiveIntensity: 3 });
  const ringA = new THREE.Mesh(ringGeometry, ringMat);
  ringA.position.z = 0.265;
  const ringB = ringA.clone();
  ringB.position.z = -0.265;
  tire.castShadow = true;
  group.add(tire, rim, spoke, spoke2, ringA, ringB);
  scene.add(group);
  return group;
});

// ---------- input ----------

const input = { up: false, down: false, left: false, right: false, brake: false, boost: false };
const keyMap = {
  KeyW: 'up', ArrowUp: 'up',
  KeyS: 'down', ArrowDown: 'down',
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
  Space: 'brake',
  ShiftLeft: 'boost', ShiftRight: 'boost',
};

window.addEventListener('keydown', (e) => {
  // Ctrl+S などのブラウザのショートカットや、ボタン上の Space は邪魔しない
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.code === 'Space' && e.target.closest('button, a')) return;
  if (keyMap[e.code]) {
    input[keyMap[e.code]] = true;
    e.preventDefault();
  }
  if (e.code === 'KeyR' && !e.repeat) resetCar();
});
window.addEventListener('keyup', (e) => {
  if (keyMap[e.code]) input[keyMap[e.code]] = false;
});
window.addEventListener('blur', () => Object.keys(input).forEach((k) => (input[k] = false)));

document.querySelector('[data-action="reset"]').addEventListener('click', () => resetCar());

document.querySelectorAll('.pad button').forEach((button) => {
  const key = button.dataset.key;
  const set = (on) => {
    if (key) input[key] = on;
    button.classList.toggle('is-active', on);
  };
  button.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    button.setPointerCapture(e.pointerId);
    set(true);
  });
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((type) => button.addEventListener(type, () => set(false)));
  button.addEventListener('contextmenu', (e) => e.preventDefault());
});

// drag to look around
const look = { yaw: 0, pitch: 0, dragging: false, x: 0, y: 0 };
canvas.addEventListener('pointerdown', (e) => {
  look.dragging = true;
  look.x = e.clientX;
  look.y = e.clientY;
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove', (e) => {
  if (!look.dragging) return;
  look.yaw -= (e.clientX - look.x) * 0.006;
  look.pitch = THREE.MathUtils.clamp(look.pitch + (e.clientY - look.y) * 0.004, -0.25, 0.9);
  look.x = e.clientX;
  look.y = e.clientY;
});
['pointerup', 'pointercancel'].forEach((type) => canvas.addEventListener(type, () => (look.dragging = false)));

// ---------- vehicle control ----------

const resetCar = ({ back = 0 } = {}) => {
  const p = chassisBody.position;
  if (p.y < -20) p.set(10, 0, 0);
  const yaw = Math.atan2(-forward.z, -forward.x);
  const x = p.x - forward.x * back;
  const z = p.z - forward.z * back;
  chassisBody.position.set(x, heightAt(x, z) + 2.5, z);
  chassisBody.quaternion.setFromEuler(0, yaw, 0);
  chassisBody.velocity.setZero();
  chassisBody.angularVelocity.setZero();
};

const forward = new THREE.Vector3(-1, 0, 0);
let steer = 0;

const driveVehicle = (dt, speed) => {
  const forwardSpeed = -chassisBody.vectorToLocalFrame(chassisBody.velocity).x;
  const maxForce = input.boost ? 1800 : 1100;
  const topSpeed = input.boost ? 36 : 24; // m/s
  let engine = 0;
  let brake = 0;

  if (input.up) engine = -maxForce * Math.max(0, 1 - Math.max(forwardSpeed, 0) / topSpeed);
  if (input.down) {
    // brake first, then reverse
    if (forwardSpeed > 1) brake = 10;
    else engine = maxForce * 0.6;
  }
  if (input.brake) brake = 14;
  if (!input.up && !input.down && !input.brake) brake = 1.2;

  // 4WD: easier to climb out of the rubble
  for (let i = 0; i < 4; i++) vehicle.applyEngineForce(engine * (i < 2 ? 0.4 : 0.6), i);
  for (let i = 0; i < 4; i++) vehicle.setBrake(brake, i);

  const maxSteer = 0.55 / (1 + speed * 0.035);
  const target = (input.left ? maxSteer : 0) - (input.right ? maxSteer : 0);
  steer += (target - steer) * Math.min(1, dt * 8);
  vehicle.setSteeringValue(steer, 0);
  vehicle.setSteeringValue(steer, 1);
};

// ---------- rain of objects ----------

let rainTimer = 1.5;
const RAIN_MAX = 40;
const rainItems = [];

const spawnRain = () => {
  const car = chassisBody.position;
  const a = rand(0, Math.PI * 2);
  const r = rand(6, 26);
  const x = car.x + forward.x * 14 + Math.cos(a) * r;
  const z = car.z + forward.z * 14 + Math.sin(a) * r;
  const y = heightAt(x, z) + rand(22, 34);
  const isBall = Math.random() < 0.55;
  const item = isBall ? addBall({ x, y, z }) : addBox({ x, y, z });
  item.body.velocity.set(rand(-4, 4), rand(-10, -4), rand(-4, 4));
  item.body.angularVelocity.set(rand(-4, 4), rand(-4, 4), rand(-4, 4));
  item.body.addEventListener('collide', (e) => {
    const v = Math.abs(e.contact.getImpactVelocityAlongNormal());
    if (v > 5) burstSparks(contactPoint(e, item.body, tmpP), v * 0.7);
  });
  attachTrail(item, isBall ? 0xffb47a : 0xffd2b0);
  rainItems.push(item);

  if (rainItems.length > RAIN_MAX) {
    const old = rainItems.shift();
    world.removeBody(old.body);
    scene.remove(old.mesh, old.trail);
    old.trail.geometry.dispose();
    old.trail.material.dispose();
    dynamics.splice(dynamics.indexOf(old), 1);
    trails.splice(trails.indexOf(old), 1);
  }
};

// ---------- camera follow ----------

const camTarget = new THREE.Vector3();
const camDesired = new THREE.Vector3();
const lookAt = new THREE.Vector3();
let camReady = false;

const updateCamera = (dt) => {
  const p = chassisBody.position;
  if (!look.dragging) {
    look.yaw *= Math.exp(-dt * 1.2);
    look.pitch *= Math.exp(-dt * 1.2);
  }
  const baseYaw = Math.atan2(forward.z, forward.x) + Math.PI;
  const yaw = baseYaw + look.yaw;
  const dist = window.innerWidth / window.innerHeight < 0.8 ? 12 : 9.5;
  const height = 3.2 + look.pitch * 8;
  camDesired.set(p.x + Math.cos(yaw) * dist, p.y + height, p.z + Math.sin(yaw) * dist);
  camDesired.y = Math.max(camDesired.y, heightAt(camDesired.x, camDesired.z) + 1.2);
  if (!camReady) {
    camera.position.copy(camDesired);
    camReady = true;
  }
  camera.position.lerp(camDesired, 1 - Math.exp(-dt * 4));
  camTarget.set(p.x + forward.x * 3, p.y + 0.8, p.z + forward.z * 3);
  lookAt.lerp(camTarget, 1 - Math.exp(-dt * 8));
  camera.lookAt(lookAt);
};

// ---------- post processing ----------

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
composer.addPass(new UnrealBloomPass(new THREE.Vector2(1, 1), 0.55, 0.45, 0.85));
composer.addPass(new OutputPass());

const resize = () => {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h, false);
  composer.setSize(w, h);
  camera.aspect = w / h;
  camera.fov = w / h < 0.8 ? 70 : 55;
  camera.updateProjectionMatrix();
  const scale = (h * renderer.getPixelRatio()) / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
  sparks.material.uniforms.scale.value = scale;
  dust.material.uniforms.scale.value = scale;
};
window.addEventListener('resize', resize);
resize();

// ---------- loop ----------

const speedLabel = document.querySelector('[data-speed]');
const clock = new THREE.Clock();
const q = new THREE.Quaternion();
let upsideDown = 0;
let stuck = 0;

renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 1 / 20);
  if (dt <= 0) return;

  // forward direction on the ground plane
  q.copy(chassisBody.quaternion);
  forward.set(-1, 0, 0).applyQuaternion(q).setY(0);
  if (forward.lengthSq() < 1e-4) forward.set(-1, 0, 0);
  forward.normalize();

  const speed = chassisBody.velocity.length();
  driveVehicle(dt, speed);

  // physics: fixed sub steps for any refresh rate
  const steps = Math.max(1, Math.ceil(dt / (1 / 90)));
  for (let i = 0; i < steps; i++) world.step(dt / steps);

  if (chassisBody.position.y < -30) resetCar();

  // flip back automatically when stuck upside down
  const upY = tmpV.set(0, 1, 0).applyQuaternion(q.copy(chassisBody.quaternion)).y;
  upsideDown = upY < 0.35 && speed < 2.5 ? upsideDown + dt : 0;
  if (upsideDown > 1.5) {
    upsideDown = 0;
    resetCar();
  }

  // stuck on the rubble with every wheel in the air: back off a little
  const grounded = vehicle.wheelInfos.some((w) => w.isInContact);
  stuck = !grounded && speed < 1 ? stuck + dt : 0;
  if (stuck > 1.5) {
    stuck = 0;
    resetCar({ back: 6 });
  }

  // sync meshes
  car.position.copy(chassisBody.position);
  car.quaternion.copy(chassisBody.quaternion);
  vehicle.wheelInfos.forEach((info, i) => {
    vehicle.updateWheelTransform(i);
    wheels[i].position.copy(info.worldTransform.position);
    wheels[i].quaternion.copy(info.worldTransform.quaternion);

    // dust & sparks from the rear wheels
    if (i >= 2 && info.isInContact) {
      const hit = info.raycastResult.hitPointWorld;
      tmpP.set(hit.x, hit.y + 0.1, hit.z);
      const slip = 1 - info.skidInfo;
      if (speed > 3 && Math.random() < Math.min(speed / 18, 1) * 0.9) {
        tmpV.set(-forward.x * speed * 0.2 + rand(-1, 1), rand(0.5, 1.6), -forward.z * speed * 0.2 + rand(-1, 1));
        dust.emit(tmpP, tmpV, { life: rand(1.2, 2.6), size: rand(0.7, 1.4), grow: 2.2, drag: 1.5, gravity: -0.2 });
      }
      if (speed > 6 && (slip > 0.35 || input.brake) && Math.random() < 0.7) {
        tmpV.set(-forward.x * speed * 0.4 + rand(-2, 2), rand(1, 3), -forward.z * speed * 0.4 + rand(-2, 2));
        sparks.emit(tmpP, tmpV, { life: rand(0.2, 0.5), size: rand(0.06, 0.12), gravity: 12, drag: 1 });
      }
    }
  });

  for (const { body, mesh } of dynamics) {
    if (body.sleepState === CANNON.Body.SLEEPING && mesh.userData.synced) continue;
    mesh.position.copy(body.position);
    mesh.quaternion.copy(body.quaternion);
    mesh.userData.synced = true;
  }
  updateTrails();
  sparks.update(dt);
  dust.update(dt);

  rainTimer -= dt;
  if (rainTimer <= 0) {
    spawnRain();
    rainTimer = rand(0.5, 1.1);
  }

  // sun follows the car so shadows stay sharp
  const p = chassisBody.position;
  sun.target.position.set(p.x, p.y, p.z);
  sun.position.set(p.x + SUN_DIR.x * 120, p.y + SUN_DIR.y * 120 + 8, p.z + SUN_DIR.z * 120);

  updateCamera(dt);
  speedLabel.textContent = Math.round(speed * 3.6);
  composer.render();
});
