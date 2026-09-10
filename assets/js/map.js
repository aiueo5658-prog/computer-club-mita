/* =========================================================
   map.js — 会場マップ（three.js / ホログラム走査モード）

   教室（教室棟 多目的3）を Blender で実測どおりに組んだものを
   assets/models/room.glb として読み込み、緑のホログラムとして描く。

   サイト全体が「黒地＋光っているものだけが浮かぶ」作りなので、
   マップも同じ言語で描く。面はほとんど透明にして、輪郭線に情報を持たせる。
   すべて加算合成なので、キャンバスは透過のまま。背景の星やリムグローが
   マップの向こうに透けて、ページと地続きに見える。

   モデルの座標系は Blender の実寸そのまま（1 単位 = 1m）。
     three.js の x = 教室の左右（0〜7.5m）
     three.js の z = 教室の奥行き（0〜-9.0m ※Y-up 書き出しで符号が反転）
   ========================================================= */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const ROOM = { w: 7.5, d: 9.0, h: 2.6 };
const ACID = 0x00ff9c;          /* サイトの --acid と同じ */

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
/* 左には見出しが乗るので、視点ごと横へずらして教室を右寄りに置く。
   位置と注視点を同じだけずらすので、見る向きは変わらない。 */
const SHIFT = innerWidth >= 1100 ? 1.4 : 0;
const HOME = { pos: P(3.75 - SHIFT, -4.6, 5.0), target: P(3.75 - SHIFT, 4.6, 0.8) };
camera.position.copy(HOME.pos);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setClearColor(0x000000, 0);
renderer.outputColorSpace = THREE.SRGBColorSpace;
stage.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.075;
controls.target.copy(HOME.target);
controls.minDistance = 1.6;
controls.maxDistance = 22;
controls.maxPolarAngle = Math.PI * 0.495;
controls.enablePan = true;
controls.panSpeed = 0.6;

/* =========================================================
   ホログラムの材質

   面 : ほとんど透明。視線に対して斜めなところ（＝縁）ほど光る。
        細かい走査線と、下から上へ昇っていく明るい帯を重ねる。
   線 : 形の情報はこちらが持つ。面より強く光らせる。
   どちらも加算合成なので、重なるほど明るくなり、光って見える。
   ========================================================= */
const U = {
  uTime: { value: 0 },
  uColor: { value: new THREE.Color(ACID) },
  uSweep: { value: 0 },
};

/* 遠くのものを暗く落とす。奥行きが出て、緑の壁のようにベタッとしなくなる。 */
const FADE = `
  float depthFade(vec3 w){
    float d = length(cameraPosition - w);
    return 1.0 - smoothstep(3.5, 15.0, d);
  }
`;

