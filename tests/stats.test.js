import { test } from "node:test";
import assert from "node:assert/strict";
import {
  emptyStats,
  normalizeStats,
  circuitKey,
  addStats,
  recordLap,
  recordSession,
} from "../src/stats.js";
import { normalize } from "../src/storage.js";
const ctx = { trackId: "a", track: "Club", car: "mini", mode: "race" };
test("lap, partial session and result counters agree across track, car and mode", () => {
  const s = emptyStats();
  addStats(s, ctx, {
    starts: 1,
    seconds: 25,
    distance: 90,
    topSpeed: 18,
    crashes: 1,
  });
  recordLap(s, ctx, 12, false);
  recordLap(s, ctx, 11, true);
  const state = { time: 25, progress: 2.4, crashes: 1 };
  recordSession(s, ctx, state, "Won");
  recordSession(s, ctx, state, "Exited");
  for (const b of [s, s.tracks.a, s.cars.mini, s.modes.race]) {
    assert.equal(b.laps, 2);
    assert.equal(b.cleanLaps, 1);
    assert.equal(b.wins, 1);
    assert.equal(b.completed, 1);
    assert.equal(b.distance, 90);
  }
  assert.equal(s.history.length, 1);
  assert.equal(s.tracks.a.best, 11);
});
test("exited sessions keep laps without becoming race completions", () => {
  const s = emptyStats();
  addStats(s, ctx, { starts: 1 });
  recordLap(s, ctx, 14, true);
  recordSession(s, ctx, { time: 19, progress: 1.5, crashes: 0 }, "Exited");
  assert.equal(s.completed, 0);
  assert.equal(s.history[0].result, "Exited");
  assert.equal(s.laps, 1);
});
test("old personal bests survive migration; new statistics do not invent history", () => {
  const p = normalize({ version: 1, records: { "Club|mini": 12 }, races: 8 });
  assert.equal(p.records["Club|mini"], 12);
  assert.equal(p.races, 8);
  assert.equal(p.stats.laps, 0);
  assert.equal(p.settings.theme, "dark");
});
test("stats reject invalid counters and bound imported histories", () => {
  const s = normalizeStats({
    laps: -5,
    seconds: Infinity,
    history: Array(300).fill({ track: "A", car: "mini", time: 20, date: 1 }),
  });
  assert.equal(s.laps, 0);
  assert.equal(s.seconds, 0);
  assert.equal(s.history.length, 50);
  assert.deepEqual(
    normalizeStats(JSON.parse('{"tracks":{"__proto__":{"laps":999}}}')).tracks,
    {},
  );
});
test("circuit identity survives rename but distinguishes layout changes", () => {
  const a = {
    name: "A",
    points: [
      [0, 0],
      [1, 1],
    ],
  };
  assert.equal(circuitKey(a), circuitKey({ ...a, name: "B" }));
  assert.notEqual(circuitKey(a), circuitKey({ ...a, bridge: true }));
});

import { statsView } from "../src/stats-view.js";
import { cars, presets } from "../src/data.js";
test("stunt layout best laps exclude the original route and display readable car names", () => {
  const track = {
    ...presets.find((t) => t.name === "Loop Laboratory"),
    name: "Custom circuit",
  };
  const key = circuitKey(track);
  const profile = normalize({
    version: 1,
    records: {
      "Custom circuit|porsche": 10,
      [`Custom circuit|${key}|porsche`]: 30,
      "Custom circuit|circuit-other|porsche": 5,
    },
  });
  const html = statsView(profile, [track], cars, {
    heading: () => "",
    escape: String,
    formatTime: (v) => (Number.isFinite(v) ? `${v}s` : "—"),
  });
  assert.ok(
    html.includes('<th>Custom circuit</th><td class="timing">30s</td>'),
  );
  assert.ok(html.includes("Custom circuit · Stunt layout"));
  assert.ok(!html.includes(key));
});
