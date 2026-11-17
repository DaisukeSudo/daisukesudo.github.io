// AR モードとプレビューモードで、読み込むスクリプトとシーンを切り替える

const AFRAME_URL = 'https://aframe.io/releases/1.3.0/aframe.min.js';
const ARJS_URL = 'https://cdn.jsdelivr.net/gh/AR-js-org/AR.js@3.4.8/aframe/build/aframe-ar.js';

const SCENES = {
  // ステージはマーカーの一辺の 3.6 倍あるので、AR ではマーカーをぐるりと囲む大きさまで縮める
  ar: `
    <div class="ar-view" data-ar-view>
      <a-scene
        embedded
        vr-mode-ui="enabled: false"
        loading-screen="enabled: false"
        renderer="antialias: true; alpha: true; colorManagement: true;"
        arjs="trackingMethod: best; sourceType: webcam; debugUIEnabled: false;"
      >
        <a-marker
          type="pattern"
          preset="custom"
          url="../step1/assets/marker.patt"
          smooth="true"
          smoothCount="5"
          smoothTolerance="0.01"
          smoothThreshold="2"
          emitevents="true"
        >
          <a-entity holo-frame></a-entity>
          <a-entity holo-diorama scale="0.45 0.45 0.45"></a-entity>
        </a-marker>
        <a-entity camera></a-entity>
      </a-scene>
    </div>
  `,
  preview: `
    <a-scene
      vr-mode-ui="enabled: false"
      loading-screen="dotsColor: #5fe4ff; backgroundColor: #070914"
      renderer="antialias: true; colorManagement: true;"
      background="color: #070914"
    >
      <a-entity holo-backdrop></a-entity>
      <a-entity holo-diorama></a-entity>
      <a-entity
        camera="fov: 50"
        look-controls="enabled: false"
        wasd-controls="enabled: false"
        orbit-view="target: 0 0.4 0; radius: 3.6; phi: 1.22; theta: 0"
      ></a-entity>
    </a-scene>
  `,
};

const loadScript = (src) => new Promise((resolve, reject) => {
  const script = document.createElement('script');
  script.src = src;
  script.onload = resolve;
  script.onerror = () => reject(new Error(`failed to load ${src}`));
  document.head.appendChild(script);
});

const ZOOM_MIN = 1;
const ZOOM_MAX = 4;

const place = (element, width, height, left, top) => {
  Object.assign(element.style, {
    width: `${width}px`,
    height: `${height}px`,
    marginLeft: `${left}px`,
    marginTop: `${top}px`,
  });
};

// AR.js 標準のレイアウトには 2 つ問題がある。
// - カメラ映像を画面いっぱいに引き伸ばし（cover）、はみ出た分を切り落とすので、縦長のスマホでは拡大されて見える
// - 描画領域として body ごと画面より大きくするので、スマホのブラウザがページを縮小表示し、HUD まで大きさや位置が変わる
// そこで映像とシーンを固定の枠（view）に入れ、枠の中だけで並べる。
// 映像全体が収まる contain を拡大率 1 とし、そこから zoom 倍で表示する
const fitCamera = (source, view, scene) => {
  const proto = Object.getPrototypeOf(source);
  let zoom = ZOOM_MIN;

  // AR.js が毎フレーム呼ぶ
  source.onResizeElement = function () {
    const video = this.domElement;
    if (!video.videoWidth || !video.videoHeight) return;

    // AR.js は映像を body 直下に置くので、枠の中へ移す
    if (video.parentElement !== view) {
      view.prepend(video);
      video.play().catch(() => {});
    }

    const aspect = video.videoWidth / video.videoHeight;
    const width = Math.min(view.clientWidth, view.clientHeight * aspect) * zoom;
    const height = width / aspect;
    const left = (view.clientWidth - width) / 2;
    const top = (view.clientHeight - height) / 2;
    place(video, width, height, left, top);

    // マーカー検出は映像を 4:3 の枠に収めて行うので、描画領域もその枠に合わせる。
    // 縦長の映像は高さをそろえた 4:3 の枠の中央に置かれる（AR.js 本来の縦画面の扱いと同じ）
    const sceneWidth = aspect <= 1 ? height * 4 / 3 : width;
    place(scene, sceneWidth, height, left + (width - sceneWidth) / 2, top);
  };

  // AR.js は resize のたびに body を描画領域の大きさに合わせようとするが、
  // body には HUD もあるので触らせない（描画領域は onResizeElement で合わせている）
  source.copyElementSizeTo = function (element) {
    if (element !== document.body) proto.copyElementSizeTo.call(this, element);
  };

  return {
    get zoom() {
      return zoom;
    },
    setZoom(value) {
      zoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, value));
      source.onResizeElement();
    },
    // 描画の解像度をシーンの新しい大きさに合わせ直す
    refresh() {
      scene.resize();
    },
  };
};