const HOLO_VERT = `
  varying vec3 vWorld;
  varying vec3 vNrm;
  varying vec3 vView;
  void main(){
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorld = wp.xyz;
    vNrm = normalize(mat3(modelMatrix) * normal);
    vView = normalize(cameraPosition - wp.xyz);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const LINE_VERT = `
  varying vec3 vWorld;
  void main(){
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorld = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

/* 建築（壁・床・ロッカーなど）は強く、家具や小物は弱く。
   全部を同じ明るさで描くと情報が団子になって読めない。 */
function makeFill(gain) {
  return new THREE.ShaderMaterial({
    uniforms: { ...U, uGain: { value: gain } },
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
    vertexShader: HOLO_VERT,
    fragmentShader: `
      uniform float uSweep;
      uniform vec3 uColor;
      uniform float uGain;
      varying vec3 vWorld;
      varying vec3 vNrm;
      varying vec3 vView;
      ${FADE}
      void main(){
        /* 縁ほど明るく（フレネル）。面の中心はほぼ透明にする。 */
        float f = 1.0 - abs(dot(normalize(vNrm), normalize(vView)));
        f = pow(clamp(f, 0.0, 1.0), 3.2);

        float lines = 0.5 + 0.5 * sin(vWorld.y * 150.0);
        float band = exp(-pow((vWorld.y - uSweep) * 5.0, 2.0));

        float a = (0.009 * (0.12 + f * 2.0) * (0.72 + 0.28 * lines) + band * 0.024) * uGain;
        vec3 c = uColor * (0.30 + f * 0.9 + band * 0.9);
        gl_FragColor = vec4(c, a * depthFade(vWorld));
      }
    `,
  });
}

function makeEdge(gain) {
  return new THREE.ShaderMaterial({
    uniforms: { ...U, uGain: { value: gain } },
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    vertexShader: LINE_VERT,
    fragmentShader: `
      uniform float uSweep;
      uniform vec3 uColor;
      uniform float uGain;
      varying vec3 vWorld;
      ${FADE}
      void main(){
        float band = exp(-pow((vWorld.y - uSweep) * 4.5, 2.0));
        float lines = 0.85 + 0.15 * sin(vWorld.y * 150.0);
        float a = (0.075 + band * 0.20) * lines * uGain;
        gl_FragColor = vec4(uColor * (0.42 + band * 1.2), a * depthFade(vWorld));
      }
    `,
  });
}

/* 建築＝はっきり、家具＝控えめ */
const MAT = {
  arch: { fill: makeFill(1.0), edge: makeEdge(1.15) },
  prop: { fill: makeFill(0.24), edge: makeEdge(0.34) },
};

/* =========================================================
   床のグリッド

   四角い箱が黒地にスパッと切れていると貼り付けたように見えるので、
   床を外へ向かってなだらかに消えるグリッドにして、輪郭をぼかす。
   ========================================================= */
function makeGrid() {
  const g = new THREE.PlaneGeometry(ROOM.w * 2.6, ROOM.d * 2.6, 1, 1);
  const m = new THREE.ShaderMaterial({
    uniforms: U,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
    vertexShader: `
      varying vec3 vWorld;
      void main(){
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorld = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform vec3 uColor;
      varying vec3 vWorld;

      float gridLine(vec2 p, float step, float w){
        vec2 q = abs(fract(p / step - 0.5) - 0.5) * step;
        vec2 d = fwidth(p) * w;
        vec2 s = smoothstep(d, vec2(0.0), q);
        return max(s.x, s.y);
      }

      void main(){
        vec2 p = vWorld.xz;
        float fine = gridLine(p, 0.5, 1.0) * 0.35;
        float bold = gridLine(p, 2.5, 1.4) * 0.75;
        float g = max(fine, bold);

        /* 教室の中心から離れるほど消す（外周をぼかして黒に溶かす） */
        vec2 c = vec2(3.75, -4.5);
        float r = length((p - c) / vec2(9.0, 10.5));
        float fade = 1.0 - smoothstep(0.28, 1.0, r);

        gl_FragColor = vec4(uColor * 0.75, g * fade * 0.20);
      }
    `,
  });
  const mesh = new THREE.Mesh(g, m);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(3.75, -0.006, -4.5);
  return mesh;
}
scene.add(makeGrid());

/* =========================================================
   目印（クリックできる丸）
   ========================================================= */
const markers = [];
const markerGroup = new THREE.Group();
scene.add(markerGroup);

/* 発光のにじみ。板1枚に放射状のグラデーションを描いて加算で重ねる。 */
const HALO_TEX = (() => {
  const s = 128;
  const cv = document.createElement('canvas');
  cv.width = cv.height = s;
  const g = cv.getContext('2d').createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0.00, 'rgba(255,255,255,1)');
  g.addColorStop(0.18, 'rgba(255,255,255,.55)');
  g.addColorStop(0.45, 'rgba(255,255,255,.16)');
  g.addColorStop(1.00, 'rgba(255,255,255,0)');
  const ctx = cv.getContext('2d');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
})();

function makeMarker(zone, i) {
  const col = new THREE.Color(zone.color);
  const g = new THREE.Group();
  g.position.copy(P(zone.at[0], zone.at[1], zone.height));

  /* にじみ（いちばん外側） */
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({
    map: HALO_TEX, color: col, transparent: true,
    blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.75,
  }));
  halo.scale.setScalar(1.5);
  g.add(halo);

  /* 芯 */
  const ball = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.14, 1),
    new THREE.MeshBasicMaterial({
      color: col, transparent: true, opacity: 0.85,
      blending: THREE.AdditiveBlending, depthWrite: false,
    })
  );
  g.add(ball);

  /* 芯のワイヤー（ホログラムらしさ） */
  const wire = new THREE.LineSegments(
    new THREE.EdgesGeometry(ball.geometry, 1),
    new THREE.LineBasicMaterial({
      color: col, transparent: true, opacity: 0.9,
      blending: THREE.AdditiveBlending, depthWrite: false,
    })
  );
  g.add(wire);

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.30, 0.010, 6, 44),
    new THREE.MeshBasicMaterial({
      color: col, transparent: true, opacity: 0.9,
      blending: THREE.AdditiveBlending, depthWrite: false,
    })
  );
  ring.rotation.x = Math.PI / 2;
  g.add(ring);

  /* 床まで伸びる光の柱 */
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.016, 0.016, zone.height, 6, 1, true),
    new THREE.MeshBasicMaterial({
      color: col, transparent: true, opacity: 0.28,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    })
  );
  beam.position.y = -zone.height / 2;
  g.add(beam);

  /* 足元の輪 */
  const foot = new THREE.Mesh(
    new THREE.RingGeometry(0.34, 0.40, 40),
    new THREE.MeshBasicMaterial({
      color: col, transparent: true, opacity: 0.5,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    })
  );
  foot.rotation.x = -Math.PI / 2;
  foot.position.y = -zone.height + 0.01;
  g.add(foot);

  /* 当たり判定は大きめの見えない球で取る（小さい玉は押しにくい） */
  const hit = new THREE.Mesh(
    new THREE.SphereGeometry(0.42, 12, 10),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  hit.userData.index = i;
  g.add(hit);

  markerGroup.add(g);
  markers.push({ group: g, ball, wire, ring, halo, beam, foot, hit, zone, index: i });
}

