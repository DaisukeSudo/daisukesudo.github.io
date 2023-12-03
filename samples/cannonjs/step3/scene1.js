import * as THREE from 'https://unpkg.com/three@0.158.0/build/three.module.js';
import * as CANNON from 'https://cdn.jsdelivr.net/npm/cannon-es@0.20.0/+esm';
import { main as base } from './scene-base.js';

// ref: https://github.com/pmndrs/cannon-es/blob/master/examples/rigid_vehicle.html

const createGround = () => {
  const groundMaterial = new CANNON.Material({
    name: 'ground',
    restitution: 1,
  });
  const groundBody = new CANNON.Body({
    mass: 0,
    shape: new CANNON.Cylinder(125, 125, 0.01, 32),
    position: new CANNON.Vec3(0, -5, 0),
    material: groundMaterial,
  });

  return {
    groundBody,
    groundMaterial,
  };
};

const createVehicle = () => {
  // Chassis
  const chassisBody = new CANNON.Body({
    mass: 1,
    shape: new CANNON.Box(new CANNON.Vec3(6, 0.4, 2.4)),
  });

  // Vehicle
  const vehicle = new CANNON.RigidVehicle({
    chassisBody,
  });

  // Wheel
  const wheelMaterial = new CANNON.Material({
    name: 'wheel',
    restitution: 1,
  });
  const createWheelBody = () => {
    const wheelBody = new CANNON.Body({
      mass: 1,
      material: wheelMaterial,
    });
    const wheelQuaternion = new CANNON.Quaternion();
    wheelQuaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), Math.PI / 2);
    wheelBody.addShape(
      new CANNON.Cylinder(1.25, 1.25, 1, 32),
      new CANNON.Vec3(),
      wheelQuaternion
    );
    wheelBody.angularDamping = 0.8;
    return wheelBody;
  };
  const addWheelToVehicle = (position) =>
    vehicle.addWheel({
      body: createWheelBody(),
      position,
      axis: new CANNON.Vec3(0, 0, 1),
      direction: new CANNON.Vec3(0, -1, 0),
    });
  [
    new CANNON.Vec3(-5, 0,  3.6), // Front Left
    new CANNON.Vec3(-5, 0, -3.6), // Front Right
    new CANNON.Vec3( 5, 0,  3.6), // Rear Left
    new CANNON.Vec3( 5, 0, -3.6), // Rear Right
  ].forEach(addWheelToVehicle);

  return {
    vehicle,
    wheelMaterial,
  };
};

const addKeybindings = (vehicle) => {
  // Add force on keydown
  document.addEventListener('keydown', (event) => {
    const maxSteerVal = Math.PI / 8;
    const maxForce = 100;

    switch (event.key) {
      case 'w':
      case 'ArrowUp':
        vehicle.setWheelForce(maxForce, 2);
        vehicle.setWheelForce(maxForce, 3);
        break;

      case 's':
      case 'ArrowDown':
        vehicle.setWheelForce(-maxForce, 2);
        vehicle.setWheelForce(-maxForce, 3);
        break;

      case 'a':
      case 'ArrowLeft':
        vehicle.setSteeringValue(maxSteerVal, 0);
        vehicle.setSteeringValue(maxSteerVal, 1);
        break;

      case 'd':
      case 'ArrowRight':
        vehicle.setSteeringValue(-maxSteerVal, 0);
        vehicle.setSteeringValue(-maxSteerVal, 1);
        break;
    }
  })

  // Reset force on keyup
  document.addEventListener('keyup', (event) => {
    switch (event.key) {
      case 'w':
      case 'ArrowUp':
        vehicle.setWheelForce(0, 2);
        vehicle.setWheelForce(0, 3);
        break;

      case 's':
      case 'ArrowDown':
        vehicle.setWheelForce(0, 2);
        vehicle.setWheelForce(0, 3);
        break;

      case 'a':
      case 'ArrowLeft':
        vehicle.setSteeringValue(0, 0);
        vehicle.setSteeringValue(0, 1);
        break;

      case 'd':
      case 'ArrowRight':
        vehicle.setSteeringValue(0, 0);
        vehicle.setSteeringValue(0, 1);
        break;
    }
  })
};

export const main = base((scene, world) => {
  // Light
  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
  directionalLight.position.set(0, 1, 0);
  scene.add(directionalLight);

  // Ground
  const {
    groundBody,
    groundMaterial,
  } = createGround();
  world.addBody(groundBody);

  // Vehicle
  const {
    vehicle,
    wheelMaterial,
  } = createVehicle();
  vehicle.addToWorld(world);

  // Contact parameters between wheels and ground
  const contactMaterial = new CANNON.ContactMaterial(
    wheelMaterial,
    groundMaterial,
    {
      friction: 0.5,
      contactEquationStiffness: 1000,
    }
  );
  world.addContactMaterial(contactMaterial);

  // Keybindings
  addKeybindings(vehicle);

  return { isDebugEnabled: true };
});
