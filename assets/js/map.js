/* =========================================================
   map.js — 会場マップ（three.js）

   企画書と手書きマップをもとに、部屋の形・什器（ホワイトボード・
   PC・机・グリーンバックなど）を再現している。手描きマップは
   低解像度で判読しづらい箇所があったため、完全な座標の一致は
   保証できない。違っていたら教えてほしい。

   単位はメートルのつもり。
   ========================================================= */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const GREEN = 0x00ff9c;   /* 体験 */
const BLUE  = 0x4fd0e8;   /* 展示 */
const WALL  = 0x0c3324;
const DESK  = 0x1c231f;
const SCREEN_GLOW = 0x00ff9c;

/* 部屋：多目的3。入口・出口は左の壁。右奥に、ポスターの小さな張り出し。 */
var ROOM = { xMin: -5, xMax: 5, zMin: -6.5, zMax: 6.5, wallH: 2.6 };
var ANNEX = { xMin: 5, xMax: 6.8, zMin: -6.5, zMax: -4.4 };   /* 企画紹介ポスターの張り出し */
var DOOR_IN  = { x: ROOM.xMin, z: 3.6, w: 1.3 };   /* 入口 */
var DOOR_OUT = { x: ROOM.xMin, z: -5.6, w: 1.3 };  /* 出口 */

/* 入口 → 出口の順。x, z は什器の中心位置、rot は什器の向き（ラジアン）。 */
const ZONES = [
  { key:'kombu', type:'体験', color:GREEN, x:-3.6, z:2.6, rot:Math.PI * 0.15, furn:'monitor',
    name:'こんぶタッチ', sub:'アバター交流体験',
    desc:'カメラが来場者の指を認識して、縦型モニターの向こうのアバターとハイタッチできます。画面の中の存在と、現実の手が触れ合う体験です。',
    gear:['縦型モニター', 'Webカメラ'] },
  { key:'vtuber', type:'体験', color:GREEN, x:-1.1, z:2.9, rot:Math.PI * 0.05, furn:'pc+wb',
    name:'VTuber体験', sub:'モーションキャプチャ',
    desc:'来場者の動きを、その場でアバターがコピーします。縦型モニターに映る自分の分身は、まるで鏡に映っているかのようです。',
    gear:['ホワイトボード', 'PC', '縦型モニター'] },
  { key:'studio', type:'体験', color:GREEN, x:1.7, z:2.6, rot:-Math.PI * 0.1, furn:'greenback',
    name:'スタジオ撮影', sub:'スタジオ体験',
    desc:'グリーンバックの前で撮った写真・動画を、その場で合成編集。ちがう場所に自分がいる一枚ができあがります。',
    gear:['グリーンバック', 'PC'] },
  { key:'vocaloid', type:'体験', color:GREEN, x:-0.6, z:-0.2, rot:0, furn:'midi',
    name:'VOCALOID体験', sub:'ボーカロイド体験',
    desc:'合成音声の技術を、実際にさわって確かめられます。MIDIキーボードを弾くと、その場で声に変わります。',
    gear:['MIDIキーボード', 'PC'] },
  { key:'works', type:'展示', color:BLUE, x:-0.6, z:-2.9, rot:0, furn:'pcrow',
    name:'作品展', sub:'個人作品展示',
    desc:'このサイトに、会場のPCからそのままアクセスできます。部員ひとりひとりの作品を、画面の中で確かめてください。',
    gear:['PC', '机'] },
  { key:'d3', type:'展示', color:BLUE, x:-1.4, z:-5.2, rot:0, furn:'pedestal',
    name:'3D作品展', sub:'個人作品展示',
    desc:'3Dプリンターなどで形にした作品を、実物のまま展示します。画面の外に出てきた作品です。',
    gear:['実物展示', '棚'] },
  { key:'poster', type:'展示', color:BLUE, x:5.9, z:-5.5, rot:-Math.PI / 2, furn:'poster',
    name:'企画紹介ポスター', sub:'企画設定ポスター',
    desc:'今回の企画のコンセプトや、それぞれの体験の技術面を、写真つきのポスターで説明しています。',
    gear:['ポスター'] }
];

var host = document.getElementById('mapstage');
var REDUCE = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

var scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x020a07, 0.02);

var camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
var HOME = new THREE.Vector3(4, 13, 15);
var TARGET_HOME = new THREE.Vector3(0.4, 0, 0);
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
controls.autoRotateSpeed = 0.4;
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

