const main = (canvas) => {
  if (!canvas) return;

  // canvas size
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;

  // scene
  const scene = new THREE.Scene();

  // mesh
  const box = new THREE.Mesh(
    new THREE.BoxGeometry(64, 64, 64),
    new THREE.MeshNormalMaterial()
  );
  box.position.set(0, 0, 0);
  scene.add(box);

  // camera
  const camera = new THREE.PerspectiveCamera(45, width / height, 1, 1000);
  camera.position.set(200, 100, 300);
  camera.lookAt(scene.position);

  // renderer
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setSize(width, height);
  renderer.setClearColor(0xd0f0d0);
  renderer.setPixelRatio(window.devicePixelRatio);

  // render
  renderer.render(scene, camera);
};
