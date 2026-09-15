import test from "node:test";
import assert from "node:assert/strict";
import { presets, cars } from "../src/data.js";
import {
  buildCircuit,
  trackFrame,
  laneOffset,
  advanceStunt,
  jumpWindow,
  loopMinimum,
  collisionAt,
  validFeatures,
  repairSeconds,
} from "../src/stunts.js";
import { circuitKey } from "../src/stats.js";
import { normalize, validTrack } from "../src/storage.js";
import * as THREE from "three";
const stuntPresets = presets.filter((p) => p.features?.length);
test("stunt presets are closed and have finite orthonormal track frames, including inverted loops", () => {
  for (const preset of stuntPresets) {
    assert.ok(validTrack(preset));
    const { curve, features } = buildCircuit(preset);
    assert.ok(curve.getPointAt(0).distanceTo(curve.getPointAt(1)) < 0.001);
    for (let u = 0; u < 1; u += 0.001) {
      const f = trackFrame(curve, u);
      for (const v of [f.p, f.t, f.up, f.right])
        assert.ok(v.toArray().every(Number.isFinite));
      assert.ok(Math.abs(f.t.dot(f.up)) < 1e-6);
      assert.ok(Math.abs(f.right.dot(f.up)) < 1e-6);
    }
    for (const f of features.filter((f) => f.type === "loop")) {
      assert.ok(trackFrame(curve, f.at).up.y < -0.8);
      assert.ok(curve.getPointAt(f.at).y > 6);
    }
  }
});
test("lane crossovers converge, swap lanes and remain continuous between laps", () => {
  const { features } = buildCircuit(stuntPresets[0]),
    f = features[0];
  assert.ok(Math.abs(laneOffset(features, f.at, -0.6)) < 1e-6);
  assert.equal(laneOffset(features, f.end, -0.6), 0.6);
  const odd = [f];
  assert.ok(
    Math.abs(laneOffset(odd, 1 - 1e-7, -0.6) - laneOffset(odd, 1, -0.6)) < 1e-6,
  );
});
test("jump takeoff locks a flight; safe landings succeed and both speed extremes crash", () => {
  const circuit = buildCircuit(
      presets.find((p) => p.name === "Airborne Arena"),
    ),
    f = circuit.features[0],
    car = cars[0],
    w = jumpWindow(car);
  for (const [speed, safe] of [
    [(w.min + w.max) / 2, true],
    [w.min - 1, false],
    [w.max + 1, false],
  ]) {
    const s = { progress: f.takeoff + 0.0001, speed, flight: null };
    assert.equal(
      advanceStunt(s, circuit, car, f.takeoff - 0.0001, 1 / 60),
      "takeoff",
    );
    assert.equal(s.flight.safe, safe);
    s.progress = f.landing + 0.0001;
    assert.equal(
      advanceStunt(s, circuit, car, f.landing - 0.0001, 1 / 60),
      safe ? "landed" : "jump",
    );
    assert.equal(s.flight, null);
  }
});
test("downforce changes loop survival and jump rating widens the safe speed window", () => {
  const circuit = buildCircuit(
      presets.find((p) => p.name === "Loop Laboratory"),
    ),
    f = circuit.features[0];
  const weak = { downforce: 30, jump: 30 },
    strong = { downforce: 100, jump: 100 };
  const speed = (loopMinimum(weak) + loopMinimum(strong)) / 2;
  assert.equal(
    advanceStunt(
      { progress: f.at, speed },
      circuit,
      weak,
      f.at - 0.001,
      1 / 60,
    ),
    "loop",
  );
  assert.equal(
    advanceStunt(
      { progress: f.at, speed },
      circuit,
      strong,
      f.at - 0.001,
      1 / 60,
    ),
    null,
  );
  assert.ok(jumpWindow(strong).min < jumpWindow(weak).min);
  assert.ok(jumpWindow(strong).max > jumpWindow(weak).max);
});
test("collision checks include height, and pit/crash repair durations stay short", () => {
  assert.ok(collisionAt(new THREE.Vector3(), new THREE.Vector3(0.2, 0, 0.1)));
  assert.ok(!collisionAt(new THREE.Vector3(), new THREE.Vector3(0, 3, 0)));
  for (const reason of ["pit", "corner", "jump", "loop", "collision"])
    assert.ok(repairSeconds(reason) >= 2.5 && repairSeconds(reason) <= 3.5);
});
test("custom stunt pieces persist, distinguish records, and reject malformed or overlapping saves", () => {
  const t = structuredClone(stuntPresets[0]);
  assert.deepEqual(
    normalize({ version: 1, tracks: [t] }).tracks[0].features,
    t.features,
  );
  assert.notEqual(circuitKey(t), circuitKey({ ...t, features: [] }));
  for (const features of [
    [{ type: "loop", at: NaN }],
    [{ type: "bad", at: 0.3 }],
    [{ type: "jump", at: 0 }],
    [
      { type: "jump", at: 0.3 },
      { type: "loop", at: 0.3 },
    ],
  ])
    assert.equal(validFeatures({ ...t, features }), false);
});

test("intersection stays flat and brings different parts of the two lanes into collision range", () => {
  const { curve, features } = buildCircuit(
      presets.find((p) => p.name === "Collision Junction"),
    ),
    f = features[0];
  const lane = [];
  for (let j = 0; j <= 500; j++) {
    const u = f.start + ((f.end - f.start) * j) / 500,
      frame = trackFrame(curve, u);
    assert.ok(frame.up.y > 0.999);
    lane.push({
      u,
      left: frame.p.clone().addScaledVector(frame.side, -0.6),
      right: frame.p.clone().addScaledVector(frame.side, 0.6),
    });
  }
  let hit = false;
  for (let a = 0; a < lane.length && !hit; a++)
    for (let b = a + 70; b < lane.length; b++)
      if (collisionAt(lane[a].left, lane[b].right)) {
        hit = true;
        break;
      }
  assert.ok(hit, "intersection routes must physically share a crossing");
});
