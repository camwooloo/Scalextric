import test from "node:test";
import assert from "node:assert/strict";
import {
  engineAllowed,
  engineParams,
  enginePCM,
  ClubAudio,
} from "../src/audio.js";
import { normalize } from "../src/storage.js";
test("engine gate stays closed after finishes, pauses, deslots, countdowns and muting", () => {
  const s = { racing: true, finished: false, off: 0, countdown: 0 };
  assert.equal(engineAllowed(s, { sound: true }, false, false), true);
  for (const patch of [
    { finished: true },
    { racing: false },
    { off: 1 },
    { countdown: 3 },
  ])
    assert.equal(
      engineAllowed({ ...s, ...patch }, { sound: true }, false, false),
      false,
    );
  assert.equal(engineAllowed(s, { sound: false }, false, false), false);
  assert.equal(engineAllowed(s, { sound: true }, true, false), false);
  assert.equal(engineAllowed(s, { sound: true }, false, true), false);
});
test("engine shifts reduce revs and its steady full-throttle signal is bounded", () => {
  const before = engineParams(19.9, 100, 1, false, 0),
    after = engineParams(20.1, 100, 1, false, 0);
  assert.ok(before.rate > after.rate + 0.3);
  assert.equal(after.gear, 2);
  const full = engineParams(100, 100, 1, false, 10);
  assert.ok(full.cutoff <= 1300);
  assert.ok(full.rate < 1.6);
  const data = enginePCM(24000);
  let energy = 0,
    peak = 0,
    mean = 0,
    high = 0;
  for (let j = 0; j < data.length; j++) {
    energy += data[j] ** 2;
    mean += data[j];
    peak = Math.max(peak, Math.abs(data[j]));
    if (j) high += (data[j] - data[j - 1]) ** 2;
  }
  assert.ok(Math.sqrt(energy / data.length) > 0.03);
  assert.ok(peak < 0.7);
  assert.ok(Math.abs(mean / data.length) < 0.06);
  assert.ok(
    high / energy < 0.2,
    "signal must not be dominated by bright high frequencies",
  );
});
test("music is opt-in; audio volume and preference migrate and clamp safely", () => {
  assert.equal(normalize(null).settings.music, false);
  assert.equal(normalize({ version: 1 }).settings.music, false);
  const p = normalize({
    version: 1,
    settings: { music: true, engineVolume: 3, musicVolume: -1 },
  });
  assert.equal(p.settings.music, true);
  assert.equal(p.settings.engineVolume, 1);
  assert.equal(p.settings.musicVolume, 0);
  const unavailable = new ClubAudio(null);
  unavailable.unlock();
  unavailable.silence();
  assert.equal(unavailable.unlocked, false);
});
