// Solmar City — main: boot, game loop, state machine, screenshot scenes.
// The game starts on the title screen; ?shot=<name> jumps straight into a
// staged scene so the maker can screenshot the game at its best.

SC.bestWanted = 0;

SC.resetWorld = () => {
  SC.cars = [];
  SC.peds = [];
  SC.cops = [];
  SC.effects = [];
  SC.wanted = 0;
  SC.wantedT = 0;
  SC.health = 100;
  SC.ammo = 12;
  SC.jobs.active = null;
  SC.jobs.gig = null;
  SC.jobs.cooldown = 0;
  SC.player = SC.newPlayer(1200, 900);
  SC.spawnTraffic(16);
  SC.spawnParked(10);
  SC.spawnPeds(26);
  SC.updateMarkers();
};

SC.newDay = () => {
  SC.cash = 120;
  SC.score = 0;
  SC.kills = 0;
  SC.carsStolen = 0;
  SC.playT = 0;
  SC.bestWanted = 0;
  SC.jobs.done = [];
  SC.resetWorld();
};

SC.applySave = (save) => {
  if (!save) return;
  SC.cash = save.cash || 120;
  SC.score = save.earned || 0;
  SC.bestWanted = save.bestWanted || 0;
  SC.jobs.done = Array.isArray(save.jobs) ? save.jobs : [];
};

// Staged scenes for screenshots (also reachable by players as demos).
SC.setupShot = (name) => {
  SC.newDay();
  SC.state = 'playing';
  const p = SC.player;
  if (name === 'drive') {
    SC.tint = 'day';
    const car = SC.newCar(1200, 600, 0, 'sport', { driver: 'player', color: '#c94f3d' });
    SC.cars.push(car);
    p.car = car; p.onFoot = false; p.x = car.x; p.y = car.y; p.angle = 0;
    car.speed = 300;
    SC.wanted = 2;
    for (let i = 0; i < 2; i++) {
      const cop = SC.newCar(1200 - 160 - i * 90, 600 + (i % 2 === 0 ? 30 : -30), 0, 'police', { driver: 'police' });
      cop.siren = true; cop.speed = 280;
      SC.cars.push(cop);
    }
    SC.camera.x = 1260; SC.camera.y = 620;
    SC.say('Downtown Solmar — the PD is right behind you.');
  } else if (name === 'foot') {
    SC.tint = 'sunset';
    p.x = 1200; p.y = 1560; p.angle = Math.PI / 2;
    SC.camera.x = 1200; SC.camera.y = 1480;
    for (let i = 0; i < 6; i++) {
      const ped = SC.newPed(1080 + i * 60, 1500 + (i % 2) * 60);
      SC.peds.push(ped);
    }
    SC.markers.push({ x: 1320, y: 1560, color: '#7fd08a', label: 'The Pickup — walk in to start' });
    SC.talk('Marco', 'The package is waiting in Old Town. Do not keep me waiting.', 6);
    SC.say('The Marina at sunset. Jobs pay — if you are fast.');
  } else if (name === 'chase') {
    SC.tint = 'dusk';
    const car = SC.newCar(840, 1080, 0, 'sport', { driver: 'player', color: '#e8b93b' });
    SC.cars.push(car);
    p.car = car; p.onFoot = false; p.x = car.x; p.y = car.y; p.angle = 0;
    car.speed = 360;
    SC.wanted = 4;
    for (let i = 0; i < 3; i++) {
      const cop = SC.newCar(840 - 140 - i * 80, 1080 + (i - 1) * 46, 0, 'police', { driver: 'police' });
      cop.siren = true; cop.speed = 340;
      SC.cars.push(cop);
    }
    SC.cops.push(SC.newCop(980, 1000));
    SC.camera.x = 920; SC.camera.y = 1080;
    SC.say('Four stars. The whole force is after you now.');
  } else if (name === 'job') {
    SC.tint = 'night';
    p.x = 1980; p.y = 840; p.angle = 0;
    SC.camera.x = 1980; SC.camera.y = 840;
    const rival = SC.newCar(2040, 760, Math.PI, 'rival', { driver: 'rival', health: 55 });
    SC.cars.push(rival);
    SC.jobs.active = { job: SC.jobs.list[2], step: 0, t: 12, rival };
    SC.markers.push({ x: rival.x, y: rival.y, color: '#e05252', label: 'Dante', follow: rival });
    SC.talk('Dante', 'My car! You will pay for this, Solmar!', 6);
    SC.say('Wreck Dante\'s coupe — then lose the cops.');
  } else {
    SC.state = 'title';
  }
};

