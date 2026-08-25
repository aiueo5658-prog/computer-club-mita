/* =========================================================
   map.js — 会場マップ（three.js）

   部員が清書した見取り図（展示エリア／体験エリアの色分け図）を
   もとに、区画の位置・大きさをそのまま床のエリアとして再現している。
   什器（PC・ホワイトボード・モニターなど）は簡易な3Dモデル。
   単位はメートルのつもり。
   ========================================================= */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const GREEN = 0x00ff9c;   /* 体験・配信 */
const BLUE  = 0x4fd0e8;   /* 展示 */

/* 部屋：多目的3。出口＝左上、入口＝左下。 */
var ROOM = { xMin: -5, xMax: 5, zMin: -6.5, zMax: 6.5, wallH: 2.6 };
var DOOR_OUT = { x: ROOM.xMin, z: -5.3, w: 1.2 };  /* 出口 */
var DOOR_IN  = { x: ROOM.xMin, z: 4.4,  w: 1.2 };  /* 入口 */

/* 入口 → 出口の順。rect は床の区画（清書図の箱をそのまま）。
   furnAt は什器を置く位置（区画の中心からのずれ）。 */
const ZONES = [
  { key:'stream', type:'配信', color:GREEN, furn:'stream',
    rect:{ x1:-4.8, x2:-1.7, z1:3.9, z2:5.4 },
    name:'配信スペース', sub:'配信・スイッチャー等',
    desc:'配信や映像のスイッチングをする裏方スペースです。会場の様子を、この場所から送り出します。',
    gear:['PC', '配信スイッチャー'] },
  { key:'vtuber', type:'体験', color:GREEN, furn:'pc+wb',
    rect:{ x1:-1.3, x2:1.7, z1:3.9, z2:5.4 },
    name:'VTuber体験', sub:'VTuber体験コーナー',
    desc:'来場者の動きを、その場でアバターがコピーします。モニターに映る自分の分身は、まるで鏡に映っているかのようです。',
    gear:['ホワイトボード', 'PC', 'モニター'] },
  { key:'switch', type:'体験', color:GREEN, furn:'switch',
    rect:{ x1:1.9, x2:4.8, z1:3.9, z2:5.4 },
    name:'スイッチ体験', sub:'スイッチ体験コーナー',
    desc:'Nintendo Switch を使った体験コーナーです。',
    gear:['Nintendo Switch', 'モニター'] },
  { key:'vocaloid', type:'体験', color:GREEN, furn:'midi',
    rect:{ x1:-4.4, x2:1.2, z1:0.7, z2:2.5 },
    name:'VOCALOID体験', sub:'体験コーナー',
    desc:'合成音声の技術を、実際にさわって確かめられます。MIDIキーボードを弾くと、その場で声に変わります。',
    gear:['MIDIキーボード', 'PC'] },
  { key:'wallmon', type:'展示', color:BLUE, furn:'wallmon',
    rect:{ x1:3.9, x2:4.85, z1:-3.8, z2:2.4 },
    name:'モニター・展示', sub:'壁面',
    desc:'右の壁にモニターを並べた展示です。順路のあいだ、ずっと横に見えています。',
    gear:['モニター（壁掛け）'] },
  { key:'works1', type:'展示', color:BLUE, furn:'pcrow3',
    rect:{ x1:-4.35, x2:2.35, z1:-2.4, z2:-1.2 },
    name:'展示スペース', sub:'ポスター・作品展示など',
    desc:'部員のポスターや作品を並べる展示スペースです。',
    gear:['ポスター', 'PC'] },
  { key:'wallmon2', type:'展示', color:BLUE, furn:'monitorbox',
    rect:{ x1:2.7, x2:4.5, z1:-6.3, z2:-4.8 },
    name:'モニター展示', sub:'展示エリア',
    desc:'映像作品などをモニターで流す展示コーナーです。',
    gear:['モニター'] },
  { key:'works2', type:'展示', color:BLUE, furn:'pcrow2',
    rect:{ x1:-2.2, x2:1.8, z1:-6.3, z2:-4.8 },
    name:'展示スペース', sub:'ポスター・作品展示など',
    desc:'出口そばの展示スペースです。ポスターや作品を並べます。',
    gear:['ポスター', 'PC'] }
];

