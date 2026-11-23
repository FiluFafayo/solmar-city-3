// Solmar City — render: camera, world, cars, people, effects, HUD, minimap,
// title / pause / busted screens. Everything is drawn on one canvas.

SC.canvas = null;
SC.ctx = null;
SC.VW = 1280;
SC.VH = 800;

SC.setupCanvas = () => {
  SC.canvas = document.getElementById('game');
  SC.ctx = SC.canvas.getContext('2d');
};

SC.worldToScreen = (x, y) => ({ x: x - SC.camera.x + SC.VW / 2, y: y - SC.camera.y + SC.VH / 2 });

SC.updateCamera = (dt) => {
  const p = SC.player;
  if (!p) return;
  const tx = clamp(p.x, SC.VW / 2 - 100, SC.W - SC.VW / 2 + 100);
  const ty = clamp(p.y, SC.VH / 2 - 100, SC.H - SC.VH / 2 + 100);
  SC.camera.x = lerp(SC.camera.x, tx, 1 - Math.exp(-5 * dt));
  SC.camera.y = lerp(SC.camera.y, ty, 1 - Math.exp(-5 * dt));
};

// ---- world ---------------------------------------------------------------
SC.drawWorld = () => {
  const c = SC.ctx;
  const cam = SC.camera;
  const x0 = cam.x - SC.VW / 2 - 40, y0 = cam.y - SC.VH / 2 - 40;
  const x1 = cam.x + SC.VW / 2 + 40, y1 = cam.y + SC.VH / 2 + 40;

  // Ground: grass.
  c.fillStyle = '#8aa86a';
  c.fillRect(0, 0, SC.VW, SC.VH);
  // Beach sand + sea.
  if (y1 > SC.SAND_Y) {
    const s = SC.worldToScreen(0, SC.SAND_Y);
    c.fillStyle = '#e0c98f';
    c.fillRect(0, s.y, SC.VW, SC.VH - s.y);
  }
  if (y1 > SC.SEA_Y) {
    const s = SC.worldToScreen(0, SC.SEA_Y);
    const g = c.createLinearGradient(0, s.y, 0, SC.VH);
    g.addColorStop(0, '#3aa0b5');
    g.addColorStop(1, '#2e7f9e');
    c.fillStyle = g;
    c.fillRect(0, s.y, SC.VW, SC.VH - s.y);
    // Gentle waves.
    c.strokeStyle = 'rgba(255,255,255,0.25)';
    c.lineWidth = 2;
    for (let i = 0; i < 4; i++) {
      const wy = s.y + 18 + i * 22 + Math.sin(SC.time * 0.8 + i * 2) * 3;
      c.beginPath();
      for (let x = 0; x <= SC.VW; x += 32) c.lineTo(x, wy + Math.sin(x * 0.02 + i) * 3);
      c.stroke();
    }
  }
  // Parks.
  for (const pk of SC.parks) {
    const s = SC.worldToScreen(pk.x, pk.y);
    c.fillStyle = '#7da05c';
    c.fillRect(s.x, s.y, pk.w, pk.h);
  }
  // Roads.
  c.fillStyle = '#3a3f46';
  for (const rx of SC.roadsV) {
    const s = SC.worldToScreen(rx - SC.ROAD_W / 2, y0);
    c.fillRect(s.x, 0, SC.ROAD_W, SC.VH);
  }
  for (const ry of SC.roadsH) {
    const s = SC.worldToScreen(x0, ry - SC.ROAD_W / 2);
    c.fillRect(0, s.y, SC.VW, SC.ROAD_W);
  }
  // Road centre dashes.
  c.strokeStyle = '#e8e4d8';
  c.lineWidth = 3;
  c.setLineDash([18, 22]);
  for (const rx of SC.roadsV) {
    const s = SC.worldToScreen(rx, 0);
    c.beginPath(); c.moveTo(s.x, 0); c.lineTo(s.x, SC.VH); c.stroke();
  }
  for (const ry of SC.roadsH) {
    const s = SC.worldToScreen(0, ry);
    c.beginPath(); c.moveTo(0, s.y); c.lineTo(SC.VW, s.y); c.stroke();
  }
  c.setLineDash([]);
  // Pier.
  for (const pr of SC.piers) {
    const s = SC.worldToScreen(pr.x, pr.y);
    c.fillStyle = '#8a6f4d';
    c.fillRect(s.x, s.y, pr.w, pr.h);
    c.fillStyle = '#6f5a3d';
    for (let y = s.y + 8; y < s.y + pr.h; y += 18) c.fillRect(s.x, y, pr.w, 2);
  }
  // Boats.
  for (const b of SC.boats) {
    const s = SC.worldToScreen(b.x, b.y);
    c.save();
    c.translate(s.x, s.y);
    c.rotate(b.angle);
    c.fillStyle = '#f2ede2';
    c.beginPath(); c.ellipse(0, 0, 16, 7, 0, 0, TAU); c.fill();
    c.fillStyle = '#c94f3d';
    c.fillRect(-4, -3, 8, 6);
    c.restore();
  }
  // Buildings.
  for (const b of SC.buildings) {
    if (b.x + b.w < x0 || b.x > x1 || b.y + b.h < y0 || b.y > y1) continue;
    const s = SC.worldToScreen(b.x, b.y);
    c.fillStyle = 'rgba(0,0,0,0.18)';
    c.fillRect(s.x + 4, s.y + 5, b.w, b.h);
    c.fillStyle = b.color;
    c.fillRect(s.x, s.y, b.w, b.h);
    c.strokeStyle = 'rgba(0,0,0,0.25)';
    c.lineWidth = 2;
    c.strokeRect(s.x + 1, s.y + 1, b.w - 2, b.h - 2);
    // Roof detail: windows for towers, a lighter inset for houses.
    if (b.hgt > 1) {
      c.fillStyle = 'rgba(255,255,255,0.28)';
      for (let wy = s.y + 10; wy < s.y + b.h - 8; wy += 16) {
        for (let wx = s.x + 10; wx < s.x + b.w - 8; wx += 16) c.fillRect(wx, wy, 8, 9);
      }
    } else {
      c.fillStyle = 'rgba(255,255,255,0.22)';
      c.fillRect(s.x + 8, s.y + 8, b.w - 16, 10);
    }
  }
  // Port containers.
  for (const ct of SC.containers) {
    const s = SC.worldToScreen(ct.x, ct.y);
    c.fillStyle = ct.color;
    c.fillRect(s.x, s.y, ct.w, ct.h);
    c.strokeStyle = 'rgba(0,0,0,0.3)';
    c.lineWidth = 1;
    for (let x = s.x + 8; x < s.x + ct.w; x += 10) {
      c.beginPath(); c.moveTo(x, s.y); c.lineTo(x, s.y + ct.h); c.stroke();
    }
  }
  // Trees.
  for (const t of SC.trees) {
    if (t.x < x0 || t.x > x1 || t.y < y0 || t.y > y1) continue;
    const s = SC.worldToScreen(t.x, t.y);
    c.fillStyle = '#5c7a44';
    c.beginPath(); c.arc(s.x, s.y, t.r, 0, TAU); c.fill();
    c.fillStyle = '#7da05c';
    c.beginPath(); c.arc(s.x - 2, s.y - 2, t.r * 0.7, 0, TAU); c.fill();
  }
};

