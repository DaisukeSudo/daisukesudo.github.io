const main = (canvas) => {
  if (!canvas) return;

  // 1. canvas size
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;

  // 2. scene
  const scene = new THREE.Scene();

  // 3. mesh (box)
  const box = new THREE.Mesh(
    new THREE.BoxGeometry(64, 64, 64),
    new THREE.MeshNormalMaterial()
  );
  box.position.set(0, 0, 0);
  scene.add(box);

  // 4. camera
  const camera = new THREE.PerspectiveCamera(45, width / height, 1, 1000);
  camera.position.set(200, 100, 300);
  camera.lookAt(box.position);

  // 5. renderer
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setSize(width, height);
  renderer.setClearColor(0xffffff, 0);
  renderer.setPixelRatio(window.devicePixelRatio);

  // 6. animate
  const animate = () => {
    // next frame
    requestAnimationFrame(animate);

    // rotate
    const sec = Date.now() / 1000;
    box.rotation.x = sec * (Math.PI / 4);
    box.rotation.y = sec * (Math.PI / 4);
    box.rotation.z = sec * (Math.PI / 4);

    // render
    renderer.render(scene, camera);
  };

  animate();
};
