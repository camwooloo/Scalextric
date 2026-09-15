import test from "node:test";
import assert from "node:assert/strict";
import { stepSpeed, cornerLoad, cars } from "../src/data.js";

test("throttle accelerates; release slows; brake stops without reversing", () => {
  let speed = 0;
  for (let i = 0; i < 120; i++)
    speed = stepSpeed(speed, 1, false, 1 / 60, cars[0]);
  assert.ok(speed > 10);
  const coasting = stepSpeed(speed, 0, false, 1, cars[0]);
  const braking = stepSpeed(speed, 0, true, 1, cars[0]);
  assert.ok(coasting < speed);
  assert.ok(braking < coasting);
  assert.equal(stepSpeed(1, 0, true, 1, cars[0]), 0);
});
test("car top speed is bounded and speed doubles quadruple lateral force", () => {
  assert.equal(stepSpeed(100, 1, false, 1, cars[0]), cars[0].speed);
  assert.equal(cornerLoad(20, 0.1, 24), cornerLoad(10, 0.1, 24) * 4);
  assert.ok(cornerLoad(5, 0.2, 24) < 1.2);
  assert.ok(cornerLoad(24, 0.2, 24) > 1.2);
  assert.ok(cornerLoad(15, 0.2, 29) < cornerLoad(15, 0.2, 20));
});

import { stepGrip, resetHandling, sampleCurvature } from "../src/handling.js";
import * as THREE from "three";
test("brief overload recovers, sustained overload eventually deslots", () => {
  let slip = stepGrip(1.5, 0, 1 / 60);
  assert.ok(slip < 0.22);
  slip = stepGrip(0.7, slip, 0.1);
  assert.equal(slip, 0);
  for (let j = 0; j < 60; j++) slip = stepGrip(1.5, slip, 1 / 60);
  assert.ok(slip > 0.22);
});
test("reset restores handling without deleting lap progress", () => {
  const s = {
    off: 2,
    speed: 22,
    load: 4,
    slip: 1,
    recovery: 0,
    progress: 1.4,
    fly: new THREE.Vector3(1, 2, 3),
  };
  resetHandling(s);
  assert.equal(s.off, 0);
  assert.equal(s.speed, 0);
  assert.equal(s.slip, 0);
  assert.equal(s.load, 0);
  assert.equal(s.progress, 1.4);
  assert.ok(s.recovery > 1);
  assert.equal(s.fly.length(), 0);
});
test("medium analogue power holds a controllable speed", () => {
  let speed = 0;
  for (let j = 0; j < 600; j++)
    speed = stepSpeed(speed, 0.45, false, 1 / 60, cars[0]);
  assert.ok(Math.abs(speed - cars[0].speed * 0.45) < 0.01);
  assert.ok(cornerLoad(speed, 0.4, cars[0].grip) < 1);
});