// ---- cars / people --------------------------------------------------------
SC.drawCar = (car) => {
  const c = SC.ctx;
  const s = SC.worldToScreen(car.x, car.y);
  c.save();
  c.translate(s.x, s.y);
  c.rotate(car.angle);
  c.fillStyle = 'rgba(0,0,0,0.25)';
  c.beginPath(); c.roundRect(-car.l / 2 + 2, -car.w / 2 + 3, car.l, car.w, 8); c.fill();
  c.fillStyle = car.color;
  c.beginPath(); c.roundRect(-car.l / 2, -car.w / 2, car.l, car.w, 8); c.fill();
  // Windshield + roof.
  c.fillStyle = 'rgba(20,30,40,0.85)';
  c.beginPath(); c.roundRect(car.l * 0.08, -car.w / 2 + 5, car.l * 0.22, car.w - 10, 4); c.fill();
  c.fillStyle = 'rgba(255,255,255,0.16)';
  c.beginPath(); c.roundRect(-car.l * 0.32, -car.w / 2 + 5, car.l * 0.3, car.w - 10, 4); c.fill();
  // Headlights.
  c.fillStyle = '#ffe9a8';
  c.fillRect(car.l / 2 - 3, -car.w / 2 + 4, 3, 5);
  c.fillRect(car.l / 2 - 3, car.w / 2 - 9, 3, 5);
  // Taxi sign / police livery.
  if (car.type === 'taxi') {
    c.fillStyle = '#1c1c22';
    c.font = 'bold 9px Arial';
    c.textAlign = 'center';
    c.fillText('TAXI', 0, 3);
  }
  if (car.police) {
    c.fillStyle = '#f2ede2';
    c.fillRect(-car.l * 0.1, -car.w / 2, car.l * 0.28, car.w);
    const flash = Math.floor(SC.time * 6) % 2 === 0;
    c.fillStyle = flash ? '#e05252' : '#3b6fd4';
    c.fillRect(-8, -car.w / 2 - 3, 7, 5);
    c.fillStyle = flash ? '#3b6fd4' : '#e05252';
    c.fillRect(1, -car.w / 2 - 3, 7, 5);
  }
  if (car.type === 'rival') {
    c.fillStyle = '#e05252';
    c.font = 'bold 9px Arial';
    c.textAlign = 'center';
    c.fillText('DANTE', 0, 3);
  }
  c.restore();
  // Damage smoke.
  if (car.health < 45 && SC.rng() < 0.3) {
    SC.effects.push({ type: 'smoke', x: car.x, y: car.y, vx: 0, vy: -30, t: 0.8 });
  }
};