var host = document.getElementById('mapstage');
var REDUCE = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

var scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x020a07, 0.018);

var camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
var HOME = new THREE.Vector3(3, 14, 16);
var TARGET_HOME = new THREE.Vector3(0, 0, -0.3);
camera.position.copy(HOME);

var renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
host.appendChild(renderer.domElement);

var controls = new OrbitControls(camera, renderer.domElement);
controls.target.copy(TARGET_HOME);
controls.enablePan = false;
controls.minDistance = 6;
controls.maxDistance = 28;
controls.maxPolarAngle = Math.PI / 2.15;
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.autoRotate = !REDUCE;
controls.autoRotateSpeed = 0.35;
controls.update();

['pointerdown', 'wheel'].forEach(function (ev) {
  renderer.domElement.addEventListener(ev, function () { controls.autoRotate = false; }, { once: true, passive: true });
});

function resize() {
  var r = host.getBoundingClientRect();
  camera.aspect = r.width / r.height;
  camera.updateProjectionMatrix();
  renderer.setSize(r.width, r.height);
}
resize();
addEventListener('resize', resize);

scene.add(new THREE.AmbientLight(0x9fe8c8, 0.6));
var key = new THREE.DirectionalLight(0xdfffe9, 0.55);
key.position.set(6, 10, 8);
scene.add(key);

/* ---- 床 ---- */
var floor = new THREE.Mesh(
  new THREE.PlaneGeometry(ROOM.xMax - ROOM.xMin, ROOM.zMax - ROOM.zMin),
  new THREE.MeshStandardMaterial({ color: 0x081a13, roughness: 0.95 })
);
floor.rotation.x = -Math.PI / 2;
floor.position.set((ROOM.xMin + ROOM.xMax) / 2, 0, (ROOM.zMin + ROOM.zMax) / 2);
scene.add(floor);

var grid = new THREE.GridHelper(14, 28, 0x0c3324, 0x0c3324);
grid.position.y = 0.004;
scene.add(grid);

/* ---- 区画：清書図の箱をそのまま床の色分けにする ---- */
function zoneFloor(rect, color) {
  var w = rect.x2 - rect.x1, d = rect.z2 - rect.z1;
  var g = new THREE.Group();
  var fill = new THREE.Mesh(
    new THREE.PlaneGeometry(w, d),
    new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 0.1 })
  );
  fill.rotation.x = -Math.PI / 2;
  fill.position.set(0, 0.008, 0);
  g.add(fill);
  var edge = new THREE.LineLoop(
    new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-w / 2, 0.01, -d / 2), new THREE.Vector3(w / 2, 0.01, -d / 2),
      new THREE.Vector3(w / 2, 0.01, d / 2), new THREE.Vector3(-w / 2, 0.01, d / 2)
    ]),
    new THREE.LineBasicMaterial({ color: color, transparent: true, opacity: 0.7 })
  );
  g.add(edge);
  g.position.set((rect.x1 + rect.x2) / 2, 0, (rect.z1 + rect.z2) / 2);
  return g;
}

