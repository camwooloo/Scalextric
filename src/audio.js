const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
export function engineAllowed(state, settings, paused, hidden) {
  return !!(
    settings.sound &&
    state.racing &&
    !state.finished &&
    !state.off &&
    state.countdown <= 0 &&
    !paused &&
    !hidden
  );
}
export function engineParams(speed, topSpeed, throttle, brake, time) {
  const speedRatio = clamp(speed / Math.max(1, topSpeed));
  const gear = Math.min(4, Math.floor(speedRatio * 5));
  const rev = clamp(0.23 + (speedRatio * 5 - gear) * 0.62 + throttle * 0.12);
  return {
    gear: gear + 1,
    rate: 0.65 + rev * 0.85 + Math.sin(time * 8.1) * 0.009,
    level: (speedRatio < 0.02 ? 0.12 : 0.16) + throttle * 0.2,
    cutoff: 430 + rev * 550 + throttle * 220,
    road: brake ? 0.026 * speedRatio : 0.012 * speedRatio,
  };
}
// Original, deterministic combustion pulses. The irregular firing and noise bed
// avoid a static pure tone; no copyrighted engine recordings are used.
export function enginePCM(sampleRate, seconds = 3) {
  const data = new Float32Array(Math.floor(sampleRate * seconds));
  let seed = 12345;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  let next = 0,
    phase = 0,
    body = 0;
  for (let j = 0; j < data.length; j++) {
    const t = j / sampleRate;
    if (t >= next) {
      phase = 0;
      next = t + (1 / 38) * (0.88 + random() * 0.24);
    }
    phase += 1 / sampleRate;
    body = body * 0.9 + (random() * 2 - 1) * 0.1;
    data[j] =
      Math.tanh(
        Math.sin(phase * Math.PI * 2 * 96) * Math.exp(-phase * 115) * 0.55 +
          body * Math.exp(-phase * 75) * 0.6 +
          body * 0.16,
      ) * 0.8;
  }
  // A quiet loop seam, with enough distinct cycles to avoid a rhythmic buzz.
  const fade = Math.floor(sampleRate * 0.012);
  for (let j = 0; j < fade; j++) {
    data[j] *= j / fade;
    data[data.length - 1 - j] *= j / fade;
  }
  return data;
}
const hz = (midi) => 440 * 2 ** ((midi - 69) / 12);
export class ClubAudio {
  constructor(
    Context = globalThis.AudioContext || globalThis.webkitAudioContext,
  ) {
    this.Context = Context;
    this.engine = null;
    this.notes = new Set();
    this.musicOn = false;
    this.engineVolume = 0.45;
    this.musicVolume = 0.3;
    this.unlocked = false;
  }
  unlock() {
    if (!this.Context) return;
    try {
      if (!this.context) {
        const c = (this.context = new this.Context());
        this.master = c.createDynamicsCompressor();
        this.master.threshold.value = -16;
        this.master.ratio.value = 4;
        this.master.connect(c.destination);
        this.musicBus = c.createGain();
        this.musicBus.gain.value = 0;
        this.musicBus.connect(this.master);
        this.engineBuffer = c.createBuffer(1, c.sampleRate * 3, c.sampleRate);
        this.engineBuffer.copyToChannel(enginePCM(c.sampleRate), 0);
        this.noiseBuffer = c.createBuffer(1, c.sampleRate, c.sampleRate);
        const data = this.noiseBuffer.getChannelData(0);
        let n = 73;
        for (let j = 0; j < data.length; j++) {
          n = (n * 16807) % 2147483647;
          data[j] = (n / 2147483647 - 0.5) * 0.6;
        }
      }
      this.unlocked = true;
      if (this.context.state === "suspended")
        this.context.resume().catch(() => {});
    } catch {
      this.unlocked = false;
    }
  }
  startEngine(car) {
    if (!this.context || !this.unlocked || this.engine) return;
    const c = this.context,
      source = c.createBufferSource(),
      noise = c.createBufferSource();
    const dc = c.createBiquadFilter(),
      filter = c.createBiquadFilter(),
      roadFilter = c.createBiquadFilter(),
      body = c.createGain(),
      road = c.createGain(),
      bus = c.createGain();
    source.buffer = this.engineBuffer;
    source.loop = true;
    noise.buffer = this.noiseBuffer;
    noise.loop = true;
    dc.type = "highpass";
    dc.frequency.value = 35;
    dc.Q.value = 0.5;
    filter.type = "lowpass";
    filter.frequency.value = 650;
    filter.Q.value = 0.35;
    roadFilter.type = "bandpass";
    roadFilter.frequency.value = 480;
    roadFilter.Q.value = 0.4;
    body.gain.value = 0;
    road.gain.value = 0;
    bus.gain.value = this.engineVolume;
    source.connect(dc).connect(filter).connect(body).connect(bus);
    noise.connect(roadFilter).connect(road).connect(bus);
    bus.connect(this.master);
    source.start();
    noise.start();
    const character = /mustang|v8|countach|corvette/i.test(car.name)
      ? 0.83
      : /mini|golf|civic/i.test(car.name)
        ? 1.1
        : 1;
    this.engine = {
      source,
      noise,
      filter,
      roadFilter,
      dc,
      body,
      road,
      bus,
      character,
    };
  }
  stopEngine() {
    const e = this.engine;
    if (!e) return;
    this.engine = null;
    const now = this.context.currentTime;
    e.bus.gain.cancelScheduledValues(now);
    e.bus.gain.setValueAtTime(e.bus.gain.value, now);
    e.bus.gain.linearRampToValueAtTime(0, now + 0.025);
    e.source.onended = () => Object.values(e).forEach((n) => n?.disconnect?.());
    e.source.stop(now + 0.03);
    e.noise.stop(now + 0.03);
  }
  updateEngine(active, car, speed, throttle, brake) {
    if (!active || !this.engineVolume) {
      this.stopEngine();
      return;
    }
    this.startEngine(car);
    const e = this.engine;
    if (!e) return;
    const now = this.context.currentTime,
      p = engineParams(speed, car.speed, throttle, brake, now);
    e.source.playbackRate.setTargetAtTime(p.rate * e.character, now, 0.09);
    e.body.gain.setTargetAtTime(p.level, now, 0.06);
    e.filter.frequency.setTargetAtTime(p.cutoff, now, 0.09);
    e.road.gain.setTargetAtTime(p.road, now, 0.08);
    e.bus.gain.setTargetAtTime(this.engineVolume, now, 0.06);
  }
  note(midi, when, length, type, volume) {
    const c = this.context,
      source = c.createOscillator(),
      amp = c.createGain(),
      filter = c.createBiquadFilter();
    source.type = type;
    source.frequency.value = hz(midi);
    filter.type = "lowpass";
    filter.frequency.value = 1800;
    filter.Q.value = 0.3;
    amp.gain.setValueAtTime(0, when);
    amp.gain.linearRampToValueAtTime(volume, when + 0.012);
    amp.gain.exponentialRampToValueAtTime(0.0001, when + length);
    source.connect(filter).connect(amp).connect(this.musicBus);
    this.notes.add(source);
    source.onended = () => {
      this.notes.delete(source);
      source.disconnect();
      filter.disconnect();
      amp.disconnect();
    };
    source.start(when);
    source.stop(when + length + 0.02);
  }
  drum(when, kick = false, snare = false) {
    const c = this.context,
      source = kick ? c.createOscillator() : c.createBufferSource(),
      gain = c.createGain(),
      filter = c.createBiquadFilter();
    if (kick) {
      source.frequency.setValueAtTime(115, when);
      source.frequency.exponentialRampToValueAtTime(43, when + 0.13);
    } else source.buffer = this.noiseBuffer;
    filter.type = kick ? "lowpass" : "highpass";
    filter.frequency.value = kick ? 500 : snare ? 900 : 4200;
    gain.gain.setValueAtTime(kick ? 0.23 : snare ? 0.13 : 0.065, when);
    gain.gain.exponentialRampToValueAtTime(
      0.0001,
      when + (kick ? 0.2 : snare ? 0.15 : 0.045),
    );
    source.connect(filter).connect(gain).connect(this.musicBus);
    this.notes.add(source);
    source.onended = () => {
      this.notes.delete(source);
      source.disconnect();
      filter.disconnect();
      gain.disconnect();
    };
    source.start(when);
    source.stop(when + 0.24);
  }
  schedule() {
    if (!this.musicOn || this.context.state !== "running") return;
    const c = this.context,
      step = 60 / 112 / 4;
    if (this.nextNote < c.currentTime) this.nextNote = c.currentTime + 0.03;
    while (this.nextNote < c.currentTime + 0.18) {
      const n = this.step++,
        bar = Math.floor(n / 16) % 8,
        beat = n % 16;
      const root = [45, 45, 41, 41, 48, 48, 43, 43][bar],
        third = bar < 2 ? 3 : 4;
      // An original eight-bar A-minor synth-pop arrangement with a second phrase.
      if (beat % 4 === 0) this.drum(this.nextNote, true);
      if (beat === 4 || beat === 12) this.drum(this.nextNote, false, true);
      if (beat % 2 === 0) this.drum(this.nextNote);
      if (beat % 2 === 0)
        this.note(
          root + (beat === 14 ? 12 : 0),
          this.nextNote,
          step * 1.7,
          "triangle",
          0.19,
        );
      if (beat === 0)
        for (const interval of [0, third, 7])
          this.note(
            root + 12 + interval,
            this.nextNote,
            step * 14,
            "triangle",
            0.042,
          );
      if (bar % 2 || beat % 4 === 2) {
        const phrase = [12, 19, 12 + third, 22, 19, 12 + third, 24, 22],
          pitch = phrase[Math.floor(beat / 2)];
        this.note(root + pitch, this.nextNote, step * 1.4, "triangle", 0.085);
      }
      this.nextNote += step;
    }
  }
  setMusic(on, volume = this.musicVolume) {
    this.musicVolume = clamp(volume);
    on = on && this.musicVolume > 0;
    if (!this.context || !this.unlocked) return;
    const target = on ? this.musicVolume : 0;
    if (this.musicTarget !== target) {
      this.musicTarget = target;
      const now = this.context.currentTime;
      this.musicBus.gain.cancelScheduledValues(now);
      this.musicBus.gain.setValueAtTime(this.musicBus.gain.value, now);
      this.musicBus.gain.linearRampToValueAtTime(target, now + 0.025);
    }
    if (on && !this.musicOn) {
      this.musicOn = true;
      this.nextNote = this.context.currentTime + 0.04;
      this.step = 0;
      this.schedule();
      this.timer = setInterval(() => this.schedule(), 75);
    } else if (!on && this.musicOn) {
      this.musicOn = false;
      clearInterval(this.timer);
      for (const note of this.notes)
        try {
          note.stop(this.context.currentTime + 0.03);
        } catch {}
    }
  }
  silence() {
    this.stopEngine();
    this.setMusic(false);
  }
}