SC.drawPerson = (x, y, angle, color, r, down) => {
  const c = SC.ctx;
  const s = SC.worldToScreen(x, y);
  if (down) {
    c.fillStyle = color;
    c.beginPath(); c.ellipse(s.x, s.y, r + 2, r * 0.7, 0, 0, TAU); c.fill();
    c.fillStyle = 'rgba(0,0,0,0.3)';
    c.beginPath(); c.arc(s.x + 4, s.y - 3, 3, 0, TAU); c.fill();
    return;
  }
  // Shadow + body + head.
  c.fillStyle = 'rgba(0,0,0,0.25)';
  c.beginPath(); c.ellipse(s.x, s.y + 6, r, r * 0.5, 0, 0, TAU); c.fill();
  c.fillStyle = color;
  c.beginPath(); c.arc(s.x, s.y, r, 0, TAU); c.fill();
  c.fillStyle = '#e8c39a';
  c.beginPath(); c.arc(s.x + Math.cos(angle) * 3, s.y + Math.sin(angle) * 3 - 2, r * 0.55, 0, TAU); c.fill();
};

SC.drawEffects = () => {
  const c = SC.ctx;
  for (const e of SC.effects) {
    if (e.type === 'skid') {
      const s = SC.worldToScreen(e.x, e.y);
      c.fillStyle = `rgba(20,20,20,${Math.min(0.5, e.t)})`;
      c.fillRect(s.x - 6, s.y - 2, 12, 4);
    } else if (e.type === 'tracer') {
      const a = SC.worldToScreen(e.x1, e.y1), b = SC.worldToScreen(e.x2, e.y2);
      c.strokeStyle = `rgba(255,220,120,${Math.min(1, e.t * 8)})`;
      c.lineWidth = 2;
      c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke();
    } else if (e.type === 'spark') {
      const s = SC.worldToScreen(e.x, e.y);
      c.fillStyle = '#ffd76e';
      c.fillRect(s.x - 1.5, s.y - 1.5, 3, 3);
    } else if (e.type === 'star') {
      const s = SC.worldToScreen(e.x, e.y);
      c.fillStyle = '#ffe9a8';
      c.font = 'bold 13px Arial';
      c.textAlign = 'center';
      c.fillText('*', s.x, s.y);
    } else if (e.type === 'smoke') {
      const s = SC.worldToScreen(e.x, e.y);
      c.fillStyle = `rgba(120,120,120,${Math.min(0.4, e.t * 0.4)})`;
      c.beginPath(); c.arc(s.x, s.y, 8 + (1.2 - e.t) * 8, 0, TAU); c.fill();
    }
  }
};