SC.boot = () => {
  SC.setupCanvas();
  SC.buildCity();
  const params = new URLSearchParams(window.location.search);
  SC.shot = params.get('shot');
  const save = SC.loadSave();
  SC.applySave(save);
  SC.newDay();
  if (SC.shot) {
    SC.setupShot(SC.shot);
  } else {
    SC.state = 'title';
  }
  // First interaction wakes the audio.
  const wake = () => { SC.audio.init(); SC.audio.resume(); };
  window.addEventListener('keydown', wake, { once: false });
  window.addEventListener('mousedown', wake, { once: false });
  requestAnimationFrame(SC.loop);
  SC.lastT = performance.now();
};

SC.loop = (now) => {
  requestAnimationFrame(SC.loop);
  let dt = Math.min(0.05, (now - SC.lastT) / 1000);
  SC.lastT = now;
  SC.time += dt;
  if (SC.state === 'playing') {
    SC.playT += dt;
    SC.updatePlayer(dt);
    SC.updateTraffic(dt);
    SC.updatePeds(dt);
    SC.updatePoliceCars(dt);
    SC.updateCops(dt);
    SC.updateWanted(dt);
    SC.updateMissions(dt);
    SC.updateEffects(dt);
    SC.updateCamera(dt);
    SC.audio.update(dt);
    SC.bestWanted = Math.max(SC.bestWanted, SC.wanted);
    if (SC.messageT > 0) SC.messageT -= dt;
    if (SC.banner) { SC.banner.t -= dt; if (SC.banner.t <= 0) SC.banner = null; }
    if (SC.dialogue) { SC.dialogue.t -= dt; if (SC.dialogue.t <= 0) SC.dialogue = null; }
    if (SC.pressed['p']) SC.state = 'paused';
    if (SC.pressed['m']) { SC.muted = !SC.muted; SC.say(SC.muted ? 'Sound off.' : 'Sound on.'); }
    // Story complete: all three jobs done.
    if (SC.jobs.done.length >= 3 && SC.state === 'playing' && !SC.storyShown) {
      SC.storyShown = true;
      SC.showBanner('STORY COMPLETE', `You own Solmar now. $${SC.score} earned.`);
      SC.saveGame();
    }
  } else if (SC.state === 'title') {
    if (SC.pressed['enter']) {
      SC.state = SC.jobs.done.length === 0 && !SC.saveExists ? 'story' : 'playing';
      SC.audio.init(); SC.audio.resume();
    }
  } else if (SC.state === 'story') {
    if (SC.pressed['enter']) { SC.state = 'playing'; SC.audio.init(); SC.audio.resume(); }
  } else if (SC.state === 'paused') {
    if (SC.pressed['p'] || SC.pressed['enter']) SC.state = 'playing';
    if (SC.pressed['r']) { SC.newDay(); SC.state = 'playing'; }
  } else if (SC.state === 'busted') {
    if (SC.pressed['enter']) {
      SC.state = 'playing';
      SC.updateMarkers();
    }
  }
  SC.pressed = {};
  SC.mouse.clicked = false;
  SC.render();
};

window.addEventListener('DOMContentLoaded', SC.boot);
