import test from "node:test";
import assert from "node:assert/strict";
import { normalize, validTrack, save, load } from "../src/storage.js";
test("old or corrupt saves recover safely", () => {
  assert.deepEqual(normalize(null).owned, ["porsche"]);
  const p = normalize({
    version: 1,
    owned: ["unknown"],
    selected: "unknown",
    records: null,
    races: -1,
    settings: { quality: "broken" },
    tracks: [null, { points: [[0, 0]] }],
  });
  assert.equal(p.selected, "porsche");
  assert.deepEqual(p.records, {});
  assert.equal(p.races, 0);
  assert.equal(p.settings.quality, "auto");
  assert.deepEqual(p.tracks, []);
});
test("valid state survives storage roundtrip and errors are recoverable", () => {
  let stored;
  globalThis.localStorage = {
    setItem: (key, value) => (stored = value),
    getItem: () => stored,
  };
  const p = normalize({
    version: 1,
    owned: ["porsche", "mini"],
    selected: "mini",
    records: { test: 12.4 },
    racePrefs: { mode: "driver", type: "time", laps: 5 },
  });
  assert.equal(save(p), true);
  assert.deepEqual(load(), p);
  globalThis.localStorage = {
    setItem: () => {
      throw Error("quota");
    },
    getItem: () => "{broken",
  };
  assert.equal(save(p), false);
  assert.equal(load().selected, "porsche");
  delete globalThis.localStorage;
});
test("track import rejects non-finite or unbounded coordinates", () => {
  assert.ok(
    validTrack({
      name: "Track",
      points: [
        [0, 0],
        [10, 0],
        [10, 10],
        [0, 10],
      ],
    }),
  );
  assert.equal(
    validTrack({
      name: "Track",
      points: [
        [Infinity, 0],
        [10, 0],
        [10, 10],
        [0, 10],
      ],
    }),
    false,
  );
});

test("adding presets preserves the selected custom circuit in old saves", () => {
  const p = normalize({
    version: 1,
    owned: ["porsche"],
    lastTrack: 3,
    tracks: [
      {
        name: "My track",
        points: [
          [0, 0],
          [8, 0],
          [8, 8],
          [0, 8],
        ],
      },
    ],
  });
  assert.equal(p.lastTrack, p.presetCount);
  assert.equal(p.tracks[0].name, "My track");
  const again = normalize({ ...p, version: 1 });
  assert.equal(again.lastTrack, p.lastTrack);
});