/* ---- 照明。什器の陰影が分かる程度に。 ---- */
scene.add(new THREE.AmbientLight(0x9fe8c8, 0.55));
var key = new THREE.DirectionalLight(0xdfffe9, 0.6);
key.position.set(6, 10, 8);
scene.add(key);

/* ---- 床 ---- */
function roomFloor(xMin, xMax, zMin, zMax, color) {
  var m = new THREE.Mesh(
    new THREE.PlaneGeometry(xMax - xMin, zMax - zMin),
    new THREE.MeshStandardMaterial({ color: color, roughness: 0.9, metalness: 0.05 })
  );
  m.rotation.x = -Math.PI / 2;
  m.position.set((xMin + xMax) / 2, 0, (zMin + zMax) / 2);
  return m;
}
scene.add(roomFloor(ROOM.xMin, ROOM.xMax, ROOM.zMin, ROOM.zMax, 0x081a13));
scene.add(roomFloor(ANNEX.xMin, ANNEX.xMax, ANNEX.zMin, ANNEX.zMax, 0x081a13));

var grid = new THREE.GridHelper(14, 28, 0x0c3324, 0x0c3324);
grid.position.y = 0.005;
scene.add(grid);

/* ---- 壁：うっすら透ける板。入口・出口はすき間を空ける。 ---- */
function wallPanel(x1, z1, x2, z2, h) {
  var len = Math.hypot(x2 - x1, z2 - z1);
  var geo = new THREE.PlaneGeometry(len, h);
  var mat = new THREE.MeshStandardMaterial({
    color: 0x0e2b20, roughness: 1, transparent: true, opacity: 0.5, side: THREE.DoubleSide
  });
  var m = new THREE.Mesh(geo, mat);
  m.position.set((x1 + x2) / 2, h / 2, (z1 + z2) / 2);
  m.rotation.y = -Math.atan2(z2 - z1, x2 - x1);
  return m;
}
function wallEdge(x1, z1, x2, z2, h) {
  var pts = [
    new THREE.Vector3(x1, 0, z1), new THREE.Vector3(x1, h, z1),
    new THREE.Vector3(x2, h, z2), new THREE.Vector3(x2, 0, z2)
  ];
  var geo = new THREE.BufferGeometry().setFromPoints(pts);
  return new THREE.Line(geo, new THREE.LineBasicMaterial({ color: GREEN, transparent: true, opacity: 0.4 }));
}
var H = ROOM.wallH;
/* 左の壁は、入口と出口ぶんだけ2枚に割る */
scene.add(wallPanel(ROOM.xMin, ROOM.zMin, ROOM.xMin, DOOR_OUT.z - DOOR_OUT.w / 2, H));
scene.add(wallPanel(ROOM.xMin, DOOR_OUT.z + DOOR_OUT.w / 2, ROOM.xMin, DOOR_IN.z - DOOR_IN.w / 2, H));
scene.add(wallPanel(ROOM.xMin, DOOR_IN.z + DOOR_IN.w / 2, ROOM.xMin, ROOM.zMax, H));
scene.add(wallPanel(ROOM.xMin, ROOM.zMax, ROOM.xMax, ROOM.zMax, H));
scene.add(wallPanel(ROOM.xMax, ROOM.zMax, ROOM.xMax, ANNEX.zMax, H));
scene.add(wallPanel(ROOM.xMax, ANNEX.zMin, ROOM.xMax, ROOM.zMin, H));
scene.add(wallPanel(ROOM.xMin, ROOM.zMin, ROOM.xMax, ROOM.zMin, H));
/* 張り出し（ポスター）の壁 */
scene.add(wallPanel(ANNEX.xMin, ANNEX.zMax, ANNEX.xMax, ANNEX.zMax, H));
scene.add(wallPanel(ANNEX.xMax, ANNEX.zMax, ANNEX.xMax, ANNEX.zMin, H));
scene.add(wallPanel(ANNEX.xMax, ANNEX.zMin, ANNEX.xMin, ANNEX.zMin, H));
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
  var mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false });
  var m = new THREE.Mesh(geo, mat);
  m.rotation.x = -Math.PI / 2;
  m.position.set(x, 0.02, z);
  return m;
}
scene.add(makeFlatLabel('入口', DOOR_IN.x + 1.1, DOOR_IN.z));
scene.add(makeFlatLabel('出口', DOOR_OUT.x + 1.1, DOOR_OUT.z));

/* =========================================================
   什器：ホワイトボード・PC・机・グリーンバックなど
   ========================================================= */
