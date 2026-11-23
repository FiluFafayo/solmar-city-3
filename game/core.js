// Solmar City — core: shared state, utils, input, save.
// A top-down open-world crime game in a sun-soaked coastal city of its own.
// Everything here is written fresh for this entry.

const SC = {};

// ---- world ---------------------------------------------------------------
SC.W = 2400;            // world width (px)
SC.H = 1800;            // world height (px)
SC.ROAD_W = 56;         // road width
SC.PITCH = 240;         // block pitch (road centre to road centre)
SC.SEA_Y = 1704;        // water starts here (south edge)
SC.SAND_Y = 1608;       // beach sand starts here

// ---- utils ---------------------------------------------------------------
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
SC.rng = mulberry32(20261123);

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const dist2 = (ax, ay, bx, by) => { const dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; };
const dist = (ax, ay, bx, by) => Math.sqrt(dist2(ax, ay, bx, by));
const angTo = (ax, ay, bx, by) => Math.atan2(by - ay, bx - ax);
function angDiff(a, b) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}
const pick = (arr) => arr[Math.floor(SC.rng() * arr.length)];
const TAU = Math.PI * 2;

// Circle vs rect collision: returns push-out vector or null.
function circleRect(cx, cy, r, rx, ry, rw, rh) {
  const nx = clamp(cx, rx, rx + rw), ny = clamp(cy, ry, ry + rh);
  const dx = cx - nx, dy = cy - ny;
  const d2 = dx * dx + dy * dy;
  if (d2 >= r * r) return null;
  if (d2 === 0) return { x: 0, y: -r };
  const d = Math.sqrt(d2);
  return { x: (dx / d) * (r - d), y: (dy / d) * (r - d) };
}

// ---- input ---------------------------------------------------------------
SC.keys = {};
SC.mouse = { x: 0, y: 0, down: false, clicked: false };
SC.pressed = {}; // keys pressed this frame (edge-triggered)
window.addEventListener('keydown', (e) => {
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
  if (!SC.keys[e.key.toLowerCase()]) SC.pressed[e.key.toLowerCase()] = true;
  SC.keys[e.key.toLowerCase()] = true;
  SC.anyKey = true;
});
window.addEventListener('keyup', (e) => { SC.keys[e.key.toLowerCase()] = false; });
window.addEventListener('blur', () => { SC.keys = {}; });
window.addEventListener('mousedown', (e) => { SC.mouse.down = true; SC.mouse.clicked = true; SC.anyKey = true; });
window.addEventListener('mouseup', () => { SC.mouse.down = false; });
window.addEventListener('mousemove', (e) => {
  const c = document.getElementById('game');
  const r = c.getBoundingClientRect();
  SC.mouse.x = (e.clientX - r.left) * (c.width / r.width);
  SC.mouse.y = (e.clientY - r.top) * (c.height / r.height);
});

// ---- game state ----------------------------------------------------------
SC.state = 'title';       // title | playing | paused | busted | story
SC.time = 0;              // seconds since load
SC.playT = 0;             // seconds of play
SC.cash = 120;
SC.health = 100;
SC.ammo = 12;
SC.wanted = 0;
SC.wantedT = 0;           // seconds since last seen by police
SC.score = 0;             // total earned this run
SC.kills = 0;
SC.carsStolen = 0;
SC.muted = false;
SC.tint = 'day';          // day | sunset | dusk | night (set by ?shot=)
SC.shot = null;           // ?shot= param
SC.message = '';
SC.messageT = 0;
SC.banner = null;         // {text, sub, t}
SC.dialogue = null;       // {name, text, t}
SC.camera = { x: 1200, y: 900 };
SC.player = null;
SC.cars = [];             // traffic + parked + police cars
SC.peds = [];
SC.cops = [];             // foot police
SC.effects = [];          // particles, skid marks, tracers
SC.markers = [];          // objective markers on the map
SC.saveExists = false;

SC.say = (text, dur = 3) => { SC.message = text; SC.messageT = dur; };
SC.showBanner = (text, sub = '') => { SC.banner = { text, sub, t: 3.2 }; };
SC.talk = (name, text, dur = 4) => { SC.dialogue = { name, text, t: dur }; };

// ---- save ----------------------------------------------------------------
SC.saveKey = 'solmar-city-save-v3';
SC.saveGame = () => {
  try {
    localStorage.setItem(SC.saveKey, JSON.stringify({
      cash: SC.cash, jobs: SC.jobs.done, earned: SC.score, bestWanted: SC.bestWanted,
    }));
  } catch (e) { /* storage unavailable (file:// in some browsers) */ }
};
SC.loadSave = () => {
  try {
    const raw = localStorage.getItem(SC.saveKey);
    if (!raw) return null;
    SC.saveExists = true;
    return JSON.parse(raw);
  } catch (e) { return null; }
};

// ---- error trap (lets headless runs surface runtime errors in the DOM) ---
window.addEventListener('error', (e) => {
  const el = document.getElementById('err');
  if (el) el.textContent += e.message + ' @' + (e.filename || '') + ':' + (e.lineno || '') + '\n';
});
