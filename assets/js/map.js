/* =========================================================
   map.js — 会場マップ（three.js）

   教室（教室棟 多目的3）を Blender で実測どおりに組んだものを
   assets/models/room.glb として読み込み、企画ごとの目印を置く。
   モデルの座標系は Blender の実寸そのまま（1 単位 = 1m）。
     three.js の x = 教室の左右（0〜7.5m）
     three.js の z = 教室の奥行き（0〜-9.0m ※Y-up 書き出しで符号が反転）
   ========================================================= */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const ROOM = { w: 7.5, d: 9.0, h: 2.6 };

/* 平面図(Blender)の座標を three.js の座標へ。奥行きは符号が反転する。 */
const P = (x, y, z = 0) => new THREE.Vector3(x, z, -y);

/* =========================================================
   企画の一覧（順路の順に並べる）
   ========================================================= */
const ZONES = [
  {
    key: 'vtuber', name: 'VTuber体験', kick: 'ZONE 01', color: '#d9a2e8',
    at: [3.51, 0.88], look: [3.51, 2.6], height: 1.15,
    desc: 'カメラの前に立つと、画面の中のキャラクターが同じように動きます。表情も声も、そのまま乗ります。',
    gear: ['iPhone', 'MacBook Air', 'VTubeStudio', '配信用マイク'],
  },
  {
    key: 'studio', name: 'スタジオ体験', kick: 'ZONE 02', color: '#6ee7a8',
    at: [6.87, 2.09], look: [5.2, 2.6], height: 1.35,
    desc: 'グリーンバックの前に立って、背景を自由に差し替えます。合成した映像はその場でモニターに出ます。',
    gear: ['グリーンバック', '照明', 'ビデオカメラ', '合成用PC'],
  },
  {
    key: 'pc-mid', name: 'PC展示', kick: 'ZONE 03', color: '#7ee081',
    at: [1.86, 3.62], look: [3.4, 3.62], height: 1.2,
    desc: '部員が作ったゲームやアプリを、実際にその場で触って遊べます。ソースコードも見せます。',
    gear: ['MacBook Air ×8', 'ゲームパッド', '作品の解説パネル'],
  },
  {
    key: 'vocaloid', name: 'VOCALOID体験', kick: 'ZONE 04', color: '#5ad2e8',
    at: [1.86, 5.42], look: [3.4, 5.42], height: 1.2,
    desc: '打ち込んだメロディーに歌詞をのせて、その場で歌わせます。作った曲は持ち帰れます。',
    gear: ['MIDIキーボード', 'モニター', 'ヘッドホン', 'MacBook Air'],
  },
  {
    key: 'model3d', name: '3Dモデル展示', kick: 'ZONE 05', color: '#f0b25e',
    at: [5.85, 7.79], look: [5.85, 6.3], height: 1.2,
    desc: 'Blender で作ったモデルと、3Dプリンターで出力した実物を並べています。手に取って見られます。',
    gear: ['3Dプリント出力物', '展示台', 'モデル閲覧用モニター'],
  },
  {
    key: 'pc-top', name: 'PC展示', kick: 'ZONE 06', color: '#7ee081',
    at: [2.55, 7.79], look: [2.55, 6.3], height: 1.2,
    desc: '映像作品と、部員が半年かけて作ったゲームの展示です。こちらも自由に遊べます。',
    gear: ['MacBook Air ×6', '映像作品', '作品の解説パネル'],
  },
];

/* 入口・出口（順路の起点と終点。カードは出さず、視点だけ動かす） */
const DOORS = {
  in: { name: '入口', at: [0.0, 1.74] },
  out: { name: '出口', at: [0.0, 7.85] },
};

/* =========================================================
   下ごしらえ
   ========================================================= */
const stage = document.getElementById('mapstage');
const card = document.getElementById('zonecard');
const routeBar = document.getElementById('route');

const scene = new THREE.Scene();
scene.background = null;