/* ---- 壁：入口・出口はすき間を空ける ---- */
function wallPanel(x1, z1, x2, z2, h) {
  var len = Math.hypot(x2 - x1, z2 - z1);
  var m = new THREE.Mesh(
    new THREE.PlaneGeometry(len, h),
    new THREE.MeshStandardMaterial({ color: 0x0e2b20, roughness: 1, transparent: true, opacity: 0.55, side: THREE.DoubleSide })
  );
  m.position.set((x1 + x2) / 2, h / 2, (z1 + z2) / 2);
  m.rotation.y = -Math.atan2(z2 - z1, x2 - x1);
  return m;
}
function wallEdge(x1, z1, x2, z2, h) {
  var pts = [
    new THREE.Vector3(x1, 0, z1), new THREE.Vector3(x1, h, z1),
    new THREE.Vector3(x2, h, z2), new THREE.Vector3(x2, 0, z2)
  ];
  return new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),
    new THREE.LineBasicMaterial({ color: GREEN, transparent: true, opacity: 0.4 }));
}
var H = ROOM.wallH;
scene.add(wallPanel(ROOM.xMin, ROOM.zMin, ROOM.xMin, DOOR_OUT.z - DOOR_OUT.w / 2, H));
scene.add(wallPanel(ROOM.xMin, DOOR_OUT.z + DOOR_OUT.w / 2, ROOM.xMin, DOOR_IN.z - DOOR_IN.w / 2, H));
scene.add(wallPanel(ROOM.xMin, DOOR_IN.z + DOOR_IN.w / 2, ROOM.xMin, ROOM.zMax, H));
scene.add(wallPanel(ROOM.xMin, ROOM.zMax, ROOM.xMax, ROOM.zMax, H));
scene.add(wallPanel(ROOM.xMax, ROOM.zMax, ROOM.xMax, ROOM.zMin, H));
scene.add(wallPanel(ROOM.xMin, ROOM.zMin, ROOM.xMax, ROOM.zMin, H));
[[ROOM.xMin, ROOM.zMin, ROOM.xMax, ROOM.zMin], [ROOM.xMin, ROOM.zMax, ROOM.xMax, ROOM.zMax],
 [ROOM.xMax, ROOM.zMax, ROOM.xMax, ROOM.zMin]].forEach(function (s) {
  scene.add(wallEdge(s[0], s[1], s[2], s[3], H));
});

function makeFlatLabel(text, x, z, size) {
  var c = document.createElement('canvas'); c.width = 256; c.height = 96;
  var g = c.getContext('2d');
  g.font = '700 42px "Zen Kaku Gothic New", sans-serif';
  g.fillStyle = 'rgba(210,255,230,.75)';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, 128, 48);
  var tex = new THREE.CanvasTexture(c);
  var geo = new THREE.PlaneGeometry(size || 1.6, (size || 1.6) * 0.375);
  var m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
  m.rotation.x = -Math.PI / 2;
  m.position.set(x, 0.02, z);
  return m;
}
scene.add(makeFlatLabel('出口', DOOR_OUT.x + 1.15, DOOR_OUT.z));
scene.add(makeFlatLabel('入口', DOOR_IN.x + 1.15, DOOR_IN.z));

/* ---- ホワイトボード：下の壁に据え付け ---- */
function wallWhiteboard(x, z, w) {
  var g = new THREE.Group();
  var board = new THREE.Mesh(new THREE.BoxGeometry(w, 1.0, 0.05),
    new THREE.MeshStandardMaterial({ color: 0xeef4ee, roughness: 0.5 }));
  board.position.set(0, 1.3, 0);
  g.add(board);
  g.add(makeFlatLabel('WB', 0, 0.55, 0.8));
  g.position.set(x, 0, z);
  return g;
}
scene.add(wallWhiteboard(0, ROOM.zMax - 0.05, 3.2));

/* ---- 天井の照明・機材（丸印）。清書図の○を、そのまま点在させる。 ---- */
function ceilLight(x, z) {
  var m = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 10),
    new THREE.MeshBasicMaterial({ color: 0xdfffe9, transparent: true, opacity: 0.85 }));
  m.position.set(x, 2.35, z);
  return m;
}
[[-3.4, 5.6], [0.2, 5.6], [3.4, 5.6], [-3.7, -1.0], [-2.4, -1.0], [-1.1, -1.0], [0.2, -1.0], [1.5, -1.0],
 [-3.2, 1.1], [-1.9, 1.1], [-0.6, 1.1], [0.7, 1.1], [-1.4, -4.8], [-0.2, -4.8], [1.0, -4.8], [3.4, -4.8]]
 .forEach(function (p) { scene.add(ceilLight(p[0], p[1])); });

/* =========================================================
   什器
   ========================================================= */
