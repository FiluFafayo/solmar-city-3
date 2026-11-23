// Solmar City — ai: traffic driving, pedestrians, police pursuit, wanted level,
// player movement, driving and combat.

const WANTED_DECAY_SEEN = 400;   // police within this range keep you "seen"
const WANTED_DECAY_TIME = 9;     // seconds unseen to drop one star

// ---- traffic -------------------------------------------------------------
SC.updateTraffic = (dt) => {
  for (const c of SC.cars) {
    if (c.driver !== 'traffic') continue;
    if (c.waitT > 0) { c.waitT -= dt; continue; }
    const t = c.target || (c.target = SC.randomJunction(0, 0, SC.W, SC.SEA_Y - 200));
    const d = dist(c.x, c.y, t.x, t.y);
    if (d < 26) {
      c.target = SC.randomJunction(0, 0, SC.W, SC.SEA_Y - 200);
      if (SC.rng() < 0.25) c.waitT = 0.5 + SC.rng();
      continue;
    }
    // Drive axis-aligned toward the target: pick the axis with the bigger gap.
    const dx = t.x - c.x, dy = t.y - c.y;
    const want = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 0 : Math.PI) : (dy > 0 ? Math.PI / 2 : -Math.PI / 2);
    c.angle += clamp(angDiff(c.angle, want), -2.4 * dt, 2.4 * dt);
    // Slow for the car ahead.
    let slow = false;
    for (const o of SC.cars) {
      if (o === c) continue;
      const ahead = Math.cos(c.angle) * (o.x - c.x) + Math.sin(c.angle) * (o.y - c.y);
      const side = Math.abs(-Math.sin(c.angle) * (o.x - c.x) + Math.cos(c.angle) * (o.y - c.y));
      if (ahead > 0 && ahead < 64 && side < 26) { slow = true; break; }
    }
    const targetSpeed = slow ? 0 : 120;
    c.speed = lerp(c.speed, targetSpeed, 1 - Math.exp(-2 * dt));
    c.x += Math.cos(c.angle) * c.speed * dt;
    c.y += Math.sin(c.angle) * c.speed * dt;
    SC.collide(c, 16);
    // Recycle far-away cars near the player back into the city.
    const p = SC.player;
    if (p && dist2(c.x, c.y, p.x, p.y) > 1400 * 1400) {
      const j = SC.randomJunction(Math.max(0, p.x - 500), Math.max(0, p.y - 500), Math.min(SC.W, p.x + 500), Math.min(SC.SEA_Y - 200, p.y + 500));
      c.x = j.x; c.y = j.y; c.target = SC.randomJunction(0, 0, SC.W, SC.SEA_Y - 200);
    }
  }
};

// ---- pedestrians ---------------------------------------------------------
SC.updatePeds = (dt) => {
  const p = SC.player;
  for (const ped of SC.peds) {
    if (ped.downT > 0) { ped.downT -= dt; continue; }
    if (ped.fleeT > 0) {
      ped.fleeT -= dt;
      const a = angTo(p.x, p.y, ped.x, ped.y);
      ped.x += Math.cos(a) * 120 * dt;
      ped.y += Math.sin(a) * 120 * dt;
      SC.collide(ped, ped.r);
      continue;
    }
    ped.retarget -= dt;
    if (ped.retarget <= 0 || dist2(ped.x, ped.y, ped.tx, ped.ty) < 20 * 20) {
      ped.retarget = 3 + SC.rng() * 5;
      const a = SC.rng() * TAU, r = 60 + SC.rng() * 140;
      ped.tx = clamp(ped.x + Math.cos(a) * r, 60, SC.W - 60);
      ped.ty = clamp(ped.y + Math.sin(a) * r, 60, SC.SAND_Y - 40);
    }
    const a = angTo(ped.x, ped.y, ped.tx, ped.ty);
    ped.angle += clamp(angDiff(ped.angle, a), -3 * dt, 3 * dt);
    ped.x += Math.cos(ped.angle) * ped.speed * dt;
    ped.y += Math.sin(ped.angle) * ped.speed * dt;
    SC.collide(ped, ped.r);
    // Flee from a fast car or a gunshot nearby.
    if (p && !p.onFoot && p.car && p.car.speed > 200 && dist2(ped.x, ped.y, p.x, p.y) < 160 * 160) ped.fleeT = 2;
    if (SC.gunshotT > 0 && dist2(ped.x, ped.y, p.x, p.y) < 320 * 320) ped.fleeT = 2.5;
  }
  SC.gunshotT = Math.max(0, (SC.gunshotT || 0) - dt);
};

