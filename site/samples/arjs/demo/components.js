/* global AFRAME, THREE */

// ホログラムのステージとキツネたち。AR ではマーカーの上、プレビューでは原点に置く。
// 単位はマーカーの一辺 = 1。

const FOXES = [
  { src: '../step3/assets/fox.gltf', color: '#ffa05a', scale: 0.4 },
  { src: '../step3/assets/fox-yellow.gltf', color: '#ffe066', scale: 0.2 },
  { src: '../step3/assets/fox-blue.gltf', color: '#5f9bff', scale: 0.2 },
  { src: '../step3/assets/fox-red.gltf', color: '#ff5a6e', scale: 0.2 },
];

const HOLO = new THREE.Color('#5fe4ff');

const PLANE_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// 光を足し合わせる加算合成。ただしアルファは書き換えない。
// THREE.AdditiveBlending だとアルファも足されて 1 になり、AR の透明なキャンバスでは
// 暗い部分まで不透明になってカメラ映像を覆い隠してしまう
const ADDITIVE = {
  blending: THREE.CustomBlending,
  blendEquation: THREE.AddEquation,
  blendSrc: THREE.SrcAlphaFactor,
  blendDst: THREE.OneFactor,
  blendSrcAlpha: THREE.ZeroFactor,
  blendDstAlpha: THREE.OneFactor,
};

const holoMaterial = (uniforms, fragmentShader, vertexShader = PLANE_VERT) =>
  new THREE.ShaderMaterial({
    uniforms,
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    ...ADDITIVE,
    side: THREE.DoubleSide,
  });

const basicGlow = (color, opacity) =>
  new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    depthWrite: false,
    ...ADDITIVE,
  });

// ---------- parts ----------

const createFloor = (time) => {
  const mesh = new THREE.Mesh(
    new THREE.CircleGeometry(1.8, 96),
    holoMaterial(
      { time, color: { value: HOLO } },
      /* glsl */ `
        uniform float time;
        uniform vec3 color;
        varying vec2 vUv;
        void main() {
          vec2 p = (vUv - 0.5) * 2.0;
          float r = length(p);
          float ang = atan(p.y, p.x) / 6.28318 + 0.5;

          vec2 g = abs(fract(p * 7.0) - 0.5);
          float grid = (1.0 - smoothstep(0.0, 0.04, min(g.x, g.y))) * 0.16 * (1.0 - smoothstep(0.55, 0.95, r));

          float rings = (1.0 - smoothstep(0.0, 0.01, abs(r - 0.97)))
                      + (1.0 - smoothstep(0.0, 0.006, abs(r - 0.7))) * 0.45
                      + (1.0 - smoothstep(0.0, 0.004, abs(r - 0.4))) * 0.3;
          float ticks = step(0.8, fract(ang * 96.0)) * step(0.9, r) * step(r, 0.95) * 0.55;
          float sweep = pow(fract(ang - time * 0.12), 12.0) * 0.4 * step(r, 0.97);
          float w = fract(time * 0.28);
          float wave = (1.0 - smoothstep(0.0, 0.035, abs(r - w))) * (1.0 - w) * 0.7;
          float glow = (1.0 - smoothstep(0.0, 1.0, r)) * 0.12;

          float a = grid + rings * 0.85 + ticks + sweep + wave + glow;
          gl_FragColor = vec4(color * a, 1.0);
        }
      `,
    ),
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.002;
  return mesh;
};

const createFoxRing = (time, color, offset) => {
  const mesh = new THREE.Mesh(
    new THREE.CircleGeometry(0.34, 64),
    holoMaterial(
      { time, color: { value: new THREE.Color(color).lerp(HOLO, 0.55) }, offset: { value: offset } },
      /* glsl */ `
        uniform float time;
        uniform vec3 color;
        uniform float offset;
        varying vec2 vUv;
        void main() {
          float r = length(vUv - 0.5) * 2.0;
          float w = fract(time * 0.6 + offset);
          float a = (1.0 - smoothstep(0.0, 0.04, abs(r - 0.93)))
                  + (1.0 - smoothstep(0.0, 0.03, abs(r - 0.62))) * 0.6
                  + (1.0 - smoothstep(0.0, 0.07, abs(r - w))) * (1.0 - w) * 0.9
                  + (1.0 - smoothstep(0.0, 0.7, r)) * 0.3;
          gl_FragColor = vec4(color * a, 1.0);
        }
      `,
    ),
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.006;
  return mesh;
};

// map pin icon drawn on a canvas, used as a billboard sprite
const pinTextures = new Map();
const pinTexture = (color) => {
  if (pinTextures.has(color)) return pinTextures.get(color);
  const w = 128;
  const h = 168;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  const cx = w / 2;
  const cy = 58;
  const r = 40;
  const path = () => {
    ctx.beginPath();
    ctx.arc(cx, cy, r, Math.PI * 0.82, Math.PI * 2.18);
    ctx.lineTo(cx, h - 12);
    ctx.closePath();
  };
  ctx.shadowColor = color;
  ctx.shadowBlur = 14;
  path();
  const fill = ctx.createLinearGradient(0, cy - r, 0, h);
  fill.addColorStop(0, `${color}cc`);
  fill.addColorStop(1, `${color}22`);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = 5;
  ctx.strokeStyle = '#ffffff';
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.42, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  const texture = new THREE.CanvasTexture(canvas);
  pinTextures.set(color, texture);
  return texture;
};

// position = the tip of the pin
const createPin = (size, color) => {
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: pinTexture(color),
      transparent: true,
      depthWrite: false,
      ...ADDITIVE,
    }),
  );
  sprite.center.set(0.5, 0.04);
  sprite.scale.set(size, size * (168 / 128), 1);
  sprite.userData.head = size * 0.95; // tip → center of the head
  return sprite;
};