function screenTexture(label) {
  var c = document.createElement('canvas'); c.width = 128; c.height = 96;
  var g = c.getContext('2d');
  g.fillStyle = '#04140e'; g.fillRect(0, 0, 128, 96);
  g.strokeStyle = 'rgba(0,255,156,.9)'; g.lineWidth = 3;
  g.strokeRect(10, 10, 108, 76);
  g.fillStyle = 'rgba(0,255,156,.8)'; g.font = '700 15px sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(label || '', 64, 48);
  return new THREE.CanvasTexture(c);
}
function pcDesk(label) {
  var g = new THREE.Group();
  var desk = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.72, 0.62),
    new THREE.MeshStandardMaterial({ color: 0x1c231f, roughness: 0.8 }));
  desk.position.y = 0.36;
  g.add(desk);
  var monitor = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.34, 0.03),
    new THREE.MeshBasicMaterial({ map: screenTexture(label || 'PC') }));
  monitor.position.set(0, 0.9, -0.14);
  g.add(monitor);
  var neck = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.18, 6),
    new THREE.MeshStandardMaterial({ color: 0x222 }));
  neck.position.set(0, 0.72, -0.14);
  g.add(neck);
  var kb = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.02, 0.13),
    new THREE.MeshStandardMaterial({ color: 0x161a18 }));
  kb.position.set(0, 0.735, 0.12);
  g.add(kb);
  return g;
}
function whiteboardStand() {
  var g = new THREE.Group();
  var board = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.9, 0.05),
    new THREE.MeshStandardMaterial({ color: 0xeef4ee, roughness: 0.5 }));
  board.position.y = 1.2;
  g.add(board);
  [-0.6, 0.6].forEach(function (dx) {
    var leg = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.2, 6),
      new THREE.MeshStandardMaterial({ color: 0x2a2f2c }));
    leg.position.set(dx, 0.6, 0);
    g.add(leg);
  });
  return g;
}
function tvOnStand(label) {
  var g = new THREE.Group();
  var stand = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.55, 0.4),
    new THREE.MeshStandardMaterial({ color: 0x1c231f, roughness: 0.8 }));
  stand.position.y = 0.28;
  g.add(stand);
  var tv = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.55, 0.04),
    new THREE.MeshBasicMaterial({ map: screenTexture(label || '') }));
  tv.position.set(0, 0.85, -0.16);
  g.add(tv);
  return g;
}
function midiDesk() {
  var g = new THREE.Group();
  g.add(pcDesk('VOCALOID'));
  var c = document.createElement('canvas'); c.width = 256; c.height = 32;
  var ctx = c.getContext('2d');
  ctx.fillStyle = '#111'; ctx.fillRect(0, 0, 256, 32);
  ctx.fillStyle = '#eee';
  for (var i = 0; i < 24; i++) ctx.fillRect(i * (256 / 24) + 1, 0, 256 / 24 - 2, 32);
  var midi = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.05, 0.16),
    new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c) }));
  midi.position.set(0, 0.75, 0.24);
  g.add(midi);
  return g;
}
function switchSetup() {
  var g = new THREE.Group();
  var t = tvOnStand('Switch'); g.add(t);
  [[-0.35, 0.9], [0.35, 0.9]].forEach(function (p) {
    var pad = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.04, 0.2),
      new THREE.MeshStandardMaterial({ color: 0x2b2b2b }));
    pad.position.set(p[0], 0.32, p[1]);
    g.add(pad);
  });
  return g;
}
function streamDesk() {
  var g = new THREE.Group();
  g.add(pcDesk('LIVE'));
  var mixer = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.06, 0.22),
    new THREE.MeshStandardMaterial({ color: 0x14201a }));
  mixer.position.set(0.42, 0.75, 0.1);
  g.add(mixer);
  return g;
}
function pcRow(n) {
  var g = new THREE.Group();
  var gap = 1.5;
  for (var i = 0; i < n; i++) {
    var d = pcDesk('作品展');
    d.position.x = (i - (n - 1) / 2) * gap;
    g.add(d);
  }
  return g;
}
function monitorBox() {
  var g = new THREE.Group();
  g.add(tvOnStand('作品映像'));
  return g;
}
function wallMonitors() {
  var g = new THREE.Group();
  for (var i = 0; i < 3; i++) {
    var m = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.32, 0.04),
      new THREE.MeshBasicMaterial({ map: screenTexture('') }));
    m.rotation.y = Math.PI / 2;
    m.position.set(0.2, 1.1, -1.6 + i * 1.6);
    g.add(m);
  }
  return g;
}