function screenTexture(label) {
  var c = document.createElement('canvas'); c.width = 128; c.height = 96;
  var g = c.getContext('2d');
  g.fillStyle = '#04140e'; g.fillRect(0, 0, 128, 96);
  g.strokeStyle = 'rgba(0,255,156,.9)'; g.lineWidth = 3;
  g.strokeRect(10, 10, 108, 76);
  g.fillStyle = 'rgba(0,255,156,.8)'; g.font = '700 16px sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(label || '', 64, 48);
  return new THREE.CanvasTexture(c);
}

function pcDesk() {
  var g = new THREE.Group();
  var desk = new THREE.Mesh(
    new THREE.BoxGeometry(1.3, 0.72, 0.62),
    new THREE.MeshStandardMaterial({ color: DESK, roughness: 0.8 })
  );
  desk.position.y = 0.36;
  g.add(desk);
  var monitor = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.34, 0.03),
    new THREE.MeshBasicMaterial({ map: screenTexture('PC') })
  );
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

function whiteboard() {
  var g = new THREE.Group();
  var board = new THREE.Mesh(
    new THREE.BoxGeometry(1.6, 1.0, 0.05),
    new THREE.MeshStandardMaterial({ color: 0xeef4ee, roughness: 0.5 })
  );
  board.position.y = 1.3;
  g.add(board);
  [-0.7, 0.7].forEach(function (dx) {
    var leg = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.3, 6),
      new THREE.MeshStandardMaterial({ color: 0x2a2f2c }));
    leg.position.set(dx, 0.65, 0);
    g.add(leg);
  });
  return g;
}

function verticalMonitor() {
  var g = new THREE.Group();
  var base = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 0.06, 20),
    new THREE.MeshStandardMaterial({ color: 0x14201a }));
  base.position.y = 0.03;
  g.add(base);
  var pole = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.3, 8),
    new THREE.MeshStandardMaterial({ color: 0x222 }));
  pole.position.y = 0.7;
  g.add(pole);
  var screen = new THREE.Mesh(
    new THREE.BoxGeometry(0.62, 1.05, 0.04),
    new THREE.MeshBasicMaterial({ map: screenTexture('touch') })
  );
  screen.position.y = 1.75;
  g.add(screen);
  return g;
}

function greenBackDesk() {
  var g = new THREE.Group();
  var panel = new THREE.Mesh(
    new THREE.PlaneGeometry(2.0, 1.9),
    new THREE.MeshStandardMaterial({ color: 0x0bdc5a, roughness: 1, side: THREE.DoubleSide })
  );
  panel.position.set(0, 0.95, -0.55);
  g.add(panel);
  g.add(pcDesk());
  var tripod = new THREE.Group();
  [[-0.12, 0.14], [0.12, 0.14], [0, -0.16]].forEach(function (p) {
    var leg = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.9, 6),
      new THREE.MeshStandardMaterial({ color: 0x333 }));
    leg.position.set(p[0], 0.45, 0.55 + p[1]);
    leg.rotation.x = 0.12;
    tripod.add(leg);
  });
  var cam = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.12, 0.22),
    new THREE.MeshStandardMaterial({ color: 0x111 }));
  cam.position.set(0, 0.95, 0.55);
  tripod.add(cam);
  g.add(tripod);
  return g;
}

function midiDesk() {
  var g = new THREE.Group();
  g.add(pcDesk());
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

function worksDesks() {
  var g = new THREE.Group();
  [-0.9, 0, 0.9].forEach(function (dx) {
    var d = pcDesk();
    d.position.x = dx;
    g.add(d);
  });
  return g;
}

function pedestalDisplay() {
  var g = new THREE.Group();
  var shelf = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.5, 0.6),
    new THREE.MeshStandardMaterial({ color: DESK, roughness: 0.8 }));
  shelf.position.y = 0.25;
  g.add(shelf);
  var shapes = [
    new THREE.IcosahedronGeometry(0.16, 0),
    new THREE.TorusGeometry(0.13, 0.05, 8, 16),
    new THREE.ConeGeometry(0.14, 0.28, 6)
  ];
  shapes.forEach(function (geo, i) {
    var mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0xdfeeea, roughness: 0.4 }));
    mesh.position.set(-0.5 + i * 0.5, 0.65, 0);
    g.add(mesh);
  });
  return g;
}

