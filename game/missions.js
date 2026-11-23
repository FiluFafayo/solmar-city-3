// Solmar City — missions: three story jobs plus repeatable gigs.
// Jobs unlock in order; gigs repeat for cash. All markers live on the map
// and on the minimap, and every job talks to the player as it unfolds.

SC.jobs = {
  list: [
    {
      id: 'pickup', name: 'The Pickup', pay: 300, bonus: 100,
      brief: 'Marco needs a package moved across town. Pick it up in Old Town, drop it at the Port.',
      steps: [
        { text: 'Pick up the package in Old Town', at: { x: 360, y: 840 }, r: 46 },
        { text: 'Deliver the package to the Port warehouse', at: { x: 2040, y: 840 }, r: 46, timer: 120 },
      ],
    },
    {
      id: 'getaway', name: 'Getaway Driver', pay: 500, bonus: 0,
      brief: 'The crew hit the Solmar Bank. You are the wheelman. Survive three stars for 60 seconds.',
      steps: [
        { text: 'Lose the cops. Survive 60 seconds at 3 stars.', survive: 60 },
      ],
    },
    {
      id: 'rival', name: 'The Rival', pay: 800, bonus: 200,
      brief: 'Dante and his black coupe have been running your streets. Wreck his car, then lose the heat.',
      steps: [
        { text: 'Wreck Dante\'s coupe', hunt: true },
        { text: 'Lose the cops', escape: true },
      ],
    },
  ],
  done: [],          // job ids finished
  active: null,      // {job, step, t, rival}
  gig: null,         // {type, step, t, passenger}
  cooldown: 0,
};

SC.jobAvailable = (id) => {
  const order = ['pickup', 'getaway', 'rival'];
  const i = order.indexOf(id);
  if (i < 0) return false;
  if (SC.jobs.done.includes(id)) return false;
  if (i === 0) return true;
  return SC.jobs.done.includes(order[i - 1]);
};

SC.nextJob = () => SC.jobs.list.find((j) => SC.jobAvailable(j.id)) || null;

SC.startJob = (job) => {
  SC.jobs.active = { job, step: 0, t: 0, rival: null };
  SC.talk('Marco', job.brief, 5);
  SC.say('New job: ' + job.name);
  SC.audio.jingle(true);
  if (job.id === 'getaway') {
    SC.wanted = 3;
    SC.wantedT = 0;
    SC.say('Three stars. Run.');
  }
  if (job.id === 'rival') {
    const j = SC.randomJunction(1200, 360, 1800, 1080);
    const rival = SC.newCar(j.x, j.y, 0, 'rival', { driver: 'rival', health: 100 });
    rival.target = SC.randomJunction(0, 0, SC.W, SC.SEA_Y - 200);
    SC.cars.push(rival);
    SC.jobs.active.rival = rival;
    SC.say('Dante is out there in the black coupe. Find him.');
  }
  SC.updateMarkers();
};

SC.finishJob = (job, bonus) => {
  const pay = job.pay + (bonus ? job.bonus : 0);
  SC.cash += pay;
  SC.score += pay;
  SC.jobs.done.push(job.id);
  SC.jobs.active = null;
  SC.showBanner('JOB DONE', `${job.name} — $${pay} earned`);
  SC.audio.jingle(true);
  SC.saveGame();
  SC.updateMarkers();
};

SC.failJob = (why) => {
  const a = SC.jobs.active;
  SC.jobs.active = null;
  SC.showBanner('JOB FAILED', why);
  SC.audio.jingle(false);
  if (a && a.rival) SC.cars = SC.cars.filter((c) => c !== a.rival);
  SC.updateMarkers();
};

// ---- gigs ----------------------------------------------------------------
SC.startGig = (type) => {
  const p = SC.player;
  if (type === 'taxi') {
    const from = SC.randomJunction(200, 200, SC.W - 200, SC.SAND_Y - 200);
    const to = SC.randomJunction(200, 200, SC.W - 200, SC.SAND_Y - 200);
    SC.jobs.gig = { type, step: 0, t: 0, from, to, pay: 50 + Math.floor(SC.rng() * 40) };
    SC.talk('Passenger', 'Hey! I need a ride across town. Quick, please.', 4);
    SC.say('Taxi gig: pick up the passenger (yellow marker).');
  } else {
    const stops = [
      SC.randomJunction(200, 200, SC.W - 200, SC.SAND_Y - 200),
      SC.randomJunction(200, 200, SC.W - 200, SC.SAND_Y - 200),
      SC.randomJunction(200, 200, SC.W - 200, SC.SAND_Y - 200),
    ];
    SC.jobs.gig = { type, step: 0, t: 0, stops, pay: 150 };
    SC.talk('Dispatch', 'Three parcels, three stops. Do not be late.', 4);
    SC.say('Courier gig: three drops. $150 on completion.');
  }
  SC.updateMarkers();
};