SC.drawMarkers = () => {
  const c = SC.ctx;
  const pulse = 1 + Math.sin(SC.time * 4) * 0.15;
  for (const m of SC.markers) {
    const mx = m.follow ? m.follow.x : m.x;
    const my = m.follow ? m.follow.y : m.y;
    const s = SC.worldToScreen(mx, my);
    if (s.x < -60 || s.x > SC.VW + 60 || s.y < -60 || s.y > SC.VH + 60) continue;
    c.save();
    c.translate(s.x, s.y - 26);
    c.rotate(Math.PI / 4);
    c.fillStyle = m.color;
    const sz = 11 * pulse;
    c.fillRect(-sz / 2, -sz / 2, sz, sz);
    c.strokeStyle = 'rgba(255,255,255,0.85)';
    c.lineWidth = 2;
    c.strokeRect(-sz / 2, -sz / 2, sz, sz);
    c.restore();
    c.fillStyle = m.color;
    c.beginPath(); c.arc(s.x, s.y, 3, 0, TAU); c.fill();
  }
};

// ---- HUD ------------------------------------------------------------------
SC.drawHUD = () => {
  const c = SC.ctx;
  const p = SC.player;
  c.textAlign = 'left';
  // Top-left: cash, health, ammo.
  c.fillStyle = 'rgba(16,20,24,0.8)';
  c.beginPath(); c.roundRect(16, 14, 230, 76, 10); c.fill();
  c.fillStyle = '#f2ede2';
  c.font = 'bold 26px Arial';
  c.fillText('$' + SC.cash.toLocaleString('en-US'), 30, 46);
  c.fillStyle = '#9aa5ad';
  c.font = '13px Arial';
  c.fillText('SOLMAR CITY', 30, 66);
  c.fillStyle = '#2c3438';
  c.beginPath(); c.roundRect(30, 72, 150, 8, 4); c.fill();
  c.fillStyle = SC.health > 40 ? '#7fd08a' : '#e05252';
  c.beginPath(); c.roundRect(30, 72, 150 * (SC.health / 100), 8, 4); c.fill();
  c.fillStyle = '#f2ede2';
  c.font = '12px Arial';
  c.fillText('AMMO ' + SC.ammo, 190, 80);
  // Top-right: wanted stars + clock.
  c.fillStyle = 'rgba(16,20,24,0.8)';
  c.beginPath(); c.roundRect(SC.VW - 246, 14, 230, 76, 10); c.fill();
  c.font = 'bold 30px Arial';
  c.textAlign = 'right';
  let stars = '';
  for (let i = 0; i < 5; i++) stars += i < SC.wanted ? '★' : '☆';
  c.fillStyle = SC.wanted > 0 ? '#f5b942' : '#5a646c';
  c.fillText(stars, SC.VW - 30, 50);
  c.fillStyle = '#9aa5ad';
  c.font = '13px Arial';
  const mins = Math.floor(SC.playT / 60), secs = Math.floor(SC.playT % 60);
  c.fillText(`DAY 1  ${String(17 + Math.floor(SC.playT / 360)).padStart(2, '0')}:${String(secs).padStart(2, '0')}`, SC.VW - 30, 72);
  c.textAlign = 'left';
  // Bottom-left: objective.
  const obj = SC.currentObjective();
  c.fillStyle = 'rgba(16,20,24,0.8)';
  c.beginPath(); c.roundRect(16, SC.VH - 86, 430, 70, 10); c.fill();
  c.fillStyle = '#f5b942';
  c.font = 'bold 13px Arial';
  c.fillText('OBJECTIVE', 30, SC.VH - 62);
  c.fillStyle = '#f2ede2';
  c.font = '15px Arial';
  c.fillText(obj, 30, SC.VH - 38, 400);
  // Speed when driving.
  if (p && !p.onFoot && p.car) {
    c.fillStyle = 'rgba(16,20,24,0.8)';
    c.beginPath(); c.roundRect(SC.VW - 246, SC.VH - 86, 230, 70, 10); c.fill();
    c.fillStyle = '#f2ede2';
    c.font = 'bold 30px Arial';
    c.textAlign = 'right';
    c.fillText(Math.round(Math.abs(p.car.speed) * 0.36) + ' km/h', SC.VW - 30, SC.VH - 42);
    c.fillStyle = '#9aa5ad';
    c.font = '12px Arial';
    c.fillText(p.car.type.toUpperCase(), SC.VW - 30, SC.VH - 24);
    c.textAlign = 'left';
  }
  // Message line.
  if (SC.messageT > 0 && SC.message) {
    c.font = '15px Arial';
    const w = c.measureText(SC.message).width + 28;
    c.fillStyle = 'rgba(16,20,24,0.85)';
    c.beginPath(); c.roundRect((SC.VW - w) / 2, SC.VH - 140, w, 32, 8); c.fill();
    c.fillStyle = '#f2ede2';
    c.textAlign = 'center';
    c.fillText(SC.message, SC.VW / 2, SC.VH - 118);
    c.textAlign = 'left';
  }
  // Banner.
  if (SC.banner) {
    const a = Math.min(1, SC.banner.t);
    c.globalAlpha = a;
    c.fillStyle = 'rgba(16,20,24,0.88)';
    c.fillRect(0, SC.VH / 2 - 74, SC.VW, 108);
    c.fillStyle = '#f5b942';
    c.font = 'bold 44px Arial';
    c.textAlign = 'center';
    c.fillText(SC.banner.text, SC.VW / 2, SC.VH / 2 - 22);
    c.fillStyle = '#f2ede2';
    c.font = '18px Arial';
    c.fillText(SC.banner.sub, SC.VW / 2, SC.VH / 2 + 12);
    c.textAlign = 'left';
    c.globalAlpha = 1;
  }
  // Dialogue box.
  if (SC.dialogue) {
    c.fillStyle = 'rgba(16,20,24,0.88)';
    c.beginPath(); c.roundRect(240, SC.VH - 210, 800, 56, 10); c.fill();
    c.fillStyle = '#f5b942';
    c.font = 'bold 14px Arial';
    c.fillText(SC.dialogue.name.toUpperCase(), 260, SC.VH - 186);
    c.fillStyle = '#f2ede2';
    c.font = '16px Arial';
    c.fillText(SC.dialogue.text, 260, SC.VH - 164, 760);
  }
  // Minimap.
  SC.drawMinimap();
};