var FURN = {
  'pc+wb': function () { var g = new THREE.Group(); var d = pcDesk('VTuber'); d.position.z = 0.15; g.add(d);
    var wb = whiteboardStand(); wb.position.set(0, 0, -0.75); g.add(wb); return g; },
  'switch': switchSetup,
  'midi': midiDesk,
  'stream': streamDesk,
  'wallmon': wallMonitors,
  'pcrow3': function () { return pcRow(3); },
  'pcrow2': function () { return pcRow(2); },
  'monitorbox': monitorBox
};

/* ---- クリックの標的（区画の中心に浮かべる） ---- */
var markers = [];
var raycaster = new THREE.Raycaster();
var pointer = new THREE.Vector2();

ZONES.forEach(function (zone, i) {
  var cx = (zone.rect.x1 + zone.rect.x2) / 2;
  var cz = (zone.rect.z1 + zone.rect.z2) / 2;

  scene.add(zoneFloor(zone.rect, zone.color));

  var group = new THREE.Group();
  group.position.set(cx, 0, cz);
  var build = FURN[zone.furn];
  if (build) group.add(build());
  scene.add(group);

  var mark = new THREE.Group();
  mark.position.set(cx, 0, cz + (zone.rect.z2 - zone.rect.z1) / 2 - 0.3);
  var ring = new THREE.Mesh(new THREE.RingGeometry(0.32, 0.4, 32),
    new THREE.MeshBasicMaterial({ color: zone.color, transparent: true, opacity: 0.6, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.02;
  mark.add(ring);
  var head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.16, 0),
    new THREE.MeshBasicMaterial({ color: zone.color }));
  head.position.y = 1.7;
  head.userData.zoneIndex = i;
  mark.add(head);
  var beam = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 1.7, 6),
    new THREE.MeshBasicMaterial({ color: zone.color, transparent: true, opacity: 0.35 }));
  beam.position.y = 0.85;
  mark.add(beam);
  var numTag = makeFlatLabel(String(i + 1), 0, 0, 0.55);
  numTag.position.y = 0.021;
  mark.add(numTag);
  scene.add(mark);

  markers.push({ zone: zone, head: head, cx: cx, cz: cz });
});

/* ---- 順路：入口から出口まで、区画をつなぐ曲線 ---- */
var routeThrough = [
  new THREE.Vector3(DOOR_IN.x + 0.6, 0.05, DOOR_IN.z)
].concat(markers.map(function (m) { return new THREE.Vector3(m.cx, 0.05, m.cz); }))
 .concat([new THREE.Vector3(DOOR_OUT.x + 0.6, 0.05, DOOR_OUT.z)]);
var curve = new THREE.CatmullRomCurve3(routeThrough, false, 'catmullrom', 0.4);
var routeGeo = new THREE.TubeGeometry(curve, 200, 0.025, 6, false);
var routeMesh = new THREE.Mesh(routeGeo, new THREE.MeshBasicMaterial({ color: GREEN, transparent: true, opacity: 0.55 }));
scene.add(routeMesh);

/* ---- クリックで選ぶ ---- */
function pickAt(clientX, clientY) {
  var r = renderer.domElement.getBoundingClientRect();
  pointer.x = ((clientX - r.left) / r.width) * 2 - 1;
  pointer.y = -((clientY - r.top) / r.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  var heads = markers.map(function (m) { return m.head; });
  var hit = raycaster.intersectObjects(heads, false)[0];
  if (hit) openZone(hit.object.userData.zoneIndex, true);
}
var downAt = null;
renderer.domElement.addEventListener('pointerdown', function (e) { downAt = [e.clientX, e.clientY]; });
renderer.domElement.addEventListener('pointerup', function (e) {
  if (!downAt) return;
  var moved = Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]);
  if (moved < 6) pickAt(e.clientX, e.clientY);
  downAt = null;
});