function posterStand() {
  var g = new THREE.Group();
  var c = document.createElement('canvas'); c.width = 128; c.height = 180;
  var ctx = c.getContext('2d');
  var grad = ctx.createLinearGradient(0, 0, 0, 180);
  grad.addColorStop(0, '#0a2419'); grad.addColorStop(1, '#031008');
  ctx.fillStyle = grad; ctx.fillRect(0, 0, 128, 180);
  ctx.strokeStyle = 'rgba(0,255,156,.8)'; ctx.lineWidth = 4;
  ctx.strokeRect(6, 6, 116, 168);
  ctx.fillStyle = 'rgba(210,255,230,.85)'; ctx.font = '700 14px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('ECLIPSE', 64, 90);
  ctx.fillText('2026', 64, 110);
  var board = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.55),
    new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), side: THREE.DoubleSide }));
  board.position.y = 0.9;
  g.add(board);
  [-0.5, 0.5].forEach(function (dx) {
    var leg = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.2, 6),
      new THREE.MeshStandardMaterial({ color: 0x222 }));
    leg.position.set(dx * 0.9, 0.1, 0.1);
    leg.rotation.x = -0.5;
    g.add(leg);
  });
  return g;
}

var FURN = {
  'monitor': verticalMonitor,
  'pc+wb': function () { var g = new THREE.Group(); g.add(pcDesk()); var wb = whiteboard(); wb.position.set(0, 0, -0.7); g.add(wb); return g; },
  'greenback': greenBackDesk,
  'midi': midiDesk,
  'pcrow': worksDesks,
  'pedestal': pedestalDisplay,
  'poster': posterStand
};

/* ---- 順路の線 ---- */
function routeLine(points, color) {
  var geo = new THREE.BufferGeometry().setFromPoints(points);
  return new THREE.Line(geo, new THREE.LineDashedMaterial({ color: color, dashSize: 0.28, gapSize: 0.16, transparent: true, opacity: 0.65 }));
}
var routePts = [new THREE.Vector3(DOOR_IN.x + 0.8, 0.04, DOOR_IN.z)];
ZONES.forEach(function (z) { routePts.push(new THREE.Vector3(z.x, 0.04, z.z + 0.9)); });
routePts.push(new THREE.Vector3(DOOR_OUT.x + 0.8, 0.04, DOOR_OUT.z));
var routeMesh = routeLine(routePts, GREEN);
routeMesh.computeLineDistances();
scene.add(routeMesh);

/* ---- ゾーンの什器 + 目印 ---- */
var markers = [];
var raycaster = new THREE.Raycaster();
var pointer = new THREE.Vector2();

ZONES.forEach(function (zone, i) {
  var group = new THREE.Group();
  group.position.set(zone.x, 0, zone.z);
  group.rotation.y = zone.rot || 0;

  var build = FURN[zone.furn];
  if (build) group.add(build());

  var ring = new THREE.Mesh(
    new THREE.RingGeometry(0.85, 1.0, 40),
    new THREE.MeshBasicMaterial({ color: zone.color, transparent: true, opacity: 0.55, side: THREE.DoubleSide })
  );
  ring.rotation.x = -Math.PI / 2; ring.rotation.z = -group.rotation.y; ring.position.y = 0.02;
  group.add(ring);

  var head = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.22, 0),
    new THREE.MeshBasicMaterial({ color: zone.color })
  );
  head.position.set(0, 2.5, 0);
  head.userData.zoneIndex = i;
  group.add(head);
  var beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.02, 0.02, 2.5, 6),
    new THREE.MeshBasicMaterial({ color: zone.color, transparent: true, opacity: 0.4 })
  );
  beam.position.y = 1.25;
  group.add(beam);

  var numTag = makeFlatLabel(String(i + 1), 0, 0, 0.7);
  numTag.rotation.z = -group.rotation.y;
  numTag.position.set(0, 0.021, -1.05);
  group.add(numTag);

  scene.add(group);
  markers.push({ zone: zone, group: group, head: head });
});

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

/* ---- カメラをゾーンへ寄せる（手作りの簡易トゥイーン） ---- */
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
  var z = markers[i].zone;
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
    var look = new THREE.Vector3(z.x, 1, z.z);
    var pos = new THREE.Vector3(z.x + Math.sin(z.rot || 0) * -4 + 1.5, 3.4, z.z + Math.cos(z.rot || 0) * -4 + 2.5);
    flyTo(pos, look, 750);
  }
}
document.getElementById('zone-close').addEventListener('click', function () {
  card.classList.add('off');
  current = -1;
  document.querySelectorAll('.route-chip').forEach(function (c) { c.classList.remove('on'); });
});
document.getElementById('map-reset').addEventListener('click', function () {
  card.classList.add('off');
  current = -1;
  document.querySelectorAll('.route-chip').forEach(function (c) { c.classList.remove('on'); });
  flyTo(HOME, TARGET_HOME, 800);
});

/* ---- 下：順路の一覧（キーボード・タッチでも辿れるように） ---- */
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