SC.currentObjective = () => {
  const a = SC.jobs.active;
  if (a) {
    const step = a.job.steps[a.step];
    if (!step) return a.job.name;
    if (step.survive) return `${a.job.name} — survive ${Math.max(0, Math.ceil(step.survive - a.t))}s`;
    if (step.timer && a.step === 1) return `${step.text} — ${Math.max(0, Math.ceil(step.timer - a.t))}s left`;
    return step.text;
  }
  const g = SC.jobs.gig;
  if (g) return g.type === 'taxi' ? (g.step === 0 ? 'Taxi: pick up the passenger' : 'Taxi: drop off the passenger') : `Courier: drop ${g.step + 1} of 3`;
  const nj = SC.nextJob();
  if (nj) return `Next job: ${nj.name} — go to the green marker`;
  return 'Free roam — earn cash with gigs, or just explore Solmar';
};

SC.drawMinimap = () => {
  const c = SC.ctx;
  const mw = 200, mh = 150, mx = SC.VW - mw - 16, my = SC.VH - mh - 16;
  const sx = mw / SC.W, sy = mh / SC.H;
  c.fillStyle = 'rgba(16,20,24,0.85)';
  c.beginPath(); c.roundRect(mx - 6, my - 6, mw + 12, mh + 12, 10); c.fill();
  c.fillStyle = '#22303a';
  c.fillRect(mx, my, mw, mh);
  // Sea + sand.
  c.fillStyle = '#2e7f9e';
  c.fillRect(mx, my + SC.SEA_Y * sy, mw, mh - SC.SEA_Y * sy);
  c.fillStyle = '#e0c98f';
  c.fillRect(mx, my + SC.SAND_Y * sy, mw, (SC.SEA_Y - SC.SAND_Y) * sy);
  // Roads.
  c.strokeStyle = '#8a949c';
  c.lineWidth = 2;
  for (const rx of SC.roadsV) {
    c.beginPath(); c.moveTo(mx + rx * sx, my); c.lineTo(mx + rx * sx, my + mh); c.stroke();
  }
  for (const ry of SC.roadsH) {
    c.beginPath(); c.moveTo(mx, my + ry * sy); c.lineTo(mx + mw, my + ry * sy); c.stroke();
  }
  // Route line to the first marker.
  if (SC.markers.length > 0) {
    const m = SC.markers[0];
    const tx = m.follow ? m.follow.x : m.x;
    const ty = m.follow ? m.follow.y : m.y;
    c.strokeStyle = '#f5b942';
    c.lineWidth = 2;
    c.setLineDash([4, 4]);
    c.beginPath();
    c.moveTo(mx + SC.player.x * sx, my + SC.player.y * sy);
    c.lineTo(mx + tx * sx, my + ty * sy);
    c.stroke();
    c.setLineDash([]);
  }
  // Markers.
  for (const m of SC.markers) {
    const tx = m.follow ? m.follow.x : m.x;
    const ty = m.follow ? m.follow.y : m.y;
    c.fillStyle = m.color;
    c.beginPath(); c.arc(mx + tx * sx, my + ty * sy, 4, 0, TAU); c.fill();
  }
  // Police.
  c.fillStyle = '#5f8ff0';
  for (const car of SC.cars) {
    if (!car.police) continue;
    c.beginPath(); c.arc(mx + car.x * sx, my + car.y * sy, 3, 0, TAU); c.fill();
  }
  // Player arrow.
  const px = mx + SC.player.x * sx, py = my + SC.player.y * sy;
  c.save();
  c.translate(px, py);
  c.rotate(SC.player.angle);
  c.fillStyle = '#ffffff';
  c.beginPath(); c.moveTo(7, 0); c.lineTo(-5, -5); c.lineTo(-5, 5); c.closePath(); c.fill();
  c.restore();
  c.strokeStyle = 'rgba(255,255,255,0.35)';
  c.lineWidth = 1;
  c.strokeRect(mx, my, mw, mh);
};