/* ---- カメラをゾーンへ寄せる ---- */
var tween = null;
function flyTo(pos, look, ms) {
  if (REDUCE) { camera.position.copy(pos); controls.target.copy(look); controls.update(); return; }
  tween = { t0: null, dur: ms || 700, p0: camera.position.clone(), p1: pos.clone(),
            l0: controls.target.clone(), l1: look.clone() };
}
function tickTween(now) {
  if (!tween) return;
  if (tween.t0 === null) tween.t0 = now;
  var k = Math.min(1, (now - tween.t0) / tween.dur);
  var e = 1 - Math.pow(1 - k, 3);
  camera.position.lerpVectors(tween.p0, tween.p1, e);
  controls.target.lerpVectors(tween.l0, tween.l1, e);
  if (k >= 1) tween = null;
}

/* ---- ゾーンの説明カード ---- */
var current = -1;
var card = document.getElementById('zonecard');
function openZone(i, fly) {
  current = i;
  var m = markers[i], z = m.zone;
  document.getElementById('zone-kick').textContent = z.type + ' ・ ' + z.sub;
  document.getElementById('zone-kick').style.color = '#' + z.color.toString(16).padStart(6, '0');
  document.getElementById('zone-title').textContent = z.name;
  document.getElementById('zone-desc').textContent = z.desc;
  var gear = document.getElementById('zone-gear');
  gear.innerHTML = '';
  z.gear.forEach(function (g) { var s = document.createElement('span'); s.textContent = g; gear.appendChild(s); });
  document.getElementById('zone-staff').textContent = '担当は決まり次第、ここに載せます。';
  card.classList.remove('off');
  document.querySelectorAll('.route-chip').forEach(function (c, idx) { c.classList.toggle('on', idx === i); });

  if (fly) {
    var look = new THREE.Vector3(m.cx, 0.8, m.cz);
    var w = z.rect.x2 - z.rect.x1, d = z.rect.z2 - z.rect.z1;
    var reach = Math.max(w, d) * 0.9 + 2.5;
    var pos = new THREE.Vector3(m.cx + reach * 0.4, reach * 0.75, m.cz + reach * 0.75);
    flyTo(pos, look, 750);
  }
}
document.getElementById('zone-close').addEventListener('click', function () {
  card.classList.add('off'); current = -1;
  document.querySelectorAll('.route-chip').forEach(function (c) { c.classList.remove('on'); });
});
document.getElementById('map-reset').addEventListener('click', function () {
  card.classList.add('off'); current = -1;
  document.querySelectorAll('.route-chip').forEach(function (c) { c.classList.remove('on'); });
  flyTo(HOME, TARGET_HOME, 800);
});

/* ---- 下：順路の一覧 ---- */
var routeHost = document.getElementById('route');
ZONES.forEach(function (z, i) {
  if (i > 0) {
    var ar = document.createElement('span'); ar.className = 'route-arrow'; ar.textContent = '→';
    routeHost.appendChild(ar);
  }
  var b = document.createElement('button');
  b.type = 'button'; b.className = 'route-chip';
  b.style.setProperty('--c', '#' + z.color.toString(16).padStart(6, '0'));
  b.innerHTML = '<b>' + (i + 1) + '</b><span></span>';
  b.querySelector('span').textContent = z.name;
  b.addEventListener('click', function () { openZone(i, true); });
  routeHost.appendChild(b);
});

/* ---- 描画ループ ---- */
function tick(now) {
  requestAnimationFrame(tick);
  tickTween(now);
  markers.forEach(function (m, i) {
    var pulse = current === i ? 1.4 : 1;
    var s = pulse * (1 + Math.sin(now / 500 + i) * 0.06);
    m.head.scale.setScalar(s);
  });
  controls.update();
  renderer.render(scene, camera);
}
requestAnimationFrame(tick);
