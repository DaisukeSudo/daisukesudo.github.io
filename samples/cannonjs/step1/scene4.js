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

  // Box
  const objects = [];
  const generateBox = () => {
    while (objects.length >= 200) {
      const body = objects.pop();
      world.removeBody(body);
    }

    const size = Math.random() + 0.1;
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

    objects.unshift(body);
  };

  // Generate Boxes regularly
  const intervalId = setInterval(generateBox, 250);

  // Stop generation
  const stop = () => clearInterval(intervalId);

  return { stop, isDebugEnabled: true };
});
