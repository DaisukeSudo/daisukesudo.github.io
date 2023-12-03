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
  groundBody.quaternion.setFromEuler(0, 0, -Math.PI / 9); // rotate ground body by 20 degrees
  world.addBody(groundBody);

  // Sphere
  const radius = 2.5;

  const sphereMesh = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 32, 32),
    new THREE.MeshPhongMaterial({
      color: 0x99ff99,
      transparent: true,
      opacity: 0.75,
    }),
  );
  scene.add(sphereMesh);

  const sphereBody = new CANNON.Body({
    mass: 5,
    shape: new CANNON.Sphere(radius),
    position: new CANNON.Vec3(0, 10, 0),
    material: new CANNON.Material({
      restitution: 1,
    }),
  });
  world.addBody(sphereBody);
  
  // Copy the position and orientation of Cannon.js Body to Three.js Mesh
  const copy = () => {
    groundMesh.position.copy(groundBody.position);
    groundMesh.quaternion.copy(groundBody.quaternion);
    sphereMesh.position.copy(sphereBody.position);
    sphereMesh.quaternion.copy(sphereBody.quaternion);
  };

  return { copy };
});