ZONES.forEach(makeMarker);

/* =========================================================
   壁の出し入れ

   壁は 8cm の厚みがある板なので、手前の壁があると中が見づらい。
   カメラと部屋の間に来た壁は、線ごと消す。
   ========================================================= */
const walls = { near: [], far: [], left: [], right: [] };

function wallSideOf(name) {
  if (name === '壁_手前' || name.startsWith('WB_') || name.startsWith('SPK_')) return 'near';
  if (name === '壁_奥' || name.startsWith('LOCKER') || name.startsWith('BIN_')) return 'far';
  if (name.startsWith('壁_左') || name.startsWith('枠_') || name.startsWith('DOOR_') ||
      name.startsWith('BOARD_') || name.startsWith('PART_') || name.startsWith('POSTER_左')) return 'left';
  if (name === '壁_右' || name.startsWith('WIN_') ||
      name.startsWith('CURTAIN') || name.startsWith('POSTER_右')) return 'right';
  return null;
}

const CENTER = P(ROOM.w / 2, ROOM.d / 2, 0);

function updateWalls() {
  const c = camera.position;
  const show = {
    near: c.z < CENTER.z + 0.2,
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

/* 同じ形は使い回されているので、輪郭線も形ごとに一度だけ作る。
   しきい値を大きめに取って、細かい面の継ぎ目までは線にしない。 */
const edgeCache = new Map();
function edgesFor(geom) {
  let e = edgeCache.get(geom.uuid);
  if (!e) {
    e = new THREE.EdgesGeometry(geom, 42);
    edgeCache.set(geom.uuid, e);
  }
  return e;
}

/* 机・椅子・ノートPC・机上の機材は「小物」扱いにして控えめに描く。
   材質が複数あるものは Group の子（Cube001 など）で入ってくるので、
   意味のある名前は親側にある。 */
const ANON = /^(Cube|Circle|Plane|円柱|立方体|球|平面)/;
function isProp(o) {
  const own = o.name && !ANON.test(o.name) ? o.name : '';
  const up = !own && o.parent ? o.parent.name : '';
  const nm = own || up || '';
  return /^(机_|椅子_|MBA_|GEAR_)/.test(nm);
}

/* 動かないものをワールド座標に焼いて1つの形にまとめる。
   属性の並びが揃っていないと結合できないので、位置と法線だけに削ってから繋ぐ。 */
function bake(meshes, pick, withNormals) {
  const geos = [];
  for (const o of meshes) {
    let g = pick(o).clone();
    if (g.index) g = g.toNonIndexed();
    for (const key of Object.keys(g.attributes)) {
      const keep = key === 'position' || (withNormals && key === 'normal');
      if (!keep) g.deleteAttribute(key);
    }
    if (withNormals && !g.attributes.normal) g.computeVertexNormals();
    g.applyMatrix4(o.matrixWorld);
    geos.push(g);
  }
  if (!geos.length) return null;
  const merged = mergeGeometries(geos, false);
  geos.forEach((g) => g.dispose());
  return merged;
}

loader.load(
  'assets/models/room.glb',
  (gltf) => {
    const room = gltf.scene;
    const meshes = [];

    room.traverse((o) => {
      if (o.isMesh) meshes.push(o);
      if (o.name === '天井') o.visible = false;
      const side = wallSideOf(o.name);
      if (side) walls[side].push(o);
    });

    room.updateMatrixWorld(true);
    for (const o of meshes) {
      const old = Array.isArray(o.material) ? o.material : [o.material];
      old.forEach((m) => m && m.dispose && m.dispose());
      o.castShadow = o.receiveShadow = false;
    }

    /* 建築は壁ごとに出し入れするので、1つずつ描く。
       机・椅子・ノートPCは動かないうえ数が多いので、
       ワールド座標に焼いて1つにまとめ、描画回数を減らす。 */
    const archMeshes = meshes.filter((o) => !isProp(o));
    const propMeshes = meshes.filter((o) => isProp(o));

    for (const o of archMeshes) {
      o.material = MAT.arch.fill;
      o.add(new THREE.LineSegments(edgesFor(o.geometry), MAT.arch.edge));
    }

    const bakedFill = bake(propMeshes, (o) => o.geometry, true);
    const bakedEdge = bake(propMeshes, (o) => edgesFor(o.geometry), false);
    for (const o of propMeshes) o.visible = false;
    if (bakedFill) scene.add(new THREE.Mesh(bakedFill, MAT.prop.fill));
    if (bakedEdge) scene.add(new THREE.LineSegments(bakedEdge, MAT.prop.edge));

    scene.add(room);
    roomReady = true;
    updateWalls();
    stage.classList.add('is-ready');
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
    m.halo.material.opacity = on ? 1.25 : 0.75;
    m.halo.scale.setScalar(on ? 2.1 : 1.5);
    m.ring.material.opacity = on ? 1.0 : 0.9;
    m.beam.material.opacity = on ? 0.5 : 0.28;
    m.foot.material.opacity = on ? 0.85 : 0.5;
  });

  if (move) {
    /* 目印を斜め上から見下ろす位置へ。
       室内に潜り込むと見づらいので、水平方向に離して高さも取る。 */
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
    m.halo.material.opacity = 0.75;
    m.halo.scale.setScalar(1.5);
    m.ring.material.opacity = 0.9;
    m.beam.material.opacity = 0.28;
    m.foot.material.opacity = 0.5;
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
  const arrow = () => {
    const a = document.createElement('span');
    a.className = 'route-arrow';
    a.textContent = '›';
    return a;
  };

  frag.appendChild(doorChip(DOORS.in));
  ZONES.forEach((z, i) => {
    frag.appendChild(arrow());
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'route-chip';
    b.dataset.zone = String(i);
    b.style.setProperty('--c', z.color);
    b.innerHTML = `<b>${i + 1}</b>${z.name}`;
    b.addEventListener('click', () => openZone(i));
    frag.appendChild(b);
  });
  frag.appendChild(arrow());
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

function toNdc(e) {
  const r = renderer.domElement.getBoundingClientRect();
  ndc.x = ((e.clientX - r.left) / r.width) * 2 - 1;
  ndc.y = -((e.clientY - r.top) / r.height) * 2 + 1;
}

renderer.domElement.addEventListener('pointerdown', (e) => {
  downAt = { x: e.clientX, y: e.clientY };
});

renderer.domElement.addEventListener('pointerup', (e) => {
  if (!downAt) return;
  const moved = Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y);
  downAt = null;
  if (moved > 6) return;          /* 視点を回しただけのときは選ばない */

  toNdc(e);
  ray.setFromCamera(ndc, camera);
  const hits = ray.intersectObjects(markers.map((m) => m.hit), false);
  if (hits.length) openZone(hits[0].object.userData.index);
});

renderer.domElement.addEventListener('pointermove', (e) => {
  if (e.pointerType === 'touch') return;
  toNdc(e);
  ray.setFromCamera(ndc, camera);
  const hit = ray.intersectObjects(markers.map((m) => m.hit), false).length > 0;
  renderer.domElement.style.cursor = hit ? 'pointer' : 'grab';
});

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
const SWEEP_SPAN = 3.6;         /* 走査の帯が上りきる高さ */

function tick() {
  requestAnimationFrame(tick);
  const dt = clock.getDelta();
  const t = clock.elapsedTime;

  U.uTime.value = t;
  /* 走査の帯は、床より下から天井より上まで、ゆっくり昇っては戻る */
  U.uSweep.value = REDUCE ? 999 : (t * 0.5) % (SWEEP_SPAN + 2.2) - 0.9;

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
      m.ball.rotation.y += dt * 0.5;
      m.wire.rotation.y = m.ball.rotation.y;
      m.ring.rotation.z = t * 0.5 + i;
      m.ring.scale.setScalar(1 + Math.sin(t * 1.9 + i * 1.3) * 0.06);
      m.foot.scale.setScalar(1 + Math.sin(t * 1.6 + i) * 0.08);
    });
  }

  controls.update();
  if (roomReady) updateWalls();
  renderer.render(scene, camera);
}
tick();
