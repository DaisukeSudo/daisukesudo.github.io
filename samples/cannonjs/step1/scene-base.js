import * as THREE from 'https://unpkg.com/three@0.158.0/build/three.module.js';
import * as CANNON from 'https://cdn.jsdelivr.net/npm/cannon-es@0.20.0/+esm';
import CannonDebugger from 'https://cdn.jsdelivr.net/npm/cannon-es-debugger@1.0.0/+esm';
import { OrbitControls } from 'https://unpkg.com/three@0.158.0/examples/jsm/controls/OrbitControls.js';

export const main = (fn) => (viewContainer) => {
  if (!viewContainer) return;

  // Scene / Renderer / Camera / Controls (Three.js)
  const scene = new THREE.Scene();
  const axesHelper = new THREE.AxesHelper(50);
  scene.add(axesHelper);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setClearColor(0xffffff, 0);
  renderer.setPixelRatio(window.devicePixelRatio);
  const canvas = renderer.domElement;
  viewContainer.appendChild(canvas);
  
  const camera = new THREE.PerspectiveCamera(45, 1, 1, 1000);
  camera.up.set(0, 1, 0);
  camera.position.set(0, 10, 40);

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  
  // Physics World (Cannon.js)
  const world = new CANNON.World({
    gravity: new CANNON.Vec3(0, -9.82, 0),
  });

  // Cannon Debugger
  const cannonDebugger = new CannonDebugger(scene, world);

  // Setting individual scenes
  const { copy, stop, isDebugEnabled } = fn(scene, world);

  // adjust canvas size
  const onWindowResize = () => {
    const width = viewContainer.clientWidth;
    const height = viewContainer.clientHeight;
    renderer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', onWindowResize);
  onWindowResize(canvas);

  // Start the animation
  let requestId = null;
  const animate = () => {
    copy && copy();
    world.fixedStep(); // framerate every 1 / 60 ms
    isDebugEnabled && cannonDebugger.update();
    controls.update();
    renderer.render(scene, camera);
    requestId = requestAnimationFrame(animate);
  };
  animate();

  // Return the function to stop the animation
  return () => {
    stop && stop();
    cancelAnimationFrame(requestId);
    window.removeEventListener('resize', onWindowResize);
  }
};