const camera = new THREE.PerspectiveCamera(46, 1, 0.05, 200);
const HOME = { pos: P(3.75, -4.6, 5.0), target: P(3.75, 4.6, 0.8) };
camera.position.copy(HOME.pos);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
stage.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.075;
controls.target.copy(HOME.target);
controls.minDistance = 1.6;
controls.maxDistance = 22;
controls.maxPolarAngle = Math.PI * 0.495;   // 床下へ潜らせない
controls.enablePan = true;
controls.panSpeed = 0.6;

/* ---- 照明：教室の蛍光灯に寄せる ----
   three.js は r155 以降、光の強さが物理単位（カンデラ）なので
   点光源はそれなりに大きな値を入れないと部屋が暗いままになる。 */
scene.add(new THREE.AmbientLight(0xdfe9f5, 1.1));
scene.add(new THREE.HemisphereLight(0xeaf2ff, 0x4a5058, 2.2));

const key = new THREE.DirectionalLight(0xfff6e8, 2.0);
key.position.copy(P(5.2, 2.4, 5.2));
scene.add(key);

const fill = new THREE.DirectionalLight(0xcfe0ff, 1.1);
fill.position.copy(P(1.0, 7.5, 4.0));
scene.add(fill);

/* 天井の照明3列を、点光源で置き換える */
[1.45, 3.75, 6.05].forEach((x) => {
  [1.9, 4.6, 7.3].forEach((y) => {
    const l = new THREE.PointLight(0xfff4e2, 26, 11, 2);
    l.position.copy(P(x, y, 2.42));
    scene.add(l);
  });
});

/* =========================================================
   目印（クリックできる丸）
   ========================================================= */
const markers = [];
const markerGroup = new THREE.Group();
scene.add(markerGroup);

function makeMarker(zone, i) {
  const col = new THREE.Color(zone.color);
  const g = new THREE.Group();
  g.position.copy(P(zone.at[0], zone.at[1], zone.height));

  const ball = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.17, 2),
    new THREE.MeshStandardMaterial({
      color: col, emissive: col, emissiveIntensity: 0.85,
      roughness: 0.35, metalness: 0.1,
    })
  );
  g.add(ball);

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.30, 0.014, 8, 40),
    new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.85 })
  );
  ring.rotation.x = Math.PI / 2;
  g.add(ring);

  /* 床まで伸びる細い光の柱 */
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.022, 0.022, zone.height, 6, 1, true),
    new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.32 })
  );
  beam.position.y = -zone.height / 2;
  g.add(beam);

  /* 当たり判定は大きめの見えない球で取る（小さい玉は押しにくい） */
  const hit = new THREE.Mesh(
    new THREE.SphereGeometry(0.42, 12, 10),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  hit.userData.index = i;
  g.add(hit);

  markerGroup.add(g);
  markers.push({ group: g, ball, ring, hit, zone, index: i });
  return g;
}

ZONES.forEach(makeMarker);

/* =========================================================
   壁の出し入れ

   壁は 8cm の厚みがある板なので、裏面だけ描いても透けない。
   そこで「カメラと部屋の間に来た壁」をまるごと隠す。
   壁に付いている物（ホワイトボード・ロッカー・窓）も一緒に隠さないと、
   壁だけ消えて板が宙に浮いて見えてしまう。
   ========================================================= */
const walls = { near: [], far: [], left: [], right: [] };

function wallSideOf(name) {
  if (name === '壁_手前' || name.startsWith('WB_') || name.startsWith('SPK_')) return 'near';
  if (name === '壁_奥' || name.startsWith('LOCKER') || name.startsWith('BIN_')) return 'far';
  if (name.startsWith('壁_左') || name.startsWith('枠_') ||
      name.startsWith('PART_') || name.startsWith('POSTER_左')) return 'left';
  if (name === '壁_右' || name.startsWith('WIN_') ||
      name.startsWith('CURTAIN') || name.startsWith('POSTER_右')) return 'right';
  return null;
}

const CENTER = P(ROOM.w / 2, ROOM.d / 2, 0);

function updateWalls() {
  const c = camera.position;
  const show = {
    near: c.z < CENTER.z + 0.2,     /* 手前側から見ているときは手前の壁を消す */
    far: c.z > CENTER.z - 0.2,
    left: c.x > CENTER.x - 0.2,
    right: c.x < CENTER.x + 0.2,
  };
  for (const side of ['near', 'far', 'left', 'right']) {
    for (const o of walls[side]) o.visible = show[side];
  }
}

