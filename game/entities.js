// Solmar City — entities: player, cars, pedestrians, foot police.
// All positions are world coordinates; angles in radians (0 = east).

SC.CAR_TYPES = {
  sedan:  { w: 34, l: 62, max: 300, accel: 260, color: '#b8b0a4' },
  sport:  { w: 32, l: 64, max: 430, accel: 340, color: '#c94f3d' },
  taxi:   { w: 34, l: 62, max: 320, accel: 270, color: '#e8b93b' },
  truck:  { w: 40, l: 88, max: 240, accel: 200, color: '#7a8a94' },
  van:    { w: 38, l: 76, max: 260, accel: 220, color: '#8fa3b8' },
  police: { w: 34, l: 64, max: 400, accel: 330, color: '#2b3a67' },
  rival:  { w: 32, l: 64, max: 410, accel: 320, color: '#1c1c22' },
};
SC.TRAFFIC_COLORS = ['#b8b0a4', '#7fa8a0', '#d9a441', '#8c4a5a', '#5f8f96', '#c9b18a', '#6f7f8c', '#a85f4b', '#e8dcc0'];

SC.newPlayer = (x, y) => ({
  kind: 'player', x, y, angle: -Math.PI / 2, speed: 0, r: 11,
  onFoot: true, car: null, health: 100, sprint: false, punchT: 0, shootT: 0, hurtT: 0,
});

SC.newCar = (x, y, angle, type, opts = {}) => {
  const t = SC.CAR_TYPES[type];
  return {
    kind: 'car', x, y, angle, speed: 0, type, w: t.w, l: t.l, max: t.max, accel: t.accel,
    color: opts.color || t.color, health: opts.health || 100, driver: opts.driver || 'traffic',
    target: null, waitT: 0, police: type === 'police', siren: false, brake: false,
  };
};

SC.newPed = (x, y) => ({
  kind: 'ped', x, y, angle: SC.rng() * TAU, speed: 26 + SC.rng() * 22, r: 8,
  color: pick(['#d97b5f', '#5f8f96', '#e8b93b', '#8c4a5a', '#7da05c', '#c9b18a']),
  fleeT: 0, downT: 0, tx: x, ty: y, retarget: 0,
});

SC.newCop = (x, y) => ({
  kind: 'cop', x, y, angle: 0, speed: 150, r: 10, health: 60, punchT: 0, shootT: 0,
});

SC.spawnTraffic = (n) => {
  for (let i = 0; i < n; i++) {
    const j = SC.randomJunction(0, 0, SC.W, SC.SEA_Y - 200);
    const dir = Math.floor(SC.rng() * 4);
    const angle = [0, Math.PI / 2, Math.PI, -Math.PI / 2][dir];
    const type = pick(['sedan', 'sedan', 'sedan', 'taxi', 'van', 'truck', 'sport']);
    const c = SC.newCar(j.x + (SC.rng() - 0.5) * 20, j.y + (SC.rng() - 0.5) * 20, angle, type,
      { color: pick(SC.TRAFFIC_COLORS) });
    c.target = SC.randomJunction(0, 0, SC.W, SC.SEA_Y - 200);
    c.speed = 90 + SC.rng() * 60;
    SC.cars.push(c);
  }
};

SC.spawnParked = (n) => {
  let placed = 0, tries = 0;
  while (placed < n && tries++ < 400) {
    const j = SC.randomJunction(0, 0, SC.W, SC.SEA_Y - 200);
    const horiz = SC.rng() < 0.5;
    const off = (SC.ROAD_W / 2 - 12) * (SC.rng() < 0.5 ? 1 : -1);
    const x = j.x + (horiz ? (SC.rng() - 0.5) * 120 : off);
    const y = j.y + (horiz ? off : (SC.rng() - 0.5) * 120);
    const angle = horiz ? (SC.rng() < 0.5 ? 0 : Math.PI) : (SC.rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2);
    if (!SC.onRoad(x, y)) continue;
    let ok = true;
    for (const c of SC.cars) if (dist2(x, y, c.x, c.y) < 70 * 70) { ok = false; break; }
    if (!ok) continue;
    const type = pick(['sedan', 'sedan', 'sport', 'taxi', 'van']);
    SC.cars.push(SC.newCar(x, y, angle, type, { color: pick(SC.TRAFFIC_COLORS), driver: 'parked' }));
    placed++;
  }
};

SC.spawnPeds = (n) => {
  let placed = 0, tries = 0;
  while (placed < n && tries++ < 600) {
    const x = 80 + SC.rng() * (SC.W - 160);
    const y = 80 + SC.rng() * (SC.SAND_Y - 160);
    if (SC.onRoad(x, y)) continue;
    let ok = true;
    for (const b of SC.buildings) {
      if (x > b.x - 14 && x < b.x + b.w + 14 && y > b.y - 14 && y < b.y + b.h + 14) { ok = false; break; }
    }
    if (!ok) continue;
    SC.peds.push(SC.newPed(x, y));
    placed++;
  }
};

// Nearest drivable car to a point (parked or traffic, not police).
SC.nearestCar = (x, y, maxD) => {
  let best = null, bd = maxD * maxD;
  for (const c of SC.cars) {
    if (c.police || c.driver === 'player') continue;
    const d = dist2(x, y, c.x, c.y);
    if (d < bd) { bd = d; best = c; }
  }
  return best;
};