SC.scarePeds = (x, y, r) => {
  for (const ped of SC.peds) if (dist2(ped.x, ped.y, x, y) < r * r) ped.fleeT = 2.5;
};

// ---- wanted --------------------------------------------------------------
SC.addWanted = (n) => {
  const before = SC.wanted;
  SC.wanted = clamp(SC.wanted + n, 0, 5);
  if (SC.wanted > before) {
    SC.wantedT = 0;
    SC.say(SC.wanted >= 3 ? 'The whole force is after you now.' : 'Someone called the cops.');
    SC.audio.sirenBurst();
  }
};
SC.witnessed = (x, y, r = 350) => {
  for (const ped of SC.peds) if (ped.downT <= 0 && dist2(ped.x, ped.y, x, y) < r * r) return true;
  for (const c of SC.cars) if (c.police && dist2(c.x, c.y, x, y) < r * r) return true;
  for (const cp of SC.cops) if (dist2(cp.x, cp.y, x, y) < r * r) return true;
  return false;
};

SC.updateWanted = (dt) => {
  const p = SC.player;
  if (!p) return;
  // Spawn police to match the wanted level.
  const wantCops = SC.wanted === 0 ? 0 : SC.wanted + 1;
  const policeCars = SC.cars.filter((c) => c.police);
  if (policeCars.length < wantCops && SC.wanted > 0) {
    const a = SC.rng() * TAU;
    const x = clamp(p.x + Math.cos(a) * 700, 80, SC.W - 80);
    const y = clamp(p.y + Math.sin(a) * 700, 80, SC.SEA_Y - 200);
    const j = SC.nearestRoadPoint(x, y);
    const cop = SC.newCar(j.x, j.y, angTo(j.x, j.y, p.x, p.y), 'police', { driver: 'police' });
    cop.siren = true;
    SC.cars.push(cop);
    SC.audio.sirenBurst();
  }
  // Foot cops at wanted 2+.
  if (SC.wanted >= 2 && SC.cops.length < SC.wanted - 1) {
    const a = SC.rng() * TAU;
    SC.cops.push(SC.newCop(
      clamp(p.x + Math.cos(a) * 260, 60, SC.W - 60),
      clamp(p.y + Math.sin(a) * 260, 60, SC.SAND_Y - 40)));
  }
  // Decay when unseen.
  let seen = false;
  for (const c of policeCars) if (dist2(c.x, c.y, p.x, p.y) < WANTED_DECAY_SEEN * WANTED_DECAY_SEEN) seen = true;
  for (const cp of SC.cops) if (dist2(cp.x, cp.y, p.x, p.y) < WANTED_DECAY_SEEN * WANTED_DECAY_SEEN) seen = true;
  if (SC.wanted > 0) {
    if (seen) SC.wantedT = 0;
    else {
      SC.wantedT += dt;
      if (SC.wantedT > WANTED_DECAY_TIME) { SC.wanted--; SC.wantedT = 0; SC.say('You lost them. Wanted level down.'); }
    }
  }
};