/* =========================================================
   モデルの読み込み
   ========================================================= */
let roomReady = false;
const loader = new GLTFLoader();
loader.load(
  'assets/models/room.glb',
  (gltf) => {
    const room = gltf.scene;

    /* 上から覗き込む地図なので、天井の板そのものは消す。
       照明器具や吹き出し口は残すので、天井の様子は分かる。 */
    const done = new Set();

    room.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = false;
        o.receiveShadow = false;
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach((m) => {
          if (!m || done.has(m.uuid)) return;
          done.add(m.uuid);
          if (m.map) m.map.anisotropy = 4;
          if (m.emissive && m.emissiveIntensity > 0) m.emissiveIntensity = 1.0;
        });
      }

      /* 材質が複数あるものは Mesh ではなく Group で入ってくるので、
         Mesh に限らず「名前」で判定する。 */
      if (o.name === '天井') o.visible = false;
      const side = wallSideOf(o.name);
      if (side) walls[side].push(o);
    });

    scene.add(room);
    roomReady = true;
    updateWalls();
    stage.classList.add('is-ready');

    /* 実際に読み込めた範囲を測って、目印がずれていないか確かめられるようにする */
    const box = new THREE.Box3().setFromObject(room);
    console.info('[map] room bounds',
      box.min.toArray().map((v) => v.toFixed(2)).join(', '), '→',
      box.max.toArray().map((v) => v.toFixed(2)).join(', '));
  },
  undefined,
  (err) => {
    console.error('room.glb を読み込めませんでした', err);
    stage.classList.add('is-error');
  }
);

/* =========================================================
   カメラの移動（自前の簡単なイージング）
   ========================================================= */
let fly = null;
function flyTo(pos, target, ms = 900) {
  fly = { t: 0, ms, p0: camera.position.clone(), p1: pos.clone(), t0: controls.target.clone(), t1: target.clone() };
}
const easeInOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

/* =========================================================
   説明カード
   ========================================================= */
let current = -1;

function openZone(i, move = true) {
  const z = ZONES[i];
  if (!z) return;
  current = i;

  document.getElementById('zone-kick').textContent = z.kick;
  document.getElementById('zone-title').textContent = z.name;
  document.getElementById('zone-desc').textContent = z.desc;
  document.getElementById('zone-gear').innerHTML =
    z.gear.map((g) => `<span>${g}</span>`).join('');
  document.getElementById('zone-staff').textContent = '担当は決まり次第、ここに載せます。';
  card.classList.remove('off');

  /* 入口・出口も .route-chip なので、企画のチップだけを選び直す */
  routeBar.querySelectorAll('.route-chip[data-zone]').forEach((c) => {
    c.classList.toggle('on', Number(c.dataset.zone) === i);
  });

  markers.forEach((m) => {
    const on = m.index === i;
    m.ball.material.emissiveIntensity = on ? 1.5 : 0.85;
    m.ring.material.opacity = on ? 1.0 : 0.85;
  });

  if (move) {
    /* 目印を斜め上から見下ろす位置へ。
       室内に潜り込むと壁が消えて白い空洞になるので、
       水平方向に十分離し、高さは天井より上に置く。 */
    const to = P(z.at[0], z.at[1], 0.95);
    const dir = P(z.look[0], z.look[1], 0).sub(P(z.at[0], z.at[1], 0));
    dir.y = 0;
    if (dir.lengthSq() < 1e-4) dir.set(0, 0, 1);
    dir.normalize().multiplyScalar(5.4);
    const eye = to.clone().add(dir);
    eye.y = 4.0;
    flyTo(eye, to);
  }
}

function closeZone() {
  current = -1;
  card.classList.add('off');
  routeBar.querySelectorAll('.route-chip[data-zone]').forEach((c) => c.classList.remove('on'));
  markers.forEach((m) => {
    m.ball.material.emissiveIntensity = 0.85;
    m.ring.material.opacity = 0.85;
  });
}

