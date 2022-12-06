const createPlaces = ({ latitude, longitude }) => [
  ['p1', -2, -2],
  ['p2', -2,  0],
  ['p3', -2,  2],
  ['p4',  0, -2],
  ['p5',  0,  0],
  ['p6',  0,  2],
  ['p7',  2, -2],
  ['p8',  2,  0],
  ['p9',  2,  2],
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
    info: 'Eevee',
  },
  {
    url: '#asset-jolteon',
    scale: ['0.3', '0.3', '0.3'],
    info: 'Jolteon',
  },
  {
    url: '#asset-vaporeon',
    scale: ['0.25', '0.25', '0.25'],
    info: 'Vaporeon',
  },
  {
    url: '#asset-flareon',
    scale: ['0.25', '0.25', '0.25'],
    info: 'Flareon',
  },
];

const createEntity = ({ id, location: { latitude, longitude }, model, scale: [x, y, z] }) => {
  const $entity = document.createRange().createContextualFragment(`
    <a-entity
      id="${id}"
      gltf-model="${model}"
      scale="${x} ${y} ${z}"
      gps-entity-place="latitude: ${latitude}; longitude: ${longitude};"
      animation="property: rotation; to: 0 360 0; dur: 4000; easing: linear; loop: true"
    ></a-entity>
  `);

  $entity.addEventListener(
    'loaded',
    () => window.dispatchEvent(new CustomEvent('gps-entity-place-loaded')),
  );

  return $entity;
};

const renderPlace = ({ location }, count) => {
  const { url, scale, info } = models[count % models.length];

  const $info = document.querySelector('.info');
  $info.innerText = info;

  const $scene = document.querySelector('a-scene');
  const entityId = `e-${Math.floor(Math.random() * 100000)}`;
  const $entity = createEntity({ id: entityId, location, model: url, scale });
  $scene.appendChild($entity);

  const $button = document.querySelector('button[data-action="change"]');
  const buttonClickEventListener = () => {
    $button.removeEventListener('click', buttonClickEventListener, false);
    $scene.removeChild(document.getElementById(entityId));
    renderPlace({ location }, count + 1);
  }
  $button.addEventListener('click', buttonClickEventListener);
};

const main = async () => {
  console.log('main');

  const $info = document.querySelector('.info');
  $info.innerText = 'loading...'

  const successCallback = position => {
    console.log('success', position);
    createPlaces(position.coords)
      .forEach(place => renderPlace(place, 0));
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
