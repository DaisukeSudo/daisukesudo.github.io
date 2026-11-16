import * as CANNON from 'https://cdn.jsdelivr.net/npm/cannon-es@0.20.0/+esm';
import { main as base } from './scene-base.js';

export const main = base((_, world) => {
  // Sphere
  const radius = 2.5;
  const sphereBody = new CANNON.Body({
    mass: 5, // kg
    shape: new CANNON.Sphere(radius),
    position: new CANNON.Vec3(-5, 7.5, 0),
  });
  world.addBody(sphereBody);

  // Constraint
  const constraint = new CANNON.PointToPointConstraint(
    new CANNON.Body({ mass: 0 }), // A body with mass 0 to represent the fixed point
    new CANNON.Vec3(0, 7.5, 0),   // Connection point in world space
    sphereBody,
    new CANNON.Vec3(5, 0, 0),     // Connection point on the sphere, relative to the sphere's center
  );
  world.addConstraint(constraint);

  return { isDebugEnabled: true };
});