SC.finishGig = () => {
  const g = SC.jobs.gig;
  SC.cash += g.pay;
  SC.score += g.pay;
  SC.jobs.gig = null;
  SC.showBanner('GIG DONE', `+$${g.pay}`);
  SC.audio.cash();
  SC.saveGame();
  SC.updateMarkers();
};

// ---- markers -------------------------------------------------------------
SC.updateMarkers = () => {
  SC.markers = [];
  const a = SC.jobs.active;
  if (a && a.job && a.job.steps) {
    const step = a.job.steps[a.step];
    if (step && step.at) SC.markers.push({ x: step.at.x, y: step.at.y, color: '#f5b942', label: step.text });
    if (step && step.hunt && a.rival) SC.markers.push({ x: a.rival.x, y: a.rival.y, color: '#e05252', label: 'Dante', follow: a.rival });
    if (step && step.survive) SC.markers.push({ x: SC.player.x, y: SC.player.y, color: '#e05252', label: 'Survive', follow: SC.player });
  }
  const g = SC.jobs.gig;
  if (g) {
    if (g.type === 'taxi') {
      const at = g.step === 0 ? g.from : g.to;
      SC.markers.push({ x: at.x, y: at.y, color: '#f5d76e', label: g.step === 0 ? 'Passenger' : 'Drop-off' });
    } else {
      const at = g.stops[g.step];
      SC.markers.push({ x: at.x, y: at.y, color: '#f5d76e', label: `Drop ${g.step + 1} of 3` });
    }
  }
  // Job start markers for available jobs.
  const nj = SC.nextJob();
  if (nj && !a) {
    const spots = { pickup: { x: 600, y: 600 }, getaway: { x: 1200, y: 600 }, rival: { x: 1800, y: 1080 } };
    const s = spots[nj.id];
    SC.markers.push({ x: s.x, y: s.y, color: '#7fd08a', label: nj.name + ' — walk in to start' });
  }
  // Gig markers when nothing is active.
  if (!a && !g && SC.jobs.done.includes('pickup')) {
    SC.markers.push({ x: 960, y: 1320, color: '#7fd0c9', label: 'Taxi gig' });
    SC.markers.push({ x: 1560, y: 360, color: '#7fd0c9', label: 'Courier gig' });
  }
  // Repair garage + gun shop (always on the map).
  SC.markers.push({ x: 360, y: 1320, color: '#8fa3b8', label: 'Garage — repair $40', shop: 'garage' });
  SC.markers.push({ x: 2040, y: 360, color: '#8fa3b8', label: 'Gun shop — ammo $25', shop: 'ammo' });
};