// ---- screens ----------------------------------------------------------------
SC.drawTitle = () => {
  const c = SC.ctx;
  // Sun-soaked city backdrop: gradient sky + skyline silhouette.
  const g = c.createLinearGradient(0, 0, 0, SC.VH);
  g.addColorStop(0, '#f2a65a');
  g.addColorStop(0.55, '#e07856');
  g.addColorStop(1, '#3a3f5c');
  c.fillStyle = g;
  c.fillRect(0, 0, SC.VW, SC.VH);
  c.fillStyle = '#f5d76e';
  c.beginPath(); c.arc(SC.VW - 260, 170, 64, 0, TAU); c.fill();
  // Skyline.
  c.fillStyle = '#2c2f45';
  const base = SC.VH - 190;
  let x = 0;
  const rng = mulberry32(7);
  while (x < SC.VW) {
    const w = 60 + rng() * 90, h = 120 + rng() * 260;
    c.fillRect(x, base - h + 190, w, h);
    c.fillStyle = 'rgba(245,215,110,0.5)';
    for (let wy = base - h + 210; wy < base + 170; wy += 26) {
      for (let wx = x + 12; wx < x + w - 10; wx += 22) {
        if (rng() < 0.5) c.fillRect(wx, wy, 8, 10);
      }
    }
    c.fillStyle = '#2c2f45';
    x += w + 8;
  }
  c.fillStyle = '#1c1e30';
  c.fillRect(0, SC.VH - 190, SC.VW, 190);
  // Road with a car.
  c.fillStyle = '#3a3f46';
  c.fillRect(0, SC.VH - 120, SC.VW, 70);
  c.strokeStyle = '#e8e4d8';
  c.lineWidth = 3;
  c.setLineDash([18, 22]);
  c.beginPath(); c.moveTo(0, SC.VH - 85); c.lineTo(SC.VW, SC.VH - 85); c.stroke();
  c.setLineDash([]);
  c.save();
  c.translate(300, SC.VH - 100);
  c.fillStyle = '#c94f3d';
  c.beginPath(); c.roundRect(-32, -14, 64, 28, 8); c.fill();
  c.fillStyle = 'rgba(20,30,40,0.85)';
  c.beginPath(); c.roundRect(-8, -9, 20, 18, 4); c.fill();
  c.restore();

  c.textAlign = 'center';
  c.fillStyle = '#ffffff';
  c.font = 'bold 84px Arial';
  c.fillText('SOLMAR CITY', SC.VW / 2, 210);
  c.fillStyle = '#f5d76e';
  c.font = 'bold 22px Arial';
  c.fillText('A SUN-SOAKED OPEN-WORLD CRIME GAME', SC.VW / 2, 252);
  c.fillStyle = '#f2ede2';
  c.font = '17px Arial';
  c.fillText('Steal cars. Outrun the Solmar PD. Run jobs for Marco.', SC.VW / 2, 300);
  if (Math.floor(SC.time * 1.4) % 2 === 0) {
    c.font = 'bold 24px Arial';
    c.fillText('PRESS ENTER TO PLAY', SC.VW / 2, 430);
  }
  c.font = '15px Arial';
  c.fillStyle = '#d8dee2';
  c.fillText('WASD move / drive    E enter car    F punch    Click or Space shoot    Shift sprint    P pause    M mute', SC.VW / 2, 500);
  if (SC.saveExists) {
    c.fillStyle = '#7fd08a';
    c.font = 'bold 16px Arial';
    c.fillText('Save found — your cash and jobs carry over', SC.VW / 2, 540);
  }
  c.fillStyle = '#9aa5ad';
  c.font = '13px Arial';
  c.fillText('An original game. No connection to any commercial game.', SC.VW / 2, SC.VH - 24);
  c.textAlign = 'left';
};