document.getElementById('zone-close').addEventListener('click', closeZone);
document.getElementById('map-reset').addEventListener('click', () => {
  closeZone();
  flyTo(HOME.pos, HOME.target);
});

/* =========================================================
   順路のチップ
   ========================================================= */
function buildRoute() {
  const frag = document.createDocumentFragment();

  const doorChip = (d) => {
    const s = document.createElement('span');
    s.className = 'route-chip route-door';
    s.textContent = d.name;
    return s;
  };

  frag.appendChild(doorChip(DOORS.in));
  ZONES.forEach((z, i) => {
    const arrow = document.createElement('span');
    arrow.className = 'route-arrow';
    arrow.textContent = '›';
    frag.appendChild(arrow);

    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'route-chip';
    b.dataset.zone = String(i);
    b.style.setProperty('--c', z.color);
    b.innerHTML = `<b>${i + 1}</b>${z.name}`;
    b.addEventListener('click', () => openZone(i));
    frag.appendChild(b);
  });
  const arrow = document.createElement('span');
  arrow.className = 'route-arrow';
  arrow.textContent = '›';
  frag.appendChild(arrow);
  frag.appendChild(doorChip(DOORS.out));

  routeBar.appendChild(frag);
}
buildRoute();

/* =========================================================
   クリックで目印を選ぶ
   ========================================================= */
const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2();
let downAt = null;

renderer.domElement.addEventListener('pointerdown', (e) => {
  downAt = { x: e.clientX, y: e.clientY };
});

renderer.domElement.addEventListener('pointerup', (e) => {
  /* ドラッグで視点を回した時は選択しない */
  if (!downAt) return;
  const moved = Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y);
  downAt = null;
  if (moved > 6) return;

  const r = renderer.domElement.getBoundingClientRect();
  ndc.x = ((e.clientX - r.left) / r.width) * 2 - 1;
  ndc.y = -((e.clientY - r.top) / r.height) * 2 + 1;
  ray.setFromCamera(ndc, camera);

  const hits = ray.intersectObjects(markers.map((m) => m.hit), false);
  if (hits.length) openZone(hits[0].object.userData.index);
});

/* 目印の上ではカーソルを指の形に */
renderer.domElement.addEventListener('pointermove', (e) => {
  const r = renderer.domElement.getBoundingClientRect();
  ndc.x = ((e.clientX - r.left) / r.width) * 2 - 1;
  ndc.y = -((e.clientY - r.top) / r.height) * 2 + 1;
  ray.setFromCamera(ndc, camera);
  const hit = ray.intersectObjects(markers.map((m) => m.hit), false).length > 0;
  renderer.domElement.style.cursor = hit ? 'pointer' : 'grab';
});

/* キーボードでも閉じられるように */
addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeZone();
});

/* =========================================================
   画面サイズ
   ========================================================= */
function resize() {
  const w = stage.clientWidth || innerWidth;
  const h = stage.clientHeight || innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h, false);
}
addEventListener('resize', resize);
resize();

/* =========================================================
   毎フレーム
   ========================================================= */
const REDUCE = matchMedia('(prefers-reduced-motion: reduce)').matches;
const clock = new THREE.Clock();

function tick() {
  requestAnimationFrame(tick);
  const dt = clock.getDelta();
  const t = clock.elapsedTime;

  if (fly) {
    fly.t += dt * 1000;
    const k = Math.min(1, fly.t / fly.ms);
    const e = easeInOut(k);
    camera.position.lerpVectors(fly.p0, fly.p1, e);
    controls.target.lerpVectors(fly.t0, fly.t1, e);
    if (k >= 1) fly = null;
  }

  if (!REDUCE) {
    markers.forEach((m, i) => {
      m.group.children[0].rotation.y += dt * 0.55;
      m.ring.rotation.z = t * 0.5 + i;
      const s = 1 + Math.sin(t * 1.9 + i * 1.3) * 0.06;
      m.ring.scale.setScalar(s);
    });
  }

  controls.update();
  if (roomReady) updateWalls();
  renderer.render(scene, camera);
}
tick();