// ---- police cars ---------------------------------------------------------
SC.updatePoliceCars = (dt) => {
  const p = SC.player;
  if (!p) return;
  for (const c of SC.cars) {
    if (c.driver !== 'police') continue;
    if (SC.wanted === 0) {
      // No heat: cruise back to patrol.
      if (!c.target) c.target = SC.randomJunction(0, 0, SC.W, SC.SEA_Y - 200);
      const d = dist(c.x, c.y, c.target.x, c.target.y);
      if (d < 30) c.target = SC.randomJunction(0, 0, SC.W, SC.SEA_Y - 200);
      const want = Math.abs(c.target.x - c.x) > Math.abs(c.target.y - c.y)
        ? (c.target.x > c.x ? 0 : Math.PI) : (c.target.y > c.y ? Math.PI / 2 : -Math.PI / 2);
      c.angle += clamp(angDiff(c.angle, want), -2.4 * dt, 2.4 * dt);
      c.speed = lerp(c.speed, 140, 1 - Math.exp(-2 * dt));
      c.x += Math.cos(c.angle) * c.speed * dt;
      c.y += Math.sin(c.angle) * c.speed * dt;
      SC.collide(c, 16);
      continue;
    }
    // Chase the player.
    const want = angTo(c.x, c.y, p.x, p.y);
    const turn = SC.wanted >= 4 ? 3.4 : 2.8;
    c.angle += clamp(angDiff(c.angle, want), -turn * dt, turn * dt);
    const targetSpeed = c.max * (0.9 + SC.wanted * 0.04);
    c.speed = lerp(c.speed, targetSpeed, 1 - Math.exp(-1.6 * dt));
    c.x += Math.cos(c.angle) * c.speed * dt;
    c.y += Math.sin(c.angle) * c.speed * dt;
    SC.collide(c, 16);
    // Ram the player: damage on contact.
    const pd = dist(c.x, c.y, p.x, p.y);
    if (pd < 40) {
      const push = angTo(c.x, c.y, p.x, p.y);
      p.x += Math.cos(push) * 60 * dt * 4;
      p.y += Math.sin(push) * 60 * dt * 4;
      if (p.onFoot) SC.hurtPlayer(8 * dt, c);
      else if (p.car) {
        p.car.health -= 14 * dt;
        SC.spawnSparks(p.x, p.y);
        if (p.car.health <= 0) SC.carDestroyed(p.car);
      }
    }
    // At 4+ stars they shoot (inaccurate, so it stays fair).
    if (SC.wanted >= 4 && pd < 420 && SC.rng() < dt * 0.7) {
      SC.effects.push({ type: 'tracer', x1: c.x, y1: c.y, x2: p.x, y2: p.y, t: 0.12 });
      SC.audio.shot(false);
      if (SC.rng() < 0.3) SC.hurtPlayer(4, c);
    }
  }
  // Remove police cars far away once the heat is gone.
  if (SC.wanted === 0) {
    SC.cars = SC.cars.filter((c) => !c.police || dist2(c.x, c.y, p.x, p.y) < 900 * 900);
  }
};

// ---- foot police ---------------------------------------------------------
SC.updateCops = (dt) => {
  const p = SC.player;
  if (!p) return;
  for (const cp of SC.cops) {
    if (cp.health <= 0) continue;
    const d = dist(cp.x, cp.y, p.x, p.y);
    if (SC.wanted === 0 || d > 700) {
      // Give up and walk off.
      cp.x += Math.cos(cp.angle) * 40 * dt;
      cp.y += Math.sin(cp.angle) * 40 * dt;
      continue;
    }
    const a = angTo(cp.x, cp.y, p.x, p.y);
    cp.angle += clamp(angDiff(cp.angle, a), -4 * dt, 4 * dt);
    cp.x += Math.cos(cp.angle) * cp.speed * dt;
    cp.y += Math.sin(cp.angle) * cp.speed * dt;
    SC.collide(cp, cp.r);
    if (d < 26) {
      cp.punchT -= dt;
      if (cp.punchT <= 0) {
        cp.punchT = 0.9;
        SC.hurtPlayer(9, cp);
        SC.audio.thud();
      }
    }
    if (SC.wanted >= 4 && d < 300) {
      cp.shootT -= dt;
      if (cp.shootT <= 0) {
        cp.shootT = 1.4;
        SC.effects.push({ type: 'tracer', x1: cp.x, y1: cp.y, x2: p.x, y2: p.y, t: 0.12 });
        SC.audio.shot(false);
        if (SC.rng() < 0.25) SC.hurtPlayer(5, cp);
      }
    }
  }
  SC.cops = SC.cops.filter((cp) => cp.health > 0 && dist2(cp.x, cp.y, p.x, p.y) < 1200 * 1200);
};

// ---- player --------------------------------------------------------------
SC.hurtPlayer = (n, from) => {
  const p = SC.player;
  if (!p || p.hurtT > 0) return;
  p.health -= n;
  p.hurtT = 0.4;
  SC.audio.thud();
  if (p.health <= 0) {
    p.health = 0;
    SC.busted();
  }
};

SC.busted = () => {
  const p = SC.player;
  const fine = Math.min(SC.cash, 60 + SC.wanted * 40);
  SC.cash -= fine;
  SC.wanted = 0;
  SC.state = 'busted';
  SC.audio.jingle(false);
  SC.say('');
  p.car = null; p.onFoot = true;
  p.health = 100;
  const j = SC.randomJunction(900, 900, 1500, 1300);
  p.x = j.x; p.y = j.y;
  SC.cars = SC.cars.filter((c) => !c.police);
  SC.cops = [];
  SC.bannerData = { title: 'BUSTED', sub: `The Solmar PD took $${fine} in fines.`, fine };
  SC.saveGame();
};

