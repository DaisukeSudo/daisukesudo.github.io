import * as CANNON from 'https://cdn.jsdelivr.net/npm/cannon-es@0.20.0/+esm';
import { main as base } from './scene-base.js';

export const main = base((_, world) => {
  // Ground
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

  // Sphere
  const radius = 2.5;
  const sphereBody = new CANNON.Body({
    mass: 5,
    shape: new CANNON.Sphere(radius),
    position: new CANNON.Vec3(0, 10, 0),
    material: new CANNON.Material({
      restitution: 1,
    }),
  });
  world.addBody(sphereBody);

  return { isDebugEnabled: true };
});