SC.drawPaused = () => {
  const c = SC.ctx;
  c.fillStyle = 'rgba(10,12,16,0.72)';
  c.fillRect(0, 0, SC.VW, SC.VH);
  c.textAlign = 'center';
  c.fillStyle = '#ffffff';
  c.font = 'bold 52px Arial';
  c.fillText('PAUSED', SC.VW / 2, SC.VH / 2 - 30);
  c.fillStyle = '#d8dee2';
  c.font = '17px Arial';
  c.fillText(`Cash $${SC.cash}  •  Jobs done ${SC.jobs.done.length} of 3  •  Earned $${SC.score}`, SC.VW / 2, SC.VH / 2 + 16);
  c.fillText('P resume    R restart the day', SC.VW / 2, SC.VH / 2 + 52);
  c.textAlign = 'left';
};

SC.drawBusted = () => {
  const c = SC.ctx;
  c.fillStyle = 'rgba(10,12,16,0.8)';
  c.fillRect(0, 0, SC.VW, SC.VH);
  c.textAlign = 'center';
  c.fillStyle = '#e05252';
  c.font = 'bold 72px Arial';
  c.fillText('BUSTED', SC.VW / 2, SC.VH / 2 - 40);
  c.fillStyle = '#f2ede2';
  c.font = '19px Arial';
  c.fillText(SC.bannerData ? SC.bannerData.sub : 'The Solmar PD caught you.', SC.VW / 2, SC.VH / 2 + 6);
  c.fillStyle = '#d8dee2';
  c.font = '16px Arial';
  c.fillText('Press Enter to get back on the streets', SC.VW / 2, SC.VH / 2 + 48);
  c.textAlign = 'left';
};