SC.carDestroyed = (car) => {
  SC.spawnSmoke(car.x, car.y, 14);
  SC.audio.explosion();
  const p = SC.player;
  if (p.car === car) {
    p.car = null; p.onFoot = true;
    p.x = car.x + 30; p.y = car.y;
    SC.hurtPlayer(20, car);
    SC.say('Your car is wrecked. Find another one.');
  }
  SC.cars = SC.cars.filter((c) => c !== car);
};

SC.stealCar = (car) => {
  const p = SC.player;
  car.driver = 'player';
  p.car = car; p.onFoot = false;
  SC.carsStolen++;
  SC.audio.door();
  if (car.health < 40) SC.say('This one is barely holding together.');
  if (SC.witnessed(p.x, p.y)) SC.addWanted(1);
  else SC.say('Nice ride. Nobody saw you take it.');
};

SC.updatePlayer = (dt) => {
  const p = SC.player;
  if (!p) return;
  p.hurtT = Math.max(0, p.hurtT - dt);
  p.punchT = Math.max(0, p.punchT - dt);
  p.shootT = Math.max(0, p.shootT - dt);
  const k = SC.keys;
  const up = k['w'] || k['arrowup'], down = k['s'] || k['arrowdown'];
  const left = k['a'] || k['arrowleft'], right = k['d'] || k['arrowright'];

  if (p.onFoot) {
    const sprint = k['shift'];
    const sp = sprint ? 265 : 170;
    let mx = (right ? 1 : 0) - (left ? 1 : 0);
    let my = (down ? 1 : 0) - (up ? 1 : 0);
    if (mx || my) {
      const len = Math.hypot(mx, my); mx /= len; my /= len;
      p.angle = Math.atan2(my, mx);
      p.x += mx * sp * dt;
      p.y += my * sp * dt;
      p.speed = sp;
    } else p.speed = 0;
    SC.collide(p, p.r);
    // Enter a car.
    if (SC.pressed['e']) {
      const car = SC.nearestCar(p.x, p.y, 46);
      if (car) SC.stealCar(car);
    }
    // Punch.
    if (SC.pressed['f'] && p.punchT <= 0) {
      p.punchT = 0.45;
      SC.audio.thud();
      for (const ped of SC.peds) {
        if (ped.downT <= 0 && dist2(p.x, p.y, ped.x, ped.y) < 34 * 34) {
          ped.downT = 4; SC.kills++;
          SC.spawnStars(ped.x, ped.y);
          if (SC.witnessed(p.x, p.y)) SC.addWanted(1);
          SC.scarePeds(p.x, p.y, 200);
          break;
        }
      }
      for (const cp of SC.cops) {
        if (dist2(p.x, p.y, cp.x, cp.y) < 34 * 34) {
          cp.health -= 30;
          SC.spawnStars(cp.x, cp.y);
          if (cp.health <= 0) { SC.kills++; SC.addWanted(1); }
          break;
        }
      }
    }
    // Shoot (mouse aim).
    if ((SC.mouse.clicked || k[' ']) && p.shootT <= 0 && SC.ammo > 0) {
      p.shootT = 0.32;
      SC.ammo--;
      SC.gunshotT = 0.5;
      const wx = SC.camera.x - 640 + SC.mouse.x;
      const wy = SC.camera.y - 400 + SC.mouse.y;
      const a = angTo(p.x, p.y, wx, wy);
      p.angle = a;
      SC.effects.push({ type: 'tracer', x1: p.x, y1: p.y, x2: p.x + Math.cos(a) * 260, y2: p.y + Math.sin(a) * 260, t: 0.1 });
      SC.audio.shot(true);
      SC.scarePeds(p.x, p.y, 320);
      let hit = false;
      for (const ped of SC.peds) {
        if (ped.downT > 0) continue;
        const d = dist2(p.x, p.y, ped.x, ped.y);
        if (d < 280 * 280) {
          const pa = angTo(p.x, p.y, ped.x, ped.y);
          if (Math.abs(angDiff(a, pa)) < 0.09) {
            ped.downT = 6; SC.kills++; SC.spawnStars(ped.x, ped.y); hit = true;
            if (SC.witnessed(p.x, p.y)) SC.addWanted(1);
            break;
          }
        }
      }
      if (!hit) for (const cp of SC.cops) {
        const pa = angTo(p.x, p.y, cp.x, cp.y);
        if (Math.abs(angDiff(a, pa)) < 0.09 && dist2(p.x, p.y, cp.x, cp.y) < 280 * 280) {
          cp.health -= 34; SC.spawnStars(cp.x, cp.y);
          if (cp.health <= 0) { SC.kills++; SC.addWanted(1); }
          break;
        }
      }
    }
    if (SC.ammo === 0 && (SC.mouse.clicked || k[' '])) SC.say('Out of ammo. Find the gun shop on Palm Blvd.');
  } else {
    // Driving.
    const car = p.car;
    if (!car) { p.onFoot = true; return; }
    const steer = (left ? 1 : 0) - (right ? 1 : 0);
    const gas = up ? 1 : 0, brake = down ? 1 : 0;
    if (gas) car.speed += car.accel * dt;
    else car.speed = lerp(car.speed, 0, 1 - Math.exp(-0.7 * dt));
    if (brake) car.speed = lerp(car.speed, -60, 1 - Math.exp(-4 * dt));
    car.speed = clamp(car.speed, -80, car.max);
    const turnRate = 2.6 * clamp(Math.abs(car.speed) / 140, 0.25, 1);
    car.angle += steer * turnRate * dt * (car.speed >= 0 ? 1 : -1) * (car.speed === 0 ? 0 : 1);
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    SC.collide(car, 18);
    // Bumping traffic / peds.
    for (const o of SC.cars) {
      if (o === car || o.driver === 'police') continue;
      if (dist2(car.x, car.y, o.x, o.y) < 44 * 44) {
        const push = angTo(car.x, car.y, o.x, o.y);
        o.x += Math.cos(push) * 90 * dt; o.y += Math.sin(push) * 90 * dt;
        car.speed *= 0.96;
        if (Math.abs(car.speed) > 180 && SC.witnessed(car.x, car.y, 260)) SC.addWanted(1);
      }
    }
    for (const ped of SC.peds) {
      if (ped.downT > 0) continue;
      if (dist2(car.x, car.y, ped.x, ped.y) < 30 * 30 && Math.abs(car.speed) > 60) {
        ped.downT = 5; SC.kills++;
        SC.spawnStars(ped.x, ped.y);
        SC.audio.thud();
        if (SC.witnessed(car.x, car.y)) SC.addWanted(1);
        SC.scarePeds(car.x, car.y, 220);
      }
    }
    // Skid marks at speed while turning.
    if (Math.abs(steer) > 0 && Math.abs(car.speed) > 260 && SC.rng() < dt * 20) {
      SC.effects.push({ type: 'skid', x: car.x - Math.cos(car.angle) * 26, y: car.y - Math.sin(car.angle) * 26, t: 1.4 });
    }
    p.x = car.x; p.y = car.y; p.angle = car.angle; p.speed = car.speed;
    if (SC.pressed['e']) {
      car.driver = 'parked';
      car.speed = 0;
      p.car = null; p.onFoot = true;
      p.x = car.x + Math.cos(car.angle + Math.PI / 2) * 30;
      p.y = car.y + Math.sin(car.angle + Math.PI / 2) * 30;
      SC.audio.door();
    }
  }
};

// ---- effects -------------------------------------------------------------
SC.spawnSparks = (x, y) => {
  for (let i = 0; i < 5; i++) {
    SC.effects.push({ type: 'spark', x, y, vx: (SC.rng() - 0.5) * 160, vy: (SC.rng() - 0.5) * 160, t: 0.35 });
  }
};
SC.spawnStars = (x, y) => {
  for (let i = 0; i < 6; i++) {
    SC.effects.push({ type: 'star', x, y, vx: (SC.rng() - 0.5) * 120, vy: (SC.rng() - 0.5) * 120, t: 0.6 });
  }
};
SC.spawnSmoke = (x, y, n = 8) => {
  for (let i = 0; i < n; i++) {
    SC.effects.push({ type: 'smoke', x: x + (SC.rng() - 0.5) * 30, y: y + (SC.rng() - 0.5) * 30, vx: (SC.rng() - 0.5) * 30, vy: -20 - SC.rng() * 30, t: 1.2 });
  }
};
SC.updateEffects = (dt) => {
  for (const e of SC.effects) {
    e.t -= dt;
    if (e.vx !== undefined) { e.x += e.vx * dt; e.y += e.vy * dt; }
  }
  SC.effects = SC.effects.filter((e) => e.t > 0);
};