const createBeam = (height, color, opacity) => {
  const geometry = new THREE.CylinderGeometry(0.004, 0.004, height, 6, 1, true);
  geometry.translate(0, height / 2, 0);
  return new THREE.Mesh(geometry, basicGlow(new THREE.Color(color), opacity));
};

const ARC_POINTS = 28;

const createArcs = (time, count) => {
  const geometry = new THREE.BufferGeometry();
  const t = new Float32Array(count * ARC_POINTS);
  for (let a = 0; a < count; a++) {
    for (let i = 0; i < ARC_POINTS; i++) t[a * ARC_POINTS + i] = i / (ARC_POINTS - 1);
  }
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * ARC_POINTS * 3), 3));
  geometry.setAttribute('aT', new THREE.BufferAttribute(t, 1));
  const points = new THREE.Points(
    geometry,
    holoMaterial(
      { time, color: { value: HOLO }, scale: { value: 600 } },
      /* glsl */ `
        uniform float time;
        uniform vec3 color;
        varying float vAlpha;
        void main() {
          float d = length(gl_PointCoord - 0.5);
          gl_FragColor = vec4(color * smoothstep(0.5, 0.1, d) * vAlpha, 1.0);
        }
      `,
      /* glsl */ `
        attribute float aT;
        uniform float time;
        uniform float scale;
        varying float vAlpha;
        void main() {
          vAlpha = 0.25 + 0.75 * pow(fract(aT * 2.0 - time * 0.6), 5.0);
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = clamp(scale * 0.012 / -mv.z, 1.5, 10.0);
        }
      `,
    ),
  );
  points.frustumCulled = false;
  return points;
};

