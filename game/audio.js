// Solmar City — audio: Web Audio synth for engine, sirens, shots and music.
// Everything is guarded: no audio context exists until the first key or
// click, and every call survives a suspended or missing context.

SC.audio = {
  ctx: null, master: null, engineOsc: null, engineGain: null, musicT: 0, musicStep: 0, sirenT: 0,

  init() {
    if (this.ctx) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.value = 60;
      const lp = this.ctx.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 420;
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0;
      this.engineOsc.connect(lp);
      lp.connect(this.engineGain);
      this.engineGain.connect(this.master);
      this.engineOsc.start();
    } catch (e) { this.ctx = null; }
  },

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
  },

  tone(freq, dur, type = 'sine', vol = 0.2, when = 0) {
    if (!this.ctx || SC.muted) return;
    try {
      const t0 = this.ctx.currentTime + when;
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = type; o.frequency.value = freq;
      g.gain.setValueAtTime(vol, t0);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
      o.connect(g); g.connect(this.master);
      o.start(t0); o.stop(t0 + dur + 0.02);
    } catch (e) { /* ignore */ }
  },

  noise(dur, vol = 0.25, freq = 1200) {
    if (!this.ctx || SC.muted) return;
    try {
      const t0 = this.ctx.currentTime;
      const len = Math.floor(this.ctx.sampleRate * dur);
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      const f = this.ctx.createBiquadFilter();
      f.type = 'bandpass'; f.frequency.value = freq;
      const g = this.ctx.createGain();
      g.gain.value = vol;
      src.connect(f); f.connect(g); g.connect(this.master);
      src.start(t0);
    } catch (e) { /* ignore */ }
  },

  shot(byPlayer) { this.noise(0.14, byPlayer ? 0.32 : 0.16, byPlayer ? 900 : 700); },
  thud() { this.tone(90, 0.12, 'sine', 0.3); this.noise(0.08, 0.12, 300); },
  door() { this.tone(180, 0.07, 'square', 0.1); this.tone(120, 0.09, 'square', 0.1, 0.06); },
  cash() { this.tone(880, 0.09, 'sine', 0.18); this.tone(1318, 0.14, 'sine', 0.18, 0.09); },
  explosion() { this.noise(0.6, 0.4, 220); this.tone(55, 0.5, 'sine', 0.35); },
  sirenBurst() { this.tone(660, 0.16, 'square', 0.07); this.tone(880, 0.16, 'square', 0.07, 0.17); },
  jingle(good) {
    const notes = good ? [523, 659, 784, 1046] : [392, 330, 262];
    notes.forEach((n, i) => this.tone(n, 0.16, 'triangle', 0.16, i * 0.12));
  },

  // Engine hum follows the player's car; sirens wail when police chase.
  update(dt) {
    if (!this.ctx || SC.muted) return;
    try {
      const p = SC.player;
      const driving = p && !p.onFoot && p.car;
      const target = driving ? 0.05 + Math.abs(p.car.speed) / 430 * 0.06 : 0;
      this.engineGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.1);
      if (driving) this.engineOsc.frequency.setTargetAtTime(55 + Math.abs(p.car.speed) * 0.16, this.ctx.currentTime, 0.1);
      // Siren wail.
      const anySiren = SC.cars.some((c) => c.police && c.siren && SC.wanted > 0);
      if (anySiren) {
        this.sirenT -= dt;
        if (this.sirenT <= 0) {
          this.sirenT = 0.42;
          this.tone(this.sirenStep ? 660 : 880, 0.4, 'sine', 0.045);
          this.sirenStep = !this.sirenStep;
        }
      }
      // Music: a slow bassline + hats, only while playing.
      if (SC.state === 'playing') {
        this.musicT -= dt;
        if (this.musicT <= 0) {
          this.musicT = 0.24;
          const bass = [55, 0, 65.4, 0, 49, 0, 58.3, 0, 55, 0, 65.4, 0, 73.4, 65.4, 49, 0];
          const n = bass[this.musicStep % bass.length];
          if (n) this.tone(n, 0.22, 'triangle', 0.07);
          if (this.musicStep % 2 === 0) this.noise(0.03, 0.02, 6000);
          this.musicStep++;
        }
      }
    } catch (e) { /* ignore */ }
  },
};
