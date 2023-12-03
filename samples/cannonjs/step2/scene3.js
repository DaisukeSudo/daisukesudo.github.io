import * as THREE from 'https://unpkg.com/three@0.158.0/build/three.module.js';
import * as CANNON from 'https://cdn.jsdelivr.net/npm/cannon-es@0.20.0/+esm';
import { main as base } from './scene-base.js';

export const main = base((scene, world) => {
  // Light
  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
  directionalLight.position.set(0, 1, 0);
  scene.add(directionalLight);

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
  sphereMesh.castShadow = true;
  scene.add(sphereMesh);

  const sphereBody = new CANNON.Body({
    mass: 5, // kg
    shape: new CANNON.Sphere(radius),
    position: new CANNON.Vec3(-5, 7.5, 0),
  });
  world.addBody(sphereBody);

  // Constraint
  const constraint = new CANNON.PointToPointConstraint(
    new CANNON.Body({ mass: 0 }),
    new CANNON.Vec3(0, 7.5, 0),
    sphereBody,
    new CANNON.Vec3(5, 0, 0),
  );
  world.addConstraint(constraint);

  // Copy the position and orientation of Cannon.js Body to Three.js Mesh
  const copy = () => {
    sphereMesh.position.copy(sphereBody.position);
    sphereMesh.quaternion.copy(sphereBody.quaternion);
  };

  return { copy };
});