// ---- per-frame mission logic ---------------------------------------------
SC.updateMissions = (dt) => {
  const p = SC.player;
  if (!p) return;
  SC.jobs.cooldown = Math.max(0, SC.jobs.cooldown - dt);

  const a = SC.jobs.active;
  if (a) {
    const job = a.job;
    const step = job.steps[a.step];
    a.t += dt;
    if (job.id === 'pickup') {
      if (step.at && dist2(p.x, p.y, step.at.x, step.at.y) < step.r * step.r) {
        if (a.step === 0) {
          a.step = 1;
          SC.talk('Marco', 'Good. Now the Port warehouse — and hurry, the buyer hates waiting.', 4);
          SC.audio.cash();
          SC.updateMarkers();
        } else {
          SC.finishJob(job, a.t <= (step.timer || 1e9));
        }
      }
      if (step.timer && a.t > step.timer && a.step === 1) {
        SC.failJob('Too slow — the buyer walked away.');
      }
    } else if (job.id === 'getaway') {
      if (a.t >= step.survive) {
        SC.wanted = Math.max(0, SC.wanted - 2);
        SC.finishJob(job, false);
        SC.say('You made it. Marco is impressed.');
      }
    } else if (job.id === 'rival') {
      const r = a.rival;
      if (step.hunt) {
        if (!r || r.health <= 0) {
          a.step = 1;
          SC.addWanted(2);
          SC.talk('Dante', 'My car! You will pay for this, Solmar!', 4);
          SC.say('His car is scrap. Now lose the cops.');
          SC.updateMarkers();
        } else if (r) {
          // Rival flees along the roads.
          if (!r.target || dist2(r.x, r.y, r.target.x, r.target.y) < 30 * 30) {
            r.target = SC.randomJunction(0, 0, SC.W, SC.SEA_Y - 200);
          }
          const want = Math.abs(r.target.x - r.x) > Math.abs(r.target.y - r.y)
            ? (r.target.x > r.x ? 0 : Math.PI) : (r.target.y > r.y ? Math.PI / 2 : -Math.PI / 2);
          r.angle += clamp(angDiff(r.angle, want), -2.6 * dt, 2.6 * dt);
          r.speed = lerp(r.speed, 330, 1 - Math.exp(-1.5 * dt));
          r.x += Math.cos(r.angle) * r.speed * dt;
          r.y += Math.sin(r.angle) * r.speed * dt;
          SC.collide(r, 16);
          // Player ramming the rival damages it.
          if (p.car && dist2(p.x, p.y, r.x, r.y) < 48 * 48) {
            const rel = Math.abs(p.car.speed);
            if (rel > 120) {
              r.health -= rel * dt * 0.35;
              SC.spawnSparks(r.x, r.y);
              SC.audio.thud();
            }
          }
        }
      } else if (step.escape) {
        if (SC.wanted === 0) SC.finishJob(job, a.t < 90);
      }
    }
  }

  // Gig logic.
  const g = SC.jobs.gig;
  if (g) {
    g.t += dt;
    if (g.type === 'taxi') {
      const at = g.step === 0 ? g.from : g.to;
      if (dist2(p.x, p.y, at.x, at.y) < 46 * 46) {
        if (g.step === 0) {
          g.step = 1;
          SC.talk('Passenger', 'To the marker, please. I am in a hurry.', 3);
          SC.updateMarkers();
        } else SC.finishGig();
      }
    } else {
      const at = g.stops[g.step];
      if (dist2(p.x, p.y, at.x, at.y) < 46 * 46) {
        g.step++;
        SC.audio.cash();
        if (g.step >= 3) SC.finishGig();
        else SC.updateMarkers();
      }
    }
    if (g.t > 240) { SC.jobs.gig = null; SC.showBanner('GIG FAILED', 'Too slow.'); SC.updateMarkers(); }
  }

  // Walk into a job-start or gig marker.
  if (!a && !g && SC.jobs.cooldown <= 0) {
    const nj = SC.nextJob();
    const spots = { pickup: { x: 600, y: 600 }, getaway: { x: 1200, y: 600 }, rival: { x: 1800, y: 1080 } };
    if (nj) {
      const s = spots[nj.id];
      if (dist2(p.x, p.y, s.x, s.y) < 52 * 52) {
        SC.jobs.cooldown = 2;
        SC.startJob(nj);
        return;
      }
    }
    if (SC.jobs.done.includes('pickup')) {
      if (dist2(p.x, p.y, 960, 1320) < 52 * 52) { SC.jobs.cooldown = 2; SC.startGig('taxi'); return; }
      if (dist2(p.x, p.y, 1560, 360) < 52 * 52) { SC.jobs.cooldown = 2; SC.startGig('courier'); return; }
    }
  }

  // Shops.
  if (dist2(p.x, p.y, 360, 1320) < 52 * 52 && p.car && p.car.health < 100 && SC.cash >= 40 && SC.pressed['e']) {
    SC.cash -= 40;
    p.car.health = 100;
    SC.say('Garage: car repaired for $40.');
    SC.audio.cash();
  }
  if (dist2(p.x, p.y, 2040, 360) < 52 * 52 && SC.cash >= 25 && SC.pressed['e']) {
    SC.cash -= 25;
    SC.ammo = 24;
    SC.say('Gun shop: ammo restocked to 24 for $25.');
    SC.audio.cash();
  }
};