const createMotes = (time, count) => {
  const geometry = new THREE.BufferGeometry();
  const seeds = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = 0.2 + Math.sqrt(Math.random()) * 1.6;
    seeds.set([Math.cos(a) * r, Math.sin(a) * r, 0.08 + Math.random() * 0.25, Math.random()], i * 4);
  }
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
  geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 4));
  const points = new THREE.Points(
    geometry,
    holoMaterial(
      { time, color: { value: HOLO }, scale: { value: 600 } },
      /* glsl */ `
        uniform vec3 color;
        varying float vAlpha;
        void main() {
          float d = length(gl_PointCoord - 0.5);
          gl_FragColor = vec4(color * smoothstep(0.5, 0.0, d) * vAlpha, 1.0);
        }
      `,
      /* glsl */ `
        attribute vec4 aSeed;
        uniform float time;
        uniform float scale;
        varying float vAlpha;
        void main() {
          float f = fract(aSeed.w + time * aSeed.z);
          vec3 p = vec3(aSeed.x, f * 1.7, aSeed.y);
          vAlpha = sin(3.14159 * f) * 0.7;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = clamp(scale * 0.01 / -mv.z, 1.0, 8.0);
        }
      `,
    ),
  );
  points.frustumCulled = false;
  return points;
};

const createFrame = () => {
  // corner brackets around the marker
  const s = 0.62;
  const l = 0.18;
  const v = [];
  [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(([sx, sz]) => {
    v.push(sx * s, 0, sz * s, sx * (s - l), 0, sz * s);
    v.push(sx * s, 0, sz * s, sx * s, 0, sz * (s - l));
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  const lines = new THREE.LineSegments(
    geometry,
    new THREE.LineBasicMaterial({ color: HOLO, transparent: true, opacity: 0.9, depthWrite: false, ...ADDITIVE }),
  );
  lines.position.y = 0.004;
  return lines;
};

// ---------- diorama ----------

const ease = (t) => t * t * (3 - 2 * t);
const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));

// マーカーの四隅を示すブラケット。ステージを縮めてもマーカーの大きさに合うよう、別のコンポーネントにしている
AFRAME.registerComponent('holo-frame', {
  init() {
    this.el.setObject3D('frame', createFrame());
  },
});

AFRAME.registerComponent('holo-diorama', {
  schema: {
    motion: { default: 'Survey', oneOf: ['Survey', 'Walk', 'Run'] },
  },

  update(old) {
    if (old.motion !== this.data.motion) this.setMotion(this.data.motion);
  },

  init() {
    this.time = { value: 0 };
    const group = new THREE.Group();
    this.group = group;
    this.el.setObject3D('holo', group);

    // lights
    const hemi = document.createElement('a-entity');
    hemi.setAttribute('light', 'type: hemisphere; color: #cfe8ff; groundColor: #3a2a4a; intensity: 0.9');
    const key = document.createElement('a-entity');
    key.setAttribute('light', 'type: directional; color: #ffd0a0; intensity: 0.9');
    key.setAttribute('position', '1.5 2.5 1.5');
    const rim = document.createElement('a-entity');
    rim.setAttribute('light', 'type: directional; color: #5fe4ff; intensity: 0.6');
    rim.setAttribute('position', '-1.5 1.2 -2');
    this.el.append(hemi, key, rim);

    group.add(createFloor(this.time));

    // big pin
    this.bigPin = createPin(0.34, '#5fe4ff');
    this.bigPin.position.set(0, 1.0, -0.95);
    group.add(this.bigPin, createBeam(1.0, HOLO, 0.5).translateZ(-0.95));
    const bigRing = createFoxRing(this.time, '#5fe4ff', 0.5);
    bigRing.position.set(0, 0.006, -0.95);
    bigRing.scale.setScalar(0.6);
    group.add(bigRing);

    // foxes
    this.foxes = FOXES.map((fox, i) => {
      const el = document.createElement('a-entity');
      el.setAttribute('gltf-model', `url(${fox.src})`);
      el.setAttribute('scale', `${fox.scale} ${fox.scale} ${fox.scale}`);
      this.el.appendChild(el);

      const ring = createFoxRing(this.time, fox.color, i * 0.27);
      const pin = createPin(0.13, fox.color);
      const beam = createBeam(0.2, fox.color, 0.35);
      group.add(ring, pin, beam);

      const home = new THREE.Vector3((i - 1.5) * 0.74, 0, i % 2 ? -0.16 : 0.16);
      const item = {
        el, ring, pin, beam, home,
        pos: home.clone(),
        heading: Math.PI / 2 - 0.55,
        mixer: null,
        actions: {},
        current: null,
      };

      el.addEventListener('model-loaded', () => {
        const model = el.getObject3D('mesh');
        model.traverse((o) => {
          if (o.isMesh) o.frustumCulled = false;
        });
        item.mixer = new THREE.AnimationMixer(model);
        (model.animations || []).forEach((clip) => {
          item.actions[clip.name] = item.mixer.clipAction(clip);
        });
        this.playClip(item, this.motion, 0);
        item.mixer.update(i * 0.7); // desync
      });
      return item;
    });

    this.arcs = createArcs(this.time, this.foxes.length);
    this.motes = createMotes(this.time, 140);
    group.add(this.arcs, this.motes);

    this.motion = 'Survey';
    this.blend = 0; // 0: line up, 1: circle around
    this.angle = 0;
    this.tmp = new THREE.Vector3();
  },

  playClip(item, name, fade = 0.4) {
    const next = item.actions[name];
    if (!next || item.current === next) return;
    next.reset().play();
    if (item.current) item.current.crossFadeTo(next, fade, false);
    item.current = next;
  },

  setMotion(name) {
    this.motion = name;
    this.foxes.forEach((item) => this.playClip(item, name));
  },

  tick(t, dtMs) {
    const dt = Math.min(dtMs || 16, 100) / 1000;
    const time = t / 1000;
    this.time.value = time;

    const moving = this.motion !== 'Survey';
    const speed = this.motion === 'Run' ? 0.95 : 0.32;
    this.blend = THREE.MathUtils.clamp(this.blend + (moving ? dt : -dt) * 0.8, 0, 1);
    if (moving) this.angle += speed * dt;
    const b = ease(this.blend);

    const R = 1.12;
    const arcPos = this.arcs.geometry.attributes.position;
    const bigPos = this.bigPin.position;

    this.foxes.forEach((item, i) => {
      const a = this.angle + (i / this.foxes.length) * Math.PI * 2;
      const circle = this.tmp.set(Math.cos(a) * R, 0, Math.sin(a) * R);
      item.pos.copy(item.home).lerp(circle, b);

      // face the line-up direction or the tangent of the circle
      const lineHeading = Math.PI / 2 - 0.55;
      const tangentHeading = Math.atan2(-Math.sin(a), Math.cos(a));
      const target = lineHeading + wrapAngle(tangentHeading - lineHeading) * b;
      item.heading += wrapAngle(target - item.heading) * Math.min(1, dt * 6);

      const obj = item.el.object3D;
      obj.position.copy(item.pos);
      obj.rotation.set(0, item.heading, 0);
      if (item.mixer) item.mixer.update(dt);

      item.ring.position.set(item.pos.x, 0.006, item.pos.z);
      const pinY = 0.5 + Math.sin(time * 2 + i) * 0.025;
      item.pin.position.set(item.pos.x, pinY, item.pos.z);
      item.beam.position.set(item.pos.x, 0.36, item.pos.z);
      item.beam.scale.y = Math.max(pinY - 0.36, 0.001) / 0.2;

      // dotted arc from the fox pin to the big pin
      const p0 = item.pin.position;
      const y0 = p0.y + item.pin.userData.head;
      const y1 = bigPos.y + this.bigPin.userData.head;
      for (let k = 0; k < ARC_POINTS; k++) {
        const s = k / (ARC_POINTS - 1);
        const x = THREE.MathUtils.lerp(p0.x, bigPos.x, s);
        const z = THREE.MathUtils.lerp(p0.z, bigPos.z, s);
        const y = THREE.MathUtils.lerp(y0, y1, s) + Math.sin(s * Math.PI) * 0.3;
        arcPos.setXYZ(i * ARC_POINTS + k, x, y, z);
      }
    });
    arcPos.needsUpdate = true;

    this.bigPin.position.y = 1.0 + Math.sin(time * 1.4) * 0.04;

    const renderer = this.el.sceneEl.renderer;
    if (renderer) {
      const h = renderer.domElement.height;
      this.arcs.material.uniforms.scale.value = h;
      this.motes.material.uniforms.scale.value = h;
    }
  },
});

// ---------- preview only ----------

// sunset sky, stars and mountains for the camera-less preview
AFRAME.registerComponent('holo-backdrop', {
  init() {
    const group = new THREE.Group();
    const sunDir = new THREE.Vector3(-0.55, 0.08, -0.83).normalize();

    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(80, 48, 24),
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        uniforms: { sunDir: { value: sunDir } },
        vertexShader: /* glsl */ `
          varying vec3 vDir;
          void main() {
            vDir = normalize(position);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: /* glsl */ `
          uniform vec3 sunDir;
          varying vec3 vDir;
          void main() {
            vec3 d = normalize(vDir);
            float h = d.y;
            float s = max(dot(d, sunDir), 0.0);
            vec3 col = mix(vec3(0.36, 0.2, 0.42), vec3(0.08, 0.1, 0.3), smoothstep(0.0, 0.25, h));
            col = mix(col, vec3(0.02, 0.03, 0.09), smoothstep(0.2, 0.8, h));
            col += vec3(1.0, 0.55, 0.25) * pow(s, 8.0) * 0.8;
            col += vec3(1.0, 0.85, 0.6) * pow(s, 300.0) * 1.5;
            col = mix(col, vec3(0.03, 0.03, 0.07), 1.0 - smoothstep(-0.05, 0.0, h));
            gl_FragColor = vec4(col, 1.0);
          }
        `,
      }),
    );
    group.add(sky);

    // stars
    const starCount = 700;
    const starPos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const y = 0.15 + Math.random() * 0.85;
      const a = Math.random() * Math.PI * 2;
      const r = Math.sqrt(1 - y * y);
      starPos.set([Math.cos(a) * r * 70, y * 70, Math.sin(a) * r * 70], i * 3);
    }
    const starGeometry = new THREE.BufferGeometry();
    starGeometry.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    group.add(new THREE.Points(starGeometry, new THREE.PointsMaterial({ color: 0xffffff, size: 1.5, sizeAttenuation: false, transparent: true, opacity: 0.8 })));

    // mountains
    const mountains = (radius, minH, maxH, color, seed) => {
      const positions = [];
      const indices = [];
      const seg = 240;
      for (let i = 0; i <= seg; i++) {
        const a = (i / seg) * Math.PI * 2;
        const n = 0.5 * Math.abs(Math.sin(a * 3 + seed)) + 0.3 * Math.abs(Math.sin(a * 7.7 + seed * 2)) + 0.2 * Math.abs(Math.sin(a * 19 + seed * 3));
        const h = minH + (maxH - minH) * n;
        positions.push(Math.cos(a) * radius, -1, Math.sin(a) * radius, Math.cos(a) * radius, h, Math.sin(a) * radius);
        if (i < seg) indices.push(i * 2, i * 2 + 2, i * 2 + 1, i * 2 + 1, i * 2 + 2, i * 2 + 3);
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geometry.setIndex(indices);
      return new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }));
    };
    group.add(mountains(60, 3, 9, 0x1c1638, 1.3), mountains(42, 1.5, 5, 0x0e0c22, 3.1));

    // floor
    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(40, 64),
      new THREE.ShaderMaterial({
        uniforms: {},
        vertexShader: /* glsl */ `
          varying vec3 vWorld;
          void main() {
            vec4 wp = modelMatrix * vec4(position, 1.0);
            vWorld = wp.xyz;
            gl_Position = projectionMatrix * viewMatrix * wp;
          }
        `,
        fragmentShader: /* glsl */ `
          varying vec3 vWorld;
          void main() {
            vec2 p = vWorld.xz;
            vec2 g = abs(fract(p * 0.5) - 0.5);
            float r = length(p);
            float line = (1.0 - smoothstep(0.0, 0.012, min(g.x, g.y))) * (1.0 - smoothstep(2.0, 14.0, r));
            vec3 col = vec3(0.025, 0.03, 0.06) + vec3(0.2, 0.55, 0.75) * line * 0.12;
            col += vec3(0.1, 0.35, 0.5) * (1.0 - smoothstep(0.0, 4.0, r)) * 0.25;
            gl_FragColor = vec4(col, 1.0);
          }
        `,
      }),
    );
    floor.rotation.x = -Math.PI / 2;
    group.add(floor);

    this.el.setObject3D('backdrop', group);
  },
});

// drag to orbit, wheel / pinch to zoom
AFRAME.registerComponent('orbit-view', {
  schema: {
    target: { type: 'vec3', default: { x: 0, y: 0, z: 0 } },
    radius: { default: 4 },
    theta: { default: 0 },
    phi: { default: 1.2 },
  },

  init() {
    this.theta = this.data.theta;
    this.phi = this.data.phi;
    this.radius = this.data.radius;
    this.pointers = new Map();
    this.idle = 0;

    const canvas = this.el.sceneEl.canvas;
    const onReady = (c) => {
      c.style.touchAction = 'none';
      c.addEventListener('pointerdown', (e) => {
        c.setPointerCapture(e.pointerId);
        this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      });
      c.addEventListener('pointermove', (e) => {
        const prev = this.pointers.get(e.pointerId);
        if (!prev) return;
        if (this.pointers.size === 1) {
          this.theta -= (e.clientX - prev.x) * 0.006;
          this.phi = THREE.MathUtils.clamp(this.phi - (e.clientY - prev.y) * 0.005, 0.35, 1.5);
        } else if (this.pointers.size === 2) {
          const [a, b] = [...this.pointers.values()];
          const before = Math.hypot(a.x - b.x, a.y - b.y);
          prev.x = e.clientX;
          prev.y = e.clientY;
          const [c1, c2] = [...this.pointers.values()];
          const after = Math.hypot(c1.x - c2.x, c1.y - c2.y);
          if (before > 0) this.zoom(before / after);
        }
        prev.x = e.clientX;
        prev.y = e.clientY;
        this.idle = 0;
      });
      const up = (e) => this.pointers.delete(e.pointerId);
      c.addEventListener('pointerup', up);
      c.addEventListener('pointercancel', up);
      c.addEventListener('wheel', (e) => {
        e.preventDefault();
        this.zoom(Math.exp(e.deltaY * 0.001));
        this.idle = 0;
      }, { passive: false });
    };
    if (canvas) onReady(canvas);
    else this.el.sceneEl.addEventListener('render-target-loaded', () => onReady(this.el.sceneEl.canvas));
  },

  zoom(factor) {
    this.radius = THREE.MathUtils.clamp(this.radius * factor, 2, 9);
  },

  tick(t, dt) {
    this.idle += (dt || 16) / 1000;
    if (this.idle > 3 && this.pointers.size === 0) this.theta += ((dt || 16) / 1000) * 0.12;
    const { x, y, z } = this.data.target;
    const r = this.radius;
    const obj = this.el.object3D;
    obj.position.set(
      x + r * Math.sin(this.phi) * Math.sin(this.theta),
      y + r * Math.cos(this.phi),
      z + r * Math.sin(this.phi) * Math.cos(this.theta),
    );
    // object3D is a group (not the camera itself): lookAt aims +z, so turn around
    obj.lookAt(x, y, z);
    obj.rotateY(Math.PI);
  },
});