SC.drawStory = () => {
  const c = SC.ctx;
  c.fillStyle = 'rgba(10,12,16,0.92)';
  c.fillRect(0, 0, SC.VW, SC.VH);
  c.textAlign = 'center';
  c.fillStyle = '#f5b942';
  c.font = 'bold 40px Arial';
  c.fillText('SOLMAR CITY', SC.VW / 2, 220);
  c.fillStyle = '#f2ede2';
  c.font = '20px Arial';
  const lines = [
    'You came to Solmar with a stolen sedan and a name no one knows.',
    'Marco runs the Old Town crew, and he has work for a driver like you.',
    'Three jobs. One rival. A whole police force between you and the money.',
    '',
    'Make it to the end of the story — and do not get caught.',
  ];
  lines.forEach((l, i) => c.fillText(l, SC.VW / 2, 300 + i * 36));
  if (Math.floor(SC.time * 1.4) % 2 === 0) {
    c.font = 'bold 22px Arial';
    c.fillText('PRESS ENTER TO START', SC.VW / 2, 580);
  }
  c.textAlign = 'left';
};

// ---- frame ------------------------------------------------------------------
SC.render = () => {
  const c = SC.ctx;
  if (SC.state === 'title') { SC.drawTitle(); return; }
  if (SC.state === 'story') { SC.drawStory(); return; }
  SC.drawWorld();
  // Cars (police last so they draw on top).
  for (const car of SC.cars) if (!car.police) SC.drawCar(car);
  for (const car of SC.cars) if (car.police) SC.drawCar(car);
  // People.
  for (const ped of SC.peds) SC.drawPerson(ped.x, ped.y, ped.angle, ped.color, ped.r, ped.downT > 0);
  for (const cp of SC.cops) SC.drawPerson(cp.x, cp.y, cp.angle, '#2b3a67', cp.r, false);
  // Player (on foot only; in a car the car is the player).
  const p = SC.player;
  if (p.onFoot) {
    // A soft white ring so the player reads at a glance, even at this zoom.
    const rp = SC.worldToScreen(p.x, p.y);
    c.strokeStyle = `rgba(255,255,255,${0.55 + Math.sin(SC.time * 4) * 0.2})`;
    c.lineWidth = 2;
    c.beginPath(); c.arc(rp.x, rp.y, 17 + Math.sin(SC.time * 4) * 1.5, 0, TAU); c.stroke();
    SC.drawPerson(p.x, p.y, p.angle, '#c94f3d', p.r, false);
    // Direction tick.
    const s = SC.worldToScreen(p.x + Math.cos(p.angle) * 14, p.y + Math.sin(p.angle) * 14);
    c.fillStyle = '#f2ede2';
    c.beginPath(); c.arc(s.x, s.y, 2.5, 0, TAU); c.fill();
  }
  SC.drawMarkers();
  SC.drawEffects();
  // Time-of-day tint.
  if (SC.tint === 'sunset') { c.fillStyle = 'rgba(240,140,70,0.10)'; c.fillRect(0, 0, SC.VW, SC.VH); }
  if (SC.tint === 'dusk') { c.fillStyle = 'rgba(60,60,120,0.16)'; c.fillRect(0, 0, SC.VW, SC.VH); }
  if (SC.tint === 'night') { c.fillStyle = 'rgba(10,16,48,0.28)'; c.fillRect(0, 0, SC.VW, SC.VH); }
  SC.drawHUD();
  if (SC.state === 'paused') SC.drawPaused();
  if (SC.state === 'busted') SC.drawBusted();
};