// 2 本指のピンチで拡大率を変える。ブラウザ自体のページ拡大は止める
const enablePinchZoom = (camera) => {
  let pinch = null;
  const distance = ([a, b]) => Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);

  document.addEventListener('touchstart', (event) => {
    if (event.touches.length === 2) {
      pinch = { distance: distance(event.touches), zoom: camera.zoom };
    }
  }, { passive: true });

  document.addEventListener('touchmove', (event) => {
    if (!pinch || event.touches.length !== 2) return;
    event.preventDefault();
    camera.setZoom(pinch.zoom * distance(event.touches) / pinch.distance);
  }, { passive: false });

  const endPinch = (event) => {
    if (!pinch || event.touches.length >= 2) return;
    pinch = null;
    camera.refresh();
  };
  document.addEventListener('touchend', endPinch);
  document.addEventListener('touchcancel', endPinch);

  // iOS Safari は touch-action や preventDefault だけではページ拡大が止まらない
  document.addEventListener('gesturestart', (event) => event.preventDefault());
};

// arjs システムはシーンの描画が始まってから映像ソースを作るので、できるまで待つ。
// シーン要素の初期化前は systems 自体がないこともある
const whenArSource = (scene) => new Promise((resolve) => {
  const check = () => {
    const source = scene.systems?.arjs?._arSession?.arSource;
    if (source) resolve(source);
    else requestAnimationFrame(check);
  };
  check();
});

const MOTIONS = ['Survey', 'Walk', 'Run'];
const NEXT_LABEL = { Survey: 'Walk', Walk: 'Run', Run: 'Stop' };

const start = async (mode) => {
  document.body.dataset.mode = mode;
  document.querySelector('[data-start]').hidden = true;

  await loadScript(AFRAME_URL);
  if (mode === 'ar') await loadScript(ARJS_URL);
  await loadScript('./components.js');

  document.body.insertAdjacentHTML('afterbegin', SCENES[mode]);

  if (mode === 'ar') {
    const scene = document.querySelector('a-scene');
    whenArSource(scene).then((source) => {
      enablePinchZoom(fitCamera(source, document.querySelector('[data-ar-view]'), scene));
    });
  }

  // tracking status
  const status = document.querySelector('[data-status]');
  const marker = document.querySelector('a-marker');
  if (marker && status) {
    marker.addEventListener('markerFound', () => {
      status.textContent = 'Tracking';
      status.classList.add('is-tracking');
    });
    marker.addEventListener('markerLost', () => {
      status.textContent = 'マーカーを探しています…';
      status.classList.remove('is-tracking');
    });
  }

  // Survey → Walk → Run
  let motion = 0;
  const button = document.querySelector('[data-action="motion"]');
  button.addEventListener('click', () => {
    motion = (motion + 1) % MOTIONS.length;
    const name = MOTIONS[motion];
    document.querySelector('[holo-diorama]').setAttribute('holo-diorama', 'motion', name);
    button.textContent = NEXT_LABEL[name];
  });
};

const mode = new URLSearchParams(location.search).get('mode');
if (mode === 'ar' || mode === 'preview') {
  start(mode).catch((error) => {
    console.error(error);
    // [data-status] は AR モードでしか見えないので、どちらのモードでも見えるヘルプ欄に出す
    document.querySelector('.hud-help').textContent = '読み込みに失敗しました';
  });
}
