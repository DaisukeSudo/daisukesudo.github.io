import * as THREE from "https://unpkg.com/three@0.160.0/build/three.module.js";

const canvas = document.querySelector(".hero-canvas");
const hero = document.querySelector(".hero");
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setClearColor(0x000000, 0);

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
camera.position.set(0, 0, 24);

// Three.js サンプルと同じ MeshNormalMaterial の箱を漂わせる
const material = new THREE.MeshNormalMaterial();
const geometry = new THREE.BoxGeometry(1, 1, 1);
const rand = (min, max) => min + Math.random() * (max - min);

const boxes = Array.from({ length: 46 }, () => {
  const mesh = new THREE.Mesh(geometry, material);
  const size = rand(0.4, 1.9);
  mesh.scale.setScalar(size);
  mesh.position.set(rand(-22, 22), rand(-11, 11), rand(-18, 2));
  mesh.rotation.set(rand(0, Math.PI), rand(0, Math.PI), 0);
  mesh.userData = {
    spin: new THREE.Vector3(rand(-0.5, 0.5), rand(-0.5, 0.5), rand(-0.2, 0.2)),
    rise: rand(0.15, 0.6) / size,
  };
  scene.add(mesh);
  return mesh;
});

const resize = () => {
  const { clientWidth: w, clientHeight: h } = canvas;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
};
window.addEventListener("resize", resize);
resize();

// ポインターに合わせてカメラを少しだけ動かす
const pointer = new THREE.Vector2();
window.addEventListener("pointermove", (e) => {
  pointer.set(e.clientX / window.innerWidth - 0.5, e.clientY / window.innerHeight - 0.5);
});

const clock = new THREE.Clock();
let visible = true;

const tick = () => {
  const dt = Math.min(clock.getDelta(), 0.05);
  for (const box of boxes) {
    const { spin, rise } = box.userData;
    box.rotation.x += spin.x * dt;
    box.rotation.y += spin.y * dt;
    box.rotation.z += spin.z * dt;
    box.position.y += rise * dt;
    if (box.position.y > 13) box.position.y = -13;
  }
  camera.position.x += (pointer.x * 3 - camera.position.x) * 0.04;
  camera.position.y += (-pointer.y * 2 - camera.position.y) * 0.04;
  camera.lookAt(0, 0, 0);
  renderer.render(scene, camera);
  if (visible) requestAnimationFrame(tick);
};

if (reduceMotion) {
  renderer.render(scene, camera);
} else {
  // ヒーローが画面外にあるあいだは描画を止める
  new IntersectionObserver(([entry]) => {
    const wasVisible = visible;
    visible = entry.isIntersecting;
    if (visible && !wasVisible) {
      clock.getDelta();
      requestAnimationFrame(tick);
    }
  }).observe(hero);
  requestAnimationFrame(tick);
}

hero.classList.add("is-ready");
