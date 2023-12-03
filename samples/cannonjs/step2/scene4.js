import * as THREE from 'https://unpkg.com/three@0.158.0/build/three.module.js';
import * as CANNON from 'https://cdn.jsdelivr.net/npm/cannon-es@0.20.0/+esm';
import { main as base } from './scene-base.js';

export const main = base((scene, world) => {
  // Light
  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
  directionalLight.position.set(0, 1, 0);
  scene.add(directionalLight);

  // Ground
  const groundMesh = new THREE.Mesh(
    new THREE.BoxGeometry(20, 0.02, 20),
    new THREE.MeshPhongMaterial({
      color: 0x9999ff,
      transparent: true,
      opacity: 0.5,
    }),
  );
  scene.add(groundMesh);

  const groundBody = new CANNON.Body({
    mass: 0,
    shape: new CANNON.Box(
      new CANNON.Vec3(10, 0.01, 10)
    ),
    material: new CANNON.Material({
      restitution: 0.5,
    }),
  });
  groundBody.quaternion.setFromEuler(0, 0, 0);
  world.addBody(groundBody);

  // Box
  const objects = [];
  const generateBox = () => {
    while (objects.length >= 200) {
      const [mesh, body] = objects.pop();
      scene.remove(mesh);
      world.removeBody(body);
    }

    const size = Math.random() + 0.1;
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(size * 2, size * 2, size * 2),
      new THREE.MeshPhongMaterial({
        color: (() => {
          const r = Math.floor(Math.random() * 256);
          const g = Math.floor(Math.random() * 256);
          const b = Math.floor(Math.random() * 256);
          return `rgb(${r}, ${g}, ${b})`;
        })(),
        transparent: true,
        opacity: 0.5,
      }),
    );
    scene.add(mesh);

    const body = new CANNON.Body({
      mass: 1,
      shape: new CANNON.Box(
        new CANNON.Vec3(size, size, size),
      ),
      position: new CANNON.Vec3(0, 10, 0),
    });
    body.quaternion.setFromEuler(
      Math.random() * Math.PI,
      Math.random() * Math.PI,
      Math.random() * Math.PI,
      "XYZ"
    );
    world.addBody(body);

    objects.unshift([mesh, body]);
  };

  // Generate Boxes regularly
  const intervalId = setInterval(generateBox, 250);

  // Stop generation
  const stop = () => clearInterval(intervalId);

  // Copy the position and orientation of Cannon.js Body to Three.js Mesh
  const copy = () => objects.forEach(([mesh, body]) => {
    mesh.position.copy(body.position);
    mesh.quaternion.copy(body.quaternion);
  });

  return { copy, stop };
});
