const createPlaces = ({ latitude, longitude }) => [
  ['p1', -1, -1],
  ['p2', -1,  1],
  ['p3',  1, -1],
  ['p4',  1,  1],
].map(([label,  cy,  cx]) => ({
  label,
  location: {
    latitude : latitude  + 0.000009 * cy,
    longitude: longitude + 0.000011 * cx,
  },
}));

const models = [
  {
    url: '#asset-eevee',
    scale: ['0.5', '0.5', '0.5'],
  },
];

const createEntity = ({ location: { latitude, longitude }, model, scale: [x, y, z] }) => {
  const $entity = document.createRange().createContextualFragment(`
    <a-entity
      gltf-model="${model}"
      scale="${x} ${y} ${z}"
      gps-entity-place="latitude: ${latitude}; longitude: ${longitude};"
    ></a-entity>
  `);

  $entity.addEventListener(
    'loaded',
    () => window.dispatchEvent(new CustomEvent('gps-entity-place-loaded')),
  );

  return $entity;
};

const renderPlace = ({ location }) => {
  const $scene = document.querySelector('a-scene');
  const { url, scale } = models[0];
  const $entity = createEntity({ location, model: url, scale });
  $scene.appendChild($entity);
};

const main = async () => {
  console.log('main');

  const successCallback = position => {
    console.log('success', position);
    createPlaces(position.coords).forEach(renderPlace);
  };

  const errorCallback = error => {
    console.log('error', error);
    alert(error.message);
  };

  navigator.geolocation.getCurrentPosition(
    successCallback,
    errorCallback
  );
};

window.onload = main;
